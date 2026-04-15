import path from 'path'

export type UploadFilePurpose = 'avatar' | 'cover' | 'audio'

type UploadFileKind = 'image' | 'audio'

interface UploadPurposeSpec {
  label: string
  kind: UploadFileKind
  mimeTypesByExtension: Map<string, Set<string>>
}

interface DetectedUploadFile {
  kind: UploadFileKind
  extensions: Set<string>
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

const IMAGE_MIME_TYPES_BY_EXTENSION = new Map<string, Set<string>>([
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.gif', new Set(['image/gif'])],
  ['.avif', new Set(['image/avif'])],
])

const AUDIO_MIME_TYPES_BY_EXTENSION = new Map<string, Set<string>>([
  ['.mp3', new Set(['audio/mpeg', 'audio/mp3'])],
  ['.wav', new Set(['audio/wav', 'audio/wave', 'audio/x-wav'])],
  ['.ogg', new Set(['audio/ogg'])],
  ['.oga', new Set(['audio/ogg'])],
  ['.m4a', new Set(['audio/mp4', 'audio/m4a', 'audio/x-m4a'])],
  ['.webm', new Set(['audio/webm'])],
])

const UPLOAD_PURPOSE_SPECS: Record<UploadFilePurpose, UploadPurposeSpec> = {
  avatar: {
    label: 'Avatar',
    kind: 'image',
    mimeTypesByExtension: IMAGE_MIME_TYPES_BY_EXTENSION,
  },
  cover: {
    label: 'Cover',
    kind: 'image',
    mimeTypesByExtension: IMAGE_MIME_TYPES_BY_EXTENSION,
  },
  audio: {
    label: 'Audio',
    kind: 'audio',
    mimeTypesByExtension: AUDIO_MIME_TYPES_BY_EXTENSION,
  },
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';', 1)[0].trim().toLowerCase()
}

function formatExtensions(extensions: Iterable<string>) {
  return Array.from(extensions)
    .map((extension) => extension.slice(1))
    .join(', ')
}

function hasBytes(buffer: Buffer, offset: number, bytes: number[]) {
  if (buffer.length < offset + bytes.length) {
    return false
  }

  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

function hasAscii(buffer: Buffer, offset: number, value: string) {
  if (buffer.length < offset + value.length) {
    return false
  }

  return buffer.subarray(offset, offset + value.length).toString('ascii') === value
}

function detectUploadFile(buffer: Buffer): DetectedUploadFile | null {
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) {
    return { kind: 'image', extensions: new Set(['.jpg', '.jpeg']) }
  }

  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', extensions: new Set(['.png']) }
  }

  if (hasAscii(buffer, 0, 'GIF87a') || hasAscii(buffer, 0, 'GIF89a')) {
    return { kind: 'image', extensions: new Set(['.gif']) }
  }

  if (hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'WEBP')) {
    return { kind: 'image', extensions: new Set(['.webp']) }
  }

  if (hasAscii(buffer, 4, 'ftyp') && (hasAscii(buffer, 8, 'avif') || hasAscii(buffer, 8, 'avis'))) {
    return { kind: 'image', extensions: new Set(['.avif']) }
  }

  if (hasAscii(buffer, 0, 'ID3') || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return { kind: 'audio', extensions: new Set(['.mp3']) }
  }

  if (hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'WAVE')) {
    return { kind: 'audio', extensions: new Set(['.wav']) }
  }

  if (hasAscii(buffer, 0, 'OggS')) {
    return { kind: 'audio', extensions: new Set(['.ogg', '.oga']) }
  }

  if (hasBytes(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3]) && buffer.subarray(0, 128).includes(Buffer.from('webm', 'ascii'))) {
    return { kind: 'audio', extensions: new Set(['.webm']) }
  }

  if (hasAscii(buffer, 4, 'ftyp')) {
    const majorBrand = buffer.subarray(8, 12).toString('ascii')
    if (majorBrand === 'M4A ' || majorBrand === 'M4B ' || majorBrand === 'M4P ') {
      return { kind: 'audio', extensions: new Set(['.m4a']) }
    }
  }

  return null
}

export function isUploadValidationError(error: unknown): error is UploadValidationError {
  return error instanceof UploadValidationError
}

export function validateUploadFileBuffer(file: File, buffer: Buffer, purpose: UploadFilePurpose) {
  const spec = UPLOAD_PURPOSE_SPECS[purpose]
  const extension = path.extname(file.name || '').toLowerCase()
  const allowedMimeTypes = spec.mimeTypesByExtension.get(extension)

  if (!allowedMimeTypes) {
    throw new UploadValidationError(
      `${spec.label} upload must use a supported ${spec.kind} extension: ${formatExtensions(spec.mimeTypesByExtension.keys())}.`
    )
  }

  const mimeType = normalizeMimeType(file.type || '')
  if (!mimeType) {
    throw new UploadValidationError(`${spec.label} upload must include a valid MIME type.`)
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw new UploadValidationError(`${spec.label} upload MIME type does not match the file extension.`)
  }

  const detected = detectUploadFile(buffer)
  if (!detected || detected.kind !== spec.kind) {
    throw new UploadValidationError(`${spec.label} upload content is not a valid ${spec.kind} file.`)
  }

  if (!detected.extensions.has(extension)) {
    throw new UploadValidationError(`${spec.label} upload content does not match the file extension.`)
  }
}

export async function readValidatedUploadFile(file: File, purpose: UploadFilePurpose) {
  const buffer = Buffer.from(await file.arrayBuffer())
  validateUploadFileBuffer(file, buffer, purpose)
  return buffer
}
