import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const SAFE_FILE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g

export function sanitizeUploadFileName(fileName: string) {
  const safeName = fileName.replace(SAFE_FILE_NAME_PATTERN, '_')
  return safeName || 'upload'
}

export async function savePublicUploadFile(file: File, publicSubdir: 'video' | 'video-covers') {
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
