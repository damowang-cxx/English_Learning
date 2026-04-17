import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { askDialogueCoach } from '@/lib/dialogue-flow'

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
    const question = String(body?.question || '').trim()

    if (!question) {
      return NextResponse.json({ error: 'question is required.' }, { status: 400 })
    }

    const payload = await askDialogueCoach({
      sessionId: id,
      userId: guard.user.id,
      question,
      mode: 'explanation',
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error asking dialogue coach:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ask dialogue coach' },
      { status: 500 }
    )
  }
}
