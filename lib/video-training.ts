export const VIDEO_TRAINING_TAGS = ['演讲', '影视'] as const

export type VideoTrainingTag = (typeof VIDEO_TRAINING_TAGS)[number]
export type VideoCaptionMode = 'english' | 'bilingual' | 'hidden'

export interface VideoCaptionInput {
  startTime: number
  endTime: number
  enText: string
  zhText?: string | null
  speaker?: string | null
  isKeySentence?: boolean
}

export interface VideoCharacterInput {
  name: string
  avatarField?: string | null
}

export function isVideoTrainingTag(value: string): value is VideoTrainingTag {
  return VIDEO_TRAINING_TAGS.includes(value as VideoTrainingTag)
}

export function formatVideoTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds % 1) * 100)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
