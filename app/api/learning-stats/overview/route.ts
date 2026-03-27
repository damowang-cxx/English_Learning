import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildDateKeyRange,
  clampHeatmapDays,
  DEFAULT_HEATMAP_DAYS,
  DEFAULT_LEARNING_USER_ID,
  getHeatmapLevel,
  getYearStartDateKey,
  isValidDateKey,
  shiftDateKey,
  STREAK_THRESHOLD_SECONDS,
  toLocalDateKey,
  type LearningHeatmapDay,
  type LearningStatsOverview,
} from '@/lib/learning-stats'

function parseDays(value: string | null): number {
  if (!value) {
    return DEFAULT_HEATMAP_DAYS
  }

  const parsed = Number(value)
  return clampHeatmapDays(parsed)
}

function calculateCurrentStreak(
  statsByDateKey: Map<string, number>,
  todayDateKey: string,
): number {
  const todaySeconds = statsByDateKey.get(todayDateKey) || 0
  const anchorDateKey = todaySeconds >= STREAK_THRESHOLD_SECONDS
    ? todayDateKey
    : shiftDateKey(todayDateKey, -1)

  let streak = 0
  let cursor = anchorDateKey

  while ((statsByDateKey.get(cursor) || 0) >= STREAK_THRESHOLD_SECONDS) {
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return streak
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || DEFAULT_LEARNING_USER_ID
    const days = parseDays(searchParams.get('days'))
    const providedTodayDateKey = searchParams.get('todayDateKey')
    const todayDateKey = providedTodayDateKey && isValidDateKey(providedTodayDateKey)
      ? providedTodayDateKey
      : toLocalDateKey()
    const yearStartDateKey = getYearStartDateKey(todayDateKey)

    const [heatmapStats, streakStats, yearStats] = await Promise.all([
      prisma.learningDailyStat.findMany({
        where: {
          userId,
          dateKey: {
            gte: shiftDateKey(todayDateKey, -(days - 1)),
            lte: todayDateKey,
          },
        },
        select: {
          dateKey: true,
          studySeconds: true,
        },
      }),
      prisma.learningDailyStat.findMany({
        where: {
          userId,
          dateKey: {
            lte: todayDateKey,
          },
        },
        select: {
          dateKey: true,
          studySeconds: true,
        },
      }),
      prisma.learningDailyStat.findMany({
        where: {
          userId,
          dateKey: {
            gte: yearStartDateKey,
            lte: todayDateKey,
          },
        },
        select: {
          studySeconds: true,
        },
      }),
    ])

    const heatmapMap = new Map<string, number>()
    for (const stat of heatmapStats) {
      heatmapMap.set(stat.dateKey, stat.studySeconds)
    }

    const heatmapDays: LearningHeatmapDay[] = buildDateKeyRange(todayDateKey, days).map((dateKey) => {
      const seconds = heatmapMap.get(dateKey) || 0
      return {
        dateKey,
        seconds,
        level: getHeatmapLevel(seconds),
      }
    })

    const streakMap = new Map<string, number>()
    for (const stat of streakStats) {
      streakMap.set(stat.dateKey, stat.studySeconds)
    }

    const yearCheckInDays = yearStats.reduce((count, stat) => {
      if (stat.studySeconds >= STREAK_THRESHOLD_SECONDS) {
        return count + 1
      }

      return count
    }, 0)

    const overview: LearningStatsOverview = {
      todayStudySeconds: streakMap.get(todayDateKey) || 0,
      currentStreakDays: calculateCurrentStreak(streakMap, todayDateKey),
      yearCheckInDays,
      streakThresholdSeconds: STREAK_THRESHOLD_SECONDS,
      heatmapDays,
    }

    return NextResponse.json(overview)
  } catch (error) {
    console.error('Error fetching learning overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning overview' },
      { status: 500 },
    )
  }
}
