import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { createDialogueSession } from '@/lib/dialogue-flow'

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json()
    const scenarioId = String(body?.scenarioId || '').trim()

    if (!scenarioId) {
      return NextResponse.json({ error: 'scenarioId is required.' }, { status: 400 })
    }

    const payload = await createDialogueSession(scenarioId, guard.user.id)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error creating dialogue session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dialogue session' },
      { status: 500 }
    )
  }
}
