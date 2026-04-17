import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { resetDialogueSession } from '@/lib/dialogue-flow'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const payload = await resetDialogueSession(id, guard.user.id)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error resetting dialogue session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset dialogue session' },
      { status: 500 }
    )
  }
}
