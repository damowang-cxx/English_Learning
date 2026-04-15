import { NextResponse } from 'next/server'
import { requireApiTrainingBackupAdmin } from '@/lib/training-backup-api'
import {
  createTrainingBackupSnapshot,
  getTrainingBackupStatus,
  TrainingBackupError,
} from '@/lib/training-backup'

export const dynamic = 'force-dynamic'

function buildBackupErrorResponse(error: unknown, fallbackMessage: string) {
  console.error(fallbackMessage, error)

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: error instanceof TrainingBackupError ? 400 : 500 }
  )
}

export async function GET() {
  const guard = await requireApiTrainingBackupAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    return NextResponse.json(await getTrainingBackupStatus())
  } catch (error) {
    return buildBackupErrorResponse(error, 'Failed to load training backup status.')
  }
}

export async function POST() {
  const guard = await requireApiTrainingBackupAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    return NextResponse.json(await createTrainingBackupSnapshot())
  } catch (error) {
    return buildBackupErrorResponse(error, 'Failed to create training backup.')
  }
}
