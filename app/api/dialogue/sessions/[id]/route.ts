import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { getDialogueSessionPayload } from '@/lib/dialogue-flow'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const payload = await getDialogueSessionPayload(id, guard.user.id)

    if (!payload) {
      return NextResponse.json({ error: 'Dialogue session not found' }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching dialogue session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dialogue session' },
      { status: 500 }
    )
  }
}
