import { NextRequest, NextResponse } from 'next/server'
import {
  getConversationSession,
  recordCompletedConversationTurn,
  type AiReply,
} from '@/lib/conversation-core'
import { requireApiUser } from '@/lib/authz'

function normalizeTranscriptText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 8000) : ''
}

function normalizeOptionalIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function inferTranscriptLanguage(text: string) {
  if (/[\u3400-\u9fff]/.test(text) && /[a-z]/i.test(text)) {
    return 'mixed'
  }

  if (/[\u3400-\u9fff]/.test(text)) {
    return 'zh'
  }

  return 'en'
}

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json()
    const conversationSessionId =
      typeof body?.conversationSessionId === 'string' ? body.conversationSessionId.trim() : ''
    const userTranscript = normalizeTranscriptText(body?.userTranscript)
    const assistantTranscript = normalizeTranscriptText(body?.assistantTranscript)
    const realtimeMetadata = normalizeMetadata(body?.realtimeMetadata)
    const startedAt = normalizeOptionalIso(body?.startedAt)
    const endedAt = normalizeOptionalIso(body?.endedAt)

    if (!conversationSessionId) {
      return NextResponse.json({ error: 'conversationSessionId is required.' }, { status: 400 })
    }

    if (!userTranscript || !assistantTranscript) {
      return NextResponse.json(
        { error: 'userTranscript and assistantTranscript are required.' },
        { status: 400 }
      )
    }

    const conversationSession = await getConversationSession(conversationSessionId, guard.user.id)

    if (!conversationSession || conversationSession.mode !== 'free') {
      return NextResponse.json({ error: 'Free conversation session not found.' }, { status: 404 })
    }

    if (conversationSession.status !== 'active') {
      return NextResponse.json({ error: 'Conversation session is not active.' }, { status: 409 })
    }

    const aiReply: AiReply = {
      role: 'coach',
      text: assistantTranscript,
      language: inferTranscriptLanguage(assistantTranscript),
      speechText: assistantTranscript,
      metadata: {
        adapter: 'realtime_webrtc',
        realtimeMetadata,
      },
    }
    const turn = await recordCompletedConversationTurn({
      sessionId: conversationSession.id,
      userId: guard.user.id,
      inputMode: 'realtime',
      transcriptSource: 'realtime_transcript',
      userText: userTranscript,
      transcript: {
        source: 'realtime_transcript',
        text: userTranscript,
        language: inferTranscriptLanguage(userTranscript),
        raw: {
          adapter: 'realtime_webrtc',
          startedAt,
          endedAt,
          metadata: realtimeMetadata,
        },
      },
      routerIntent: 'free_realtime',
      router: {
        intent: 'free_realtime',
        confidence: 1,
        adapter: 'realtime_webrtc',
      },
      aiReply,
      assessment: null,
      profileEvents: [],
      coach: {
        replyText: assistantTranscript,
        adapter: 'realtime_webrtc',
        realtimeMetadata,
      },
      coachReplyZh: assistantTranscript,
      nextAction: 'reply',
    })
    console.info('Dialogue realtime turn recorded', {
      userId: guard.user.id,
      conversationSessionId: conversationSession.id,
      turnId: turn.turn.id,
      userTranscriptLength: userTranscript.length,
      assistantTranscriptLength: assistantTranscript.length,
    })

    return NextResponse.json({
      conversationSessionId: conversationSession.id,
      turnId: turn.turn.id,
      userTranscript,
      assistantTranscript,
    })
  } catch (error) {
    console.error('Error recording dialogue realtime turn:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record realtime turn' },
      { status: 500 }
    )
  }
}
