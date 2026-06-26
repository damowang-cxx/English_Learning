import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { createDialogueRealtimeClientSecret } from '@/lib/dialogue-realtime'
import { getOrCreateFreeConversationSession } from '@/lib/conversation-core'

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const conversationSessionId =
      typeof body?.conversationSessionId === 'string' ? body.conversationSessionId.trim() : ''
    const conversationSession = await getOrCreateFreeConversationSession({
      userId: guard.user.id,
      sessionId: conversationSessionId || null,
      metadata: {
        surface: 'dialogue_home_coach',
        adapter: 'realtime_webrtc',
      },
    })
    const clientSecret = await createDialogueRealtimeClientSecret({
      userId: guard.user.id,
    })

    return NextResponse.json({
      conversationSessionId: conversationSession.id,
      ephemeralKey: clientSecret.value,
      model: clientSecret.model,
      voice: clientSecret.voice,
      expiresAt: clientSecret.expiresAt,
      realtimeSessionId: clientSecret.sessionId || null,
    })
  } catch (error) {
    console.error('Error creating dialogue realtime session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create realtime session' },
      { status: 500 }
    )
  }
}
