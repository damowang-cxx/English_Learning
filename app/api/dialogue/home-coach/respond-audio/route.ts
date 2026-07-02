import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueTags } from '@/lib/dialogue'
import {
  coachDialogueHome,
  createDialogueHomeSpeechToken,
  transcribeDialogueAudio,
  type DialogueHomeCoachMessage,
} from '@/lib/dialogue-ai'
import {
  getOrCreateFreeConversationSession,
  recordCompletedConversationTurn,
  type AiReply,
} from '@/lib/conversation-core'

function normalizeRecentMessages(value: unknown): DialogueHomeCoachMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry): DialogueHomeCoachMessage | null => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const candidate = entry as Record<string, unknown>
      const role = candidate.role === 'coach' ? 'coach' : candidate.role === 'user' ? 'user' : null
      const text = typeof candidate.text === 'string' ? candidate.text.trim() : ''

      return role && text ? { role, text: text.slice(0, 1200) } : null
    })
    .filter((entry): entry is DialogueHomeCoachMessage => Boolean(entry))
    .slice(-8)
}

async function getPublishedScenarioContext() {
  const scenarios = await prisma.dialogueScenario.findMany({
    where: { isPublished: true },
    orderBy: [
      { updatedAt: 'desc' },
      { title: 'asc' },
    ],
    include: {
      _count: {
        select: {
          stages: true,
        },
      },
    },
  })

  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    difficulty: scenario.difficulty,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
    tags: normalizeDialogueTags(scenario.tagsJson),
    nodesCount: scenario._count.stages,
  }))
}

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const conversationSessionId = String(formData.get('conversationSessionId') || '').trim()

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio file is required.' }, { status: 400 })
    }

    const conversationSession = await getOrCreateFreeConversationSession({
      userId: guard.user.id,
      sessionId: conversationSessionId || null,
      metadata: {
        surface: 'dialogue_home_coach',
      },
    })
    const transcriptText = await transcribeDialogueAudio(audio)
    const recentMessagesRaw = String(formData.get('recentMessages') || '[]')
    const scenarios = await getPublishedScenarioContext()
    const coach = await coachDialogueHome({
      message: transcriptText,
      recentMessages: normalizeRecentMessages(JSON.parse(recentMessagesRaw)),
      scenarios,
    })
    const suggestedScenarios = scenarios.filter((scenario) => coach.suggestedScenarioIds.includes(scenario.id))
    const speechToken = createDialogueHomeSpeechToken(coach.ttsTextZh)
    const aiReply: AiReply = {
      role: 'coach',
      text: coach.replyZh,
      language: 'zh',
      speechText: coach.ttsTextZh,
      speechToken,
      suggestedScenarioIds: coach.suggestedScenarioIds,
      metadata: {
        studyTips: coach.studyTips,
        followupQuestion: coach.followupQuestion,
      },
    }
    const turn = await recordCompletedConversationTurn({
      sessionId: conversationSession.id,
      userId: guard.user.id,
      inputMode: 'audio',
      transcriptSource: 'file_transcription',
      userText: transcriptText,
      transcript: {
        source: 'file_transcription',
        text: transcriptText,
        language: 'en',
      },
      routerIntent: 'free_chat',
      router: {
        intent: 'free_chat',
        confidence: 1,
      },
      aiReply,
      assessment: null,
      profileEvents: [],
      coach: coach,
      coachReplyZh: coach.replyZh,
      nextAction: 'reply',
    })

    return NextResponse.json({
      ...coach,
      suggestedScenarios,
      speechToken,
      transcriptText,
      conversationSessionId: conversationSession.id,
      turnId: turn.turn.id,
    })
  } catch (error) {
    console.error('Error responding with dialogue home coach audio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to respond with dialogue home coach audio' },
      { status: 500 }
    )
  }
}
