export const DEFAULT_LEARNING_USER_ID = 'default'
export const DEFAULT_HEATMAP_DAYS = 365
export const MIN_HEATMAP_DAYS = 30
export const MAX_HEATMAP_DAYS = 730
export const STREAK_THRESHOLD_SECONDS = 20 * 60

export type LearningHeatmapLevel = 0 | 1 | 2 | 3 | 4

export interface LearningHeatmapDay {
  dateKey: string
  seconds: number
  level: LearningHeatmapLevel
}

export interface LearningStatsOverview {
  todayStudySeconds: number
  currentStreakDays: number
  streakThresholdSeconds: number
  heatmapDays: LearningHeatmapDay[]
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function clampHeatmapDays(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HEATMAP_DAYS
  }

  return Math.min(MAX_HEATMAP_DAYS, Math.max(MIN_HEATMAP_DAYS, Math.round(value as number)))
}

export function getHeatmapLevel(seconds: number): LearningHeatmapLevel {
  if (seconds <= 0) {
    return 0
  }

  if (seconds < STREAK_THRESHOLD_SECONDS) {
    return 1
  }

  if (seconds < 2400) {
    return 2
  }

  if (seconds < 4800) {
    return 3
  }

  return 4
}

export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidDateKey(value: string): boolean {
  return DATE_KEY_PATTERN.test(value)
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDateKey(value: string, deltaDays: number): string {
  const date = parseDateKey(value)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return formatUtcDateKey(date)
}

export function buildDateKeyRange(endDateKey: string, days: number): string[] {
  const normalizedDays = clampHeatmapDays(days)
  const keys: string[] = []

  for (let offset = normalizedDays - 1; offset >= 0; offset -= 1) {
    keys.push(shiftDateKey(endDateKey, -offset))
  }

  return keys
}

export function formatDurationToClock(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
