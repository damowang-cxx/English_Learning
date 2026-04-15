import { NextRequest, NextResponse } from 'next/server'
import { requireApiTrainingBackupAdmin } from '@/lib/training-backup-api'
import { restoreTrainingBackupSnapshot, TrainingBackupError } from '@/lib/training-backup'

export const dynamic = 'force-dynamic'

function buildBackupErrorResponse(error: unknown, fallbackMessage: string) {
  console.error(fallbackMessage, error)

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: error instanceof TrainingBackupError ? 400 : 500 }
  )
}

export async function POST(request: NextRequest) {
  const guard = await requireApiTrainingBackupAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json()
    const snapshotId = typeof body?.snapshotId === 'string' ? body.snapshotId.trim() : ''

    if (!snapshotId) {
      return NextResponse.json({ error: 'snapshotId is required.' }, { status: 400 })
    }

    if (body?.confirmed !== true) {
      return NextResponse.json({ error: 'Restore must be confirmed.' }, { status: 400 })
    }

    return NextResponse.json(await restoreTrainingBackupSnapshot(snapshotId))
  } catch (error) {
    return buildBackupErrorResponse(error, 'Failed to restore training backup.')
  }
}
