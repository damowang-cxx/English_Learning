export const VIDEO_TRAINING_TAGS = ['\u6f14\u8bb2', 'YouTube', '\u5f71\u89c6'] as const
export const VIDEO_TRAINING_SPEECH_TAG = VIDEO_TRAINING_TAGS[0]
export const VIDEO_TRAINING_YOUTUBE_TAG = VIDEO_TRAINING_TAGS[1]
export const VIDEO_TRAINING_DRAMA_TAG = VIDEO_TRAINING_TAGS[2]

export type VideoTrainingTag = (typeof VIDEO_TRAINING_TAGS)[number]
export type VideoCaptionMode = 'english' | 'bilingual' | 'hidden'
export type VideoAssetAction = 'keep' | 'replace' | 'remove'

export interface VideoCaptionInput {
  id?: string
  startTime: number
  endTime: number
  enText: string
  zhText?: string | null
  speaker?: string | null
  isKeySentence?: boolean
}

export interface VideoCharacterInput {
  id?: string
  name: string
  avatarField?: string | null
  avatarAction?: VideoAssetAction
}

export function isVideoTrainingTag(value: string): value is VideoTrainingTag {
  return VIDEO_TRAINING_TAGS.includes(value as VideoTrainingTag)
}

export function isVideoTrainingDramaTag(value: string) {
  return value === VIDEO_TRAINING_DRAMA_TAG
}

export function formatVideoTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds % 1) * 100)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
