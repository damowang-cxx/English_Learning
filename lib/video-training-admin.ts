import {
  isVideoTrainingDramaTag,
  type VideoCaptionInput,
  type VideoCharacterInput,
  type VideoTrainingTag,
} from '@/lib/video-training'

export function parseJsonFormField<T>(formData: FormData, fieldName: string, fallback: T): T {
  const rawValue = formData.get(fieldName)

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallback
  }

  return JSON.parse(rawValue) as T
}

export function getUploadFile(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName)

  if (value instanceof File && value.size > 0) {
    return value
  }

  return null
}

export function parseBooleanFormField(formData: FormData, fieldName: string) {
  const rawValue = formData.get(fieldName)
  return rawValue === 'true' || rawValue === '1' || rawValue === 'on'
}

export function normalizeCaptions(value: VideoCaptionInput[], tag: VideoTrainingTag) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('At least one caption is required.')
  }

  return value.map((caption, index) => {
    const id = typeof caption.id === 'string' ? caption.id.trim() : ''
    const startTime = Number(caption.startTime)
    const endTime = Number(caption.endTime)
    const enText = typeof caption.enText === 'string' ? caption.enText.trim() : ''
    const zhText = typeof caption.zhText === 'string' ? caption.zhText.trim() : ''
    const speaker = typeof caption.speaker === 'string' ? caption.speaker.trim() : ''

    if (!Number.isFinite(startTime) || startTime < 0) {
      throw new Error(`Caption #${index + 1} has an invalid start time.`)
    }

    if (!Number.isFinite(endTime) || endTime <= startTime) {
      throw new Error(`Caption #${index + 1} must have endTime > startTime.`)
    }

    if (!enText) {
      throw new Error(`Caption #${index + 1} is missing English text.`)
    }

    return {
      ...(id ? { id } : {}),
      startTime,
      endTime,
      enText,
      zhText: zhText || null,
      speaker: isVideoTrainingDramaTag(tag) ? (speaker || null) : null,
      isKeySentence: Boolean(caption.isKeySentence),
      order: index,
    }
  })
}

export function normalizeCharacters(value: VideoCharacterInput[]) {
  if (!Array.isArray(value)) {
    return []
  }

  const seenNames = new Set<string>()
  const characters: Array<{
    id?: string
    name: string
    avatarField: string | null
    avatarAction: 'keep' | 'replace' | 'remove'
  }> = []

  for (const character of value) {
    const id = typeof character.id === 'string' ? character.id.trim() : ''
    const name = typeof character.name === 'string' ? character.name.trim() : ''

    if (!name) {
      continue
    }

    const dedupeKey = name.toLowerCase()
    if (seenNames.has(dedupeKey)) {
      throw new Error(`Duplicate character name: ${name}`)
    }

    seenNames.add(dedupeKey)
    characters.push({
      ...(id ? { id } : {}),
      name,
      avatarField: typeof character.avatarField === 'string' ? character.avatarField : null,
      avatarAction:
        character.avatarAction === 'remove' || character.avatarAction === 'replace'
          ? character.avatarAction
          : 'keep',
    })
  }

  return characters
}
