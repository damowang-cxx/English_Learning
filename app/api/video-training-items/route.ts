import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isVideoTrainingTag,
  type VideoCaptionInput,
  type VideoCharacterInput,
} from '@/lib/video-training'
import { deletePublicFile, savePublicUploadFile } from '@/lib/video-training-storage'

function parseJsonFormField<T>(formData: FormData, fieldName: string, fallback: T): T {
  const rawValue = formData.get(fieldName)

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallback
  }

  return JSON.parse(rawValue) as T
}

function getUploadFile(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName)

  if (value instanceof File && value.size > 0) {
    return value
  }

  return null
}

function normalizeCaptions(value: VideoCaptionInput[]) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('At least one caption is required.')
  }

  return value.map((caption, index) => {
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
      startTime,
      endTime,
      enText,
      zhText: zhText || null,
      speaker: speaker || null,
      isKeySentence: Boolean(caption.isKeySentence),
      order: index,
    }
  })
}

function normalizeCharacters(value: VideoCharacterInput[]) {
  if (!Array.isArray(value)) {
    return []
  }

  const seenNames = new Set<string>()
  const characters: Array<{ name: string; avatarField: string | null }> = []

  for (const character of value) {
    const name = typeof character.name === 'string' ? character.name.trim() : ''

    if (!name || seenNames.has(name.toLowerCase())) {
      continue
    }

    seenNames.add(name.toLowerCase())
    characters.push({
      name,
      avatarField: typeof character.avatarField === 'string' ? character.avatarField : null,
    })
  }

  return characters
}

export async function GET() {
  try {
    const items = await prisma.videoTrainingItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        characters: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            captions: true,
          },
        },
      },
    })

    return NextResponse.json(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        sourceTitle: item.sourceTitle,
        plotSummary: item.plotSummary,
        tag: item.tag,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        coverUrl: item.coverUrl,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        characters: item.characters,
        captionsCount: item._count.captions,
      }))
    )
  } catch (error) {
    console.error('Error fetching video training items:', error)
    return NextResponse.json({ error: 'Failed to fetch video training items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const savedFiles: string[] = []

  try {
    const formData = await request.formData()
    const title = String(formData.get('title') || '').trim()
    const sourceTitle = String(formData.get('sourceTitle') || '').trim()
    const plotSummary = String(formData.get('plotSummary') || '').trim()
    const tag = String(formData.get('tag') || '').trim()
    const mediaType = String(formData.get('mediaType') || 'video').trim() || 'video'
    const mediaFile = getUploadFile(formData, 'media')
    const coverFile = getUploadFile(formData, 'cover')
    const captions = normalizeCaptions(parseJsonFormField<VideoCaptionInput[]>(formData, 'captions', []))
    const characters =
      tag === '影视'
        ? normalizeCharacters(parseJsonFormField<VideoCharacterInput[]>(formData, 'characters', []))
        : []

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!isVideoTrainingTag(tag)) {
      return NextResponse.json({ error: 'Invalid tag' }, { status: 400 })
    }

    if (!mediaFile) {
      return NextResponse.json({ error: 'Media file is required' }, { status: 400 })
    }

    const mediaUrl = await savePublicUploadFile(mediaFile, 'video')
    savedFiles.push(mediaUrl)

    const coverUrl = coverFile ? await savePublicUploadFile(coverFile, 'video-covers') : null

    if (coverUrl) {
      savedFiles.push(coverUrl)
    }

    const characterCreates = []

    for (const [index, character] of characters.entries()) {
      const avatarFile = character.avatarField ? getUploadFile(formData, character.avatarField) : null
      const avatarUrl = avatarFile ? await savePublicUploadFile(avatarFile, 'video-covers') : null

      if (avatarUrl) {
        savedFiles.push(avatarUrl)
      }

      characterCreates.push({
        name: character.name,
        avatarUrl,
        order: index,
      })
    }

    const videoTrainingItem = await prisma.videoTrainingItem.create({
      data: {
        title,
        sourceTitle,
        plotSummary,
        tag,
        mediaType,
        mediaUrl,
        coverUrl,
        captions: {
          create: captions,
        },
        characters: {
          create: characterCreates,
        },
      },
      include: {
        captions: {
          orderBy: { order: 'asc' },
        },
        characters: {
          orderBy: { order: 'asc' },
        },
        phraseNotes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json(videoTrainingItem)
  } catch (error) {
    savedFiles.forEach(deletePublicFile)
    console.error('Error creating video training item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create video training item' },
      { status: 500 }
    )
  }
}
