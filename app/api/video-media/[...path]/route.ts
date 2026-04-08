import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
}

function getSafeVideoPath(pathArray: string[]) {
  if (pathArray.some((segment) => segment === '..' || segment === '.')) {
    return null
  }

  const videoDir = path.resolve(process.cwd(), 'public', 'video')
  const videoPath = path.resolve(videoDir, ...pathArray)

  if (!videoPath.startsWith(videoDir)) {
    return null
  }

  return videoPath
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathArray } = await params
    const videoPath = getSafeVideoPath(pathArray)

    if (!videoPath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const stats = fs.statSync(videoPath)
    const fileSize = stats.size
    const rangeHeader = request.headers.get('range')
    const contentType = MIME_TYPES[path.extname(videoPath).toLowerCase()] || 'video/mp4'

    if (!rangeHeader) {
      const fileBuffer = fs.readFileSync(videoPath)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)

    if (!rangeMatch) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
    }

    const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0
    const end = rangeMatch[2] ? Number(rangeMatch[2]) : fileSize - 1

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
      return NextResponse.json(
        { error: 'Requested range not satisfiable' },
        {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        }
      )
    }

    const chunkEnd = Math.min(end, fileSize - 1)
    const chunkSize = chunkEnd - start + 1
    const fileDescriptor = fs.openSync(videoPath, 'r')
    const buffer = Buffer.alloc(chunkSize)

    try {
      fs.readSync(fileDescriptor, buffer, 0, chunkSize, start)
    } finally {
      fs.closeSync(fileDescriptor)
    }

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${start}-${chunkEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving video file:', error)
    return NextResponse.json({ error: 'Failed to serve video file' }, { status: 500 })
  }
}
