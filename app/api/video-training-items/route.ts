import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin } from '@/lib/authz'
import {
  isVideoTrainingDramaTag,
  isVideoTrainingTag,
  type VideoCaptionInput,
  type VideoCharacterInput,
} from '@/lib/video-training'
import {
  getUploadFile,
  normalizeCaptions,
  normalizeCharacters,
  parseJsonFormField,
} from '@/lib/video-training-admin'
import {
  deletePublicFile,
  inferPublicVideoMediaType,
  resolvePublicVideoMediaUrl,
  savePublicUploadFile,
} from '@/lib/video-training-storage'

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
        coverPositionX: item.coverPositionX,
        coverPositionY: item.coverPositionY,
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
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  const savedFiles: string[] = []

  try {
    const formData = await request.formData()
    const title = String(formData.get('title') || '').trim()
    const sourceTitle = String(formData.get('sourceTitle') || '').trim()
    const plotSummary = String(formData.get('plotSummary') || '').trim()
    const tag = String(formData.get('tag') || '').trim()
    const mediaFileName = String(formData.get('mediaFileName') || '').trim()
    const coverFile = getUploadFile(formData, 'cover')

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!isVideoTrainingTag(tag)) {
      return NextResponse.json({ error: 'Invalid tag' }, { status: 400 })
    }

    let captions: ReturnType<typeof normalizeCaptions>
    let characters: ReturnType<typeof normalizeCharacters>

    try {
      captions = normalizeCaptions(parseJsonFormField<VideoCaptionInput[]>(formData, 'captions', []), tag)
      characters = isVideoTrainingDramaTag(tag)
        ? normalizeCharacters(parseJsonFormField<VideoCharacterInput[]>(formData, 'characters', []))
        : []
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid video training payload' },
        { status: 400 }
      )
    }

    let mediaUrl = ''

    try {
      mediaUrl = resolvePublicVideoMediaUrl(mediaFileName)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid video file name' },
        { status: 400 }
      )
    }

    const mediaType = inferPublicVideoMediaType(mediaUrl)

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
