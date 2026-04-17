export const DIALOGUE_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const

export type DialogueVoice = (typeof DIALOGUE_VOICES)[number]
export type DialogueEdgeResult = 'pass' | 'fail' | 'max_retry'
export type DialogueSessionStatus = 'active' | 'completed' | 'abandoned'
export type DialogueInputMode = 'text' | 'audio'
export type DialogueRouterIntent =
  | 'scene_answer'
  | 'ask_explanation'
  | 'ask_translation'
  | 'ask_hint'
  | 'control'
  | 'mixed'

export const DIALOGUE_EDGE_RESULTS = ['pass', 'fail', 'max_retry'] as const
export const DEFAULT_DIALOGUE_ROLE_VOICE: DialogueVoice = 'marin'
export const DEFAULT_DIALOGUE_COACH_VOICE: DialogueVoice = 'cedar'

export function isDialogueVoice(value: unknown): value is DialogueVoice {
  return typeof value === 'string' && DIALOGUE_VOICES.includes(value as DialogueVoice)
}

export function normalizeDialogueVoice(value: unknown, fallback: DialogueVoice): DialogueVoice {
  return isDialogueVoice(value) ? value : fallback
}

export function isDialogueEdgeResult(value: unknown): value is DialogueEdgeResult {
  return typeof value === 'string' && DIALOGUE_EDGE_RESULTS.includes(value as DialogueEdgeResult)
}

export function safeJsonStringify(value: unknown, fallback = '{}') {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback))
  } catch {
    return fallback
  }
}

export function parseJsonString<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function normalizeDialogueTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .slice(0, 8)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return normalizeDialogueTags(parsed)
      }
    } catch {
      // Fall through to comma parsing.
    }

    return trimmed
      .split(/[,，]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 8)
  }

  return []
}

export function clampDialogueRetryLimit(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 2
  }

  return Math.min(5, Math.max(0, Math.round(numericValue)))
}

export function normalizeDialoguePosition(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.round(numericValue * 100) / 100
}

export function normalizeDialogueScore(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)))
}

export function getDialogueCoverSrc(coverUrl?: string | null) {
  return coverUrl || '/Learnico.png'
}

export function getDialogueVoiceLabel(voice: string) {
  return voice.toUpperCase()
}
