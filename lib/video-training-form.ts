import {
  VIDEO_TRAINING_DRAMA_TAG,
  type VideoTrainingTag,
  type VideoAssetAction,
} from '@/lib/video-training'

export interface ParsedSubtitleCue {
  startTime: number
  endTime: number
  text: string
}

export type VideoCaptionTranslationStatus = 'empty' | 'draft' | 'manual'

export interface VideoCaptionDraft {
  id?: string
  localId: string
  startTime: number
  endTime: number
  enText: string
  zhText: string
  speaker: string
  needsReview: boolean
  translationStatus?: VideoCaptionTranslationStatus
  translationNote?: string
  translationNeedsReview?: boolean
}

export interface VideoCharacterDraft {
  id?: string
  localId: string
  name: string
  avatarFile: File | null
  avatarAction: VideoAssetAction
  currentAvatarUrl?: string | null
}

export interface ImportedJsonCaptionRecord {
  id?: string
  index?: number | string
  en?: string
  enText?: string
  zh?: string
  zhText?: string
  start?: number | string
  startTime?: number | string
  end?: number | string
  endTime?: number | string
  speaker?: string
}

export interface TranslationDraftResult {
  id: string
  zhText?: string
  needsReview?: boolean
  note?: string
}

export function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createEmptyVideoCaptionDraft(previousEndTime = 0): VideoCaptionDraft {
  return {
    localId: createLocalId(),
    startTime: previousEndTime,
    endTime: previousEndTime + 2,
    enText: '',
    zhText: '',
    speaker: '',
    needsReview: false,
    translationStatus: 'empty',
  }
}

export function createVideoCaptionDraftFromItem(caption: {
  id: string
  startTime: number
  endTime: number
  enText: string
  zhText?: string | null
  speaker?: string | null
}) {
  return {
    id: caption.id,
    localId: caption.id,
    startTime: caption.startTime,
    endTime: caption.endTime,
    enText: caption.enText,
    zhText: caption.zhText || '',
    speaker: caption.speaker || '',
    needsReview: false,
    translationStatus: caption.zhText ? 'manual' : 'empty',
    translationNeedsReview: false,
    translationNote: '',
  } satisfies VideoCaptionDraft
}

export function createVideoCharacterDraftFromItem(character: {
  id: string
  name: string
  avatarUrl?: string | null
}) {
  return {
    id: character.id,
    localId: character.id,
    name: character.name,
    avatarFile: null,
    avatarAction: 'keep',
    currentAvatarUrl: character.avatarUrl || null,
  } satisfies VideoCharacterDraft
}

export function getVideoCharacterNames(characters: VideoCharacterDraft[]) {
  return characters.map((character) => character.name.trim()).filter(Boolean)
}

export function updateCaptionSpeakerAfterCharacterRename(
  captions: VideoCaptionDraft[],
  previousName: string,
  nextName: string
) {
  if (!previousName || previousName === nextName) {
    return captions
  }

  return captions.map((caption) =>
    caption.speaker === previousName
      ? { ...caption, speaker: nextName }
      : caption
  )
}

export function clearCaptionSpeakerByCharacterName(captions: VideoCaptionDraft[], characterName: string) {
  if (!characterName) {
    return captions
  }

  return captions.map((caption) =>
    caption.speaker === characterName
      ? { ...caption, speaker: '' }
      : caption
  )
}

export function clearAllCaptionSpeakers(captions: VideoCaptionDraft[]) {
  return captions.map((caption) => (
    caption.speaker
      ? { ...caption, speaker: '' }
      : caption
  ))
}

export function parseSubtitleTime(value: string) {
  const normalized = value.trim().replace(',', '.')
  const parts = normalized.split(':')

  if (parts.length < 2 || parts.length > 3) {
    return Number.NaN
  }

  const seconds = Number(parts[parts.length - 1])
  const minutes = Number(parts[parts.length - 2])
  const hours = parts.length === 3 ? Number(parts[0]) : 0

  if (!Number.isFinite(seconds) || !Number.isFinite(minutes) || !Number.isFinite(hours)) {
    return Number.NaN
  }

  return hours * 3600 + minutes * 60 + seconds
}

export function cleanSubtitleText(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\{\\[^}]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSubtitleText(rawText: string) {
  const blocks = rawText
    .replace(/\r/g, '')
    .replace(/^\uFEFF/, '')
    .split(/\n{2,}/)
  const cues: ParsedSubtitleCue[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0 || lines[0].toUpperCase().startsWith('WEBVTT')) {
      continue
    }

    const timeLineIndex = lines.findIndex((line) => line.includes('-->'))

    if (timeLineIndex < 0) {
      continue
    }

    const [rawStart, rawEndWithSettings] = lines[timeLineIndex].split('-->').map((part) => part.trim())
    const rawEnd = rawEndWithSettings.split(/\s+/)[0]
    const startTime = parseSubtitleTime(rawStart)
    const endTime = parseSubtitleTime(rawEnd)
    const text = cleanSubtitleText(lines.slice(timeLineIndex + 1).join(' '))

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime || !text) {
      continue
    }

    cues.push({ startTime, endTime, text })
  }

  return cues
}

function getOverlapSeconds(left: ParsedSubtitleCue, right: ParsedSubtitleCue) {
  return Math.max(0, Math.min(left.endTime, right.endTime) - Math.max(left.startTime, right.startTime))
}

export function mergeCaptionTracks(enCues: ParsedSubtitleCue[], zhCues: ParsedSubtitleCue[]) {
  if (zhCues.length === 0) {
    return enCues.map((cue) => ({
      localId: createLocalId(),
      startTime: cue.startTime,
      endTime: cue.endTime,
      enText: cue.text,
      zhText: '',
      speaker: '',
      needsReview: false,
      translationStatus: 'empty',
    })) satisfies VideoCaptionDraft[]
  }

  if (enCues.length === zhCues.length) {
    return enCues.map((cue, index) => ({
      localId: createLocalId(),
      startTime: cue.startTime,
      endTime: cue.endTime,
      enText: cue.text,
      zhText: zhCues[index]?.text || '',
      speaker: '',
      needsReview: false,
      translationStatus: zhCues[index]?.text ? 'draft' : 'empty',
    })) satisfies VideoCaptionDraft[]
  }

  return enCues.map((cue) => {
    const bestCue = zhCues
      .map((zhCue) => ({
        cue: zhCue,
        overlap: getOverlapSeconds(cue, zhCue),
        distance: Math.abs(cue.startTime - zhCue.startTime),
      }))
      .sort((left, right) => {
        if (right.overlap !== left.overlap) {
          return right.overlap - left.overlap
        }

        return left.distance - right.distance
      })[0]

    return {
      localId: createLocalId(),
      startTime: cue.startTime,
      endTime: cue.endTime,
      enText: cue.text,
      zhText: bestCue?.cue.text || '',
      speaker: '',
      needsReview: !bestCue || bestCue.overlap === 0,
      translationStatus: bestCue?.cue.text ? 'draft' : 'empty',
      translationNeedsReview: !bestCue || bestCue.overlap === 0,
    }
  }) satisfies VideoCaptionDraft[]
}

function normalizeJsonCaptionRecord(record: ImportedJsonCaptionRecord, fallbackIndex: number): VideoCaptionDraft {
  const enText = typeof record.enText === 'string' ? record.enText.trim() : typeof record.en === 'string' ? record.en.trim() : ''
  const zhText = typeof record.zhText === 'string' ? record.zhText.trim() : typeof record.zh === 'string' ? record.zh.trim() : ''
  const startTime = Number(record.startTime ?? record.start)
  const endTime = Number(record.endTime ?? record.end)
  const speaker = typeof record.speaker === 'string' ? record.speaker.trim() : ''

  if (!enText) {
    throw new Error(`JSON caption #${fallbackIndex + 1} is missing enText/en.`)
  }

  if (!Number.isFinite(startTime) || startTime < 0) {
    throw new Error(`JSON caption #${fallbackIndex + 1} has an invalid start/startTime.`)
  }

  if (!Number.isFinite(endTime) || endTime <= startTime) {
    throw new Error(`JSON caption #${fallbackIndex + 1} must have end/endTime > start/startTime.`)
  }

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined,
    localId: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createLocalId(),
    startTime,
    endTime,
    enText,
    zhText,
    speaker,
    needsReview: false,
    translationStatus: zhText ? 'draft' : 'empty',
  }
}

export function parseJsonCaptions(rawText: string) {
  const parsed = JSON.parse(rawText)

  if (!Array.isArray(parsed)) {
    throw new Error('The JSON root must be an array.')
  }

  const orderedRecords = (parsed as ImportedJsonCaptionRecord[]).every((record) => record && record.index !== undefined)
    ? [...parsed as ImportedJsonCaptionRecord[]].sort((left, right) => Number(left.index) - Number(right.index))
    : parsed as ImportedJsonCaptionRecord[]

  return orderedRecords.map((record, index) => normalizeJsonCaptionRecord(record, index))
}

export function extractVideoMediaFileName(mediaUrl: string) {
  const trimmed = (mediaUrl || '').trim()

  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('/video/')) {
    return trimmed.slice('/video/'.length)
  }

  try {
    const parsedUrl = new URL(trimmed)
    const pathname = parsedUrl.pathname || ''
    return pathname.slice(pathname.lastIndexOf('/') + 1)
  } catch {
    return trimmed.slice(trimmed.lastIndexOf('/') + 1)
  }
}

export function buildVideoCaptionPayload(captions: VideoCaptionDraft[], tag: VideoTrainingTag) {
  return captions.map((caption) => ({
    ...(caption.id ? { id: caption.id } : {}),
    startTime: caption.startTime,
    endTime: caption.endTime,
    enText: caption.enText.trim(),
    zhText: caption.zhText.trim() || null,
    speaker: tag === VIDEO_TRAINING_DRAMA_TAG ? caption.speaker.trim() || null : null,
    isKeySentence: false,
  }))
}
