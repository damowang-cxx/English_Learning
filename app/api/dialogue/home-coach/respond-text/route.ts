import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueTags } from '@/lib/dialogue'
import {
  coachDialogueHome,
  createDialogueHomeSpeechToken,
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

      if (!role || !text) {
        return null
      }

      return {
        role,
        text: text.slice(0, 1200),
      }
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
    const body = await request.json()
    const message = String(body?.message || '').trim()
    const conversationSessionId =
      typeof body?.conversationSessionId === 'string' ? body.conversationSessionId.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'message is required.' }, { status: 400 })
    }

    const conversationSession = await getOrCreateFreeConversationSession({
      userId: guard.user.id,
      sessionId: conversationSessionId || null,
      metadata: {
        surface: 'dialogue_home_coach',
      },
    })
    const scenarios = await getPublishedScenarioContext()
    const coach = await coachDialogueHome({
      message,
      recentMessages: normalizeRecentMessages(body?.recentMessages),
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
      inputMode: 'text',
      transcriptSource: 'text_input',
      userText: message,
      transcript: {
        source: 'text_input',
        text: message,
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
      conversationSessionId: conversationSession.id,
      turnId: turn.turn.id,
    })
  } catch (error) {
    console.error('Error responding with dialogue home coach:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to respond with dialogue home coach' },
      { status: 500 }
    )
  }
}
