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
    const body = await request.json().catch(() => ({}))
    const question = String(body?.question || '请给我一个当前场景的提示。').trim()
    const payload = await askDialogueCoach({
      sessionId: id,
      userId: guard.user.id,
      question,
      mode: 'hint',
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error requesting dialogue hint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request dialogue hint' },
      { status: 500 }
    )
  }
}
