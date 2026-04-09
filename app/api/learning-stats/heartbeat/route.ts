import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiUser } from '@/lib/authz'
import {
  isValidDateKey,
} from '@/lib/learning-stats'

interface LearningHeartbeatPayload {
  dateKey?: string
  studyDeltaSec?: number
  audioDeltaSec?: number
  dictationDeltaSec?: number
}

function sanitizeDelta(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  const normalized = Math.floor(value)
  return Math.max(0, normalized)
}

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const payload = (await request.json()) as LearningHeartbeatPayload
    const dateKey = typeof payload.dateKey === 'string' ? payload.dateKey : ''
    const userId = guard.user.id

    if (!isValidDateKey(dateKey)) {
      return NextResponse.json(
        { error: 'Invalid dateKey. Expect YYYY-MM-DD.' },
        { status: 400 },
      )
    }

    const studyDeltaSec = sanitizeDelta(payload.studyDeltaSec)
    const audioDeltaSec = sanitizeDelta(payload.audioDeltaSec)
    const dictationDeltaSec = sanitizeDelta(payload.dictationDeltaSec)

    if (studyDeltaSec === 0 && audioDeltaSec === 0 && dictationDeltaSec === 0) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    await prisma.learningDailyStat.upsert({
      where: {
        userId_dateKey: {
          userId,
          dateKey,
        },
      },
      update: {
        studySeconds: {
          increment: studyDeltaSec,
        },
        audioSeconds: {
          increment: audioDeltaSec,
        },
        dictationSeconds: {
          increment: dictationDeltaSec,
        },
      },
      create: {
        userId,
        dateKey,
        studySeconds: studyDeltaSec,
        audioSeconds: audioDeltaSec,
        dictationSeconds: dictationDeltaSec,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error saving learning heartbeat:', error)
    return NextResponse.json(
      { error: 'Failed to save learning heartbeat' },
      { status: 500 },
    )
  }
}
