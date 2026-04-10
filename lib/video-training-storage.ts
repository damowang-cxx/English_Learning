import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const SAFE_FILE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g
const SUPPORTED_MANUAL_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'])
const SUPPORTED_MANUAL_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a'])

export function sanitizeUploadFileName(fileName: string) {
  const safeName = fileName.replace(SAFE_FILE_NAME_PATTERN, '_')
  return safeName || 'upload'
}

export async function savePublicUploadFile(file: File, publicSubdir: 'video' | 'video-covers' | 'user-avatars') {
  const directory = path.join(process.cwd(), 'public', publicSubdir)

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }

  const fileName = `${Date.now()}_${randomUUID()}_${sanitizeUploadFileName(file.name)}`
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  fs.writeFileSync(path.join(directory, fileName), buffer)

  return `/${publicSubdir}/${fileName}`
}

export function normalizeManualVideoFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/^\/+/, '')
    .replace(/^public[\\/]+video[\\/]+/i, '')
    .replace(/^video[\\/]+/i, '')

  if (!normalized) {
    throw new Error('Video file name is required.')
  }

  if (
    normalized.includes('\0') ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.includes('..') ||
    path.isAbsolute(normalized)
  ) {
    throw new Error('Video file name must be a file name inside public/video, not a path.')
  }

  const extension = path.extname(normalized).toLowerCase()
  if (!SUPPORTED_MANUAL_VIDEO_EXTENSIONS.has(extension) && !SUPPORTED_MANUAL_AUDIO_EXTENSIONS.has(extension)) {
    throw new Error('Video file must use a supported extension: mp4, webm, mov, m4v, ogg, ogv, mp3, wav, or m4a.')
  }

  return normalized
}

export function resolvePublicVideoMediaUrl(fileName: string) {
  const normalizedFileName = normalizeManualVideoFileName(fileName)
  const videoDir = path.resolve(process.cwd(), 'public', 'video')
  const resolvedPath = path.resolve(videoDir, normalizedFileName)

  if (!resolvedPath.startsWith(`${videoDir}${path.sep}`)) {
    throw new Error('Invalid video file path.')
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`Video file not found in public/video: ${normalizedFileName}`)
  }

  return `/video/${normalizedFileName}`
}

export function inferPublicVideoMediaType(mediaUrl: string) {
  const extension = path.extname(mediaUrl).toLowerCase()
  return SUPPORTED_MANUAL_AUDIO_EXTENSIONS.has(extension) ? 'audio' : 'video'
}

export function deletePublicFile(publicPath?: string | null) {
  if (!publicPath || !publicPath.startsWith('/')) {
    return
  }

  const relativePath = publicPath.replace(/^\/+/, '')
  const resolvedPath = path.resolve(process.cwd(), 'public', relativePath)
  const resolvedPublicDir = path.resolve(process.cwd(), 'public')

  if (!resolvedPath.startsWith(resolvedPublicDir)) {
    return
  }

  if (fs.existsSync(resolvedPath)) {
    try {
      fs.unlinkSync(resolvedPath)
    } catch (error) {
      console.error(`Failed to delete public file: ${publicPath}`, error)
    }
  }
}
