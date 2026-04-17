import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { respondToDialogueSession } from '@/lib/dialogue-flow'

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
    const body = await request.json()
    const text = String(body?.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'text is required.' }, { status: 400 })
    }

    const payload = await respondToDialogueSession({
      sessionId: id,
      userId: guard.user.id,
      text,
      inputMode: 'text',
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error responding to dialogue session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit dialogue response' },
      { status: 500 }
    )
  }
}
