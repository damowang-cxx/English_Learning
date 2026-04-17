import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getCoachVoiceForScenario, getRoleVoiceForScenario, synthesizeDialogueSpeech } from '@/lib/dialogue-ai'

type SpeakKind = 'current_role' | 'last_coach' | 'last_better_answer'

function normalizeSpeakKind(value: unknown): SpeakKind {
  return value === 'last_coach' || value === 'last_better_answer' ? value : 'current_role'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const kind = normalizeSpeakKind(body?.kind)
    const session = await prisma.dialogueSession.findFirst({
      where: {
        id,
        userId: guard.user.id,
      },
      include: {
        scenario: true,
        currentNode: true,
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Dialogue session not found' }, { status: 404 })
    }

    let text = ''
    let voice = getRoleVoiceForScenario(session.scenario.roleVoice)
    let instructions = 'Speak in clear natural English for an English learner.'

    if (kind === 'current_role') {
      text = session.currentNode?.roleLineEn || ''
    } else if (kind === 'last_coach') {
      const attempt = session.attempts.find((entry) => entry.coachReplyZh)
      text = attempt?.coachReplyZh || ''
      voice = getCoachVoiceForScenario(session.scenario.coachVoice)
      instructions = 'Speak in warm, clear Simplified Chinese as a concise English coach.'
    } else {
      const attempt = session.attempts.find((entry) => entry.betterAnswerEn)
      text = attempt?.betterAnswerEn || session.currentNode?.sampleAnswer || ''
      voice = getRoleVoiceForScenario(session.scenario.roleVoice)
      instructions = 'Speak in clear natural English for a learner to repeat.'
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No speakable text is available.' }, { status: 400 })
    }

    const asset = await synthesizeDialogueSpeech({
      text,
      voice,
      instructions,
    })

    return NextResponse.json({
      kind,
      text,
      audioUrl: asset.audioUrl,
      voice: asset.voice,
      model: asset.model,
    })
  } catch (error) {
    console.error('Error synthesizing dialogue speech:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to synthesize dialogue speech' },
      { status: 500 }
    )
  }
}
