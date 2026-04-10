import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin, requireApiUser } from '@/lib/authz'
import {
  isVideoTrainingDramaTag,
  isVideoTrainingTag,
  type VideoCaptionInput,
  type VideoCharacterInput,
  type VideoTrainingTag,
} from '@/lib/video-training'
import {
  getUploadFile,
  normalizeCaptions,
  normalizeCharacters,
  parseBooleanFormField,
  parseJsonFormField,
} from '@/lib/video-training-admin'
import {
  deletePublicFile,
  inferPublicVideoMediaType,
  resolvePublicVideoMediaUrl,
  savePublicUploadFile,
} from '@/lib/video-training-storage'

async function getVideoTrainingItemForResponse(id: string, userId: string) {
  return prisma.videoTrainingItem.findUnique({
    where: { id },
    include: {
      captions: {
        orderBy: { order: 'asc' },
        include: {
          captionNotes: {
            where: {
              userId,
            },
          },
        },
      },
      characters: {
        orderBy: { order: 'asc' },
      },
      phraseNotes: {
        where: {
          userId,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

function buildErrorResponse(error: unknown, fallbackMessage: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status }
  )
}

function validateReferencedIds(
  itemName: string,
  submittedIds: string[],
  existingIds: Set<string>
) {
  for (const submittedId of submittedIds) {
    if (!existingIds.has(submittedId)) {
      throw new Error(`Unknown ${itemName} id: ${submittedId}`)
    }
  }
}

function validateCaptionSpeakers(
  tag: VideoTrainingTag,
  captions: Array<{ speaker: string | null }>,
  characters: Array<{ name: string }>
) {
  if (!isVideoTrainingDramaTag(tag)) {
    return
  }

  const characterNames = new Set(characters.map((character) => character.name))

  for (const [index, caption] of captions.entries()) {
    if (caption.speaker && !characterNames.has(caption.speaker)) {
      throw new Error(`Caption #${index + 1} references an unknown speaker: ${caption.speaker}`)
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const item = await getVideoTrainingItemForResponse(id, guard.user.id)

    if (!item) {
      return NextResponse.json({ error: 'Video training item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching video training item:', error)
    return buildErrorResponse(error, 'Failed to fetch video training item')
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  const newFilesToCleanup = new Set<string>()
  const oldFilesToDelete = new Set<string>()

  try {
    const { id } = await params
    const existingItem = await prisma.videoTrainingItem.findUnique({
      where: { id },
      include: {
        captions: {
          orderBy: { order: 'asc' },
        },
        characters: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Video training item not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const title = String(formData.get('title') || '').trim()
    const sourceTitle = String(formData.get('sourceTitle') || '').trim()
    const plotSummary = String(formData.get('plotSummary') || '').trim()
    const rawTag = String(formData.get('tag') || '').trim()
    const mediaFileName = String(formData.get('mediaFileName') || '').trim()
    const coverFile = getUploadFile(formData, 'cover')
    const removeCover = parseBooleanFormField(formData, 'removeCover')

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!isVideoTrainingTag(rawTag)) {
      return NextResponse.json({ error: 'Invalid tag' }, { status: 400 })
    }

    let mediaUrl = ''
    try {
      mediaUrl = resolvePublicVideoMediaUrl(mediaFileName)
    } catch (error) {
      return buildErrorResponse(error, 'Invalid video file name', 400)
    }

    const tag = rawTag
    const mediaType = inferPublicVideoMediaType(mediaUrl)
    const existingCaptionIds = new Set(existingItem.captions.map((caption) => caption.id))
    const existingCharacterIds = new Set(existingItem.characters.map((character) => character.id))

    let captions: ReturnType<typeof normalizeCaptions>
    let characters: ReturnType<typeof normalizeCharacters>

    try {
      captions = normalizeCaptions(parseJsonFormField<VideoCaptionInput[]>(formData, 'captions', []), tag)
      characters = isVideoTrainingDramaTag(tag)
        ? normalizeCharacters(parseJsonFormField<VideoCharacterInput[]>(formData, 'characters', []))
        : []

      validateReferencedIds(
        'caption',
        captions.map((caption) => caption.id).filter((value): value is string => Boolean(value)),
        existingCaptionIds
      )
      validateReferencedIds(
        'character',
        characters.map((character) => character.id).filter((value): value is string => Boolean(value)),
        existingCharacterIds
      )

      validateCaptionSpeakers(tag, captions, characters)
    } catch (error) {
      return buildErrorResponse(error, 'Invalid video training payload', 400)
    }

    let nextCoverUrl = existingItem.coverUrl
    if (coverFile) {
      nextCoverUrl = await savePublicUploadFile(coverFile, 'video-covers')
      newFilesToCleanup.add(nextCoverUrl)
      if (existingItem.coverUrl) {
        oldFilesToDelete.add(existingItem.coverUrl)
      }
    } else if (removeCover) {
      nextCoverUrl = null
      if (existingItem.coverUrl) {
        oldFilesToDelete.add(existingItem.coverUrl)
      }
    }

    const existingCharactersById = new Map(existingItem.characters.map((character) => [character.id, character]))
    const nextCharacters: Array<{
      id?: string
      name: string
      avatarUrl: string | null
      order: number
    }> = []

    for (const [index, character] of characters.entries()) {
      const existingCharacter = character.id ? existingCharactersById.get(character.id) || null : null
      const avatarFile = character.avatarField ? getUploadFile(formData, character.avatarField) : null
      let avatarUrl = existingCharacter?.avatarUrl || null

      if (avatarFile) {
        avatarUrl = await savePublicUploadFile(avatarFile, 'video-covers')
        newFilesToCleanup.add(avatarUrl)
        if (existingCharacter?.avatarUrl) {
          oldFilesToDelete.add(existingCharacter.avatarUrl)
        }
      } else if (character.avatarAction === 'remove') {
        avatarUrl = null
        if (existingCharacter?.avatarUrl) {
          oldFilesToDelete.add(existingCharacter.avatarUrl)
        }
      }

      nextCharacters.push({
        ...(character.id ? { id: character.id } : {}),
        name: character.name,
        avatarUrl,
        order: index,
      })
    }

    const submittedCharacterIds = new Set(
      nextCharacters.map((character) => character.id).filter((value): value is string => Boolean(value))
    )
    for (const existingCharacter of existingItem.characters) {
      if (!submittedCharacterIds.has(existingCharacter.id) && existingCharacter.avatarUrl) {
        oldFilesToDelete.add(existingCharacter.avatarUrl)
      }
    }

    const submittedCaptionIds = new Set(
      captions.map((caption) => caption.id).filter((value): value is string => Boolean(value))
    )
    const captionIdsToDelete = existingItem.captions
      .filter((caption) => !submittedCaptionIds.has(caption.id))
      .map((caption) => caption.id)
    const characterIdsToDelete = existingItem.characters
      .filter((character) => !submittedCharacterIds.has(character.id))
      .map((character) => character.id)

    await prisma.$transaction(async (tx) => {
      await tx.videoTrainingItem.update({
        where: { id },
        data: {
          title,
          sourceTitle,
          plotSummary,
          tag,
          mediaType,
          mediaUrl,
          coverUrl: nextCoverUrl,
        },
      })

      if (captionIdsToDelete.length > 0) {
        await tx.videoCaption.deleteMany({
          where: {
            id: {
              in: captionIdsToDelete,
            },
          },
        })
      }

      for (const caption of captions) {
        const captionData = {
          startTime: caption.startTime,
          endTime: caption.endTime,
          enText: caption.enText,
          zhText: caption.zhText,
          speaker: caption.speaker,
          isKeySentence: caption.isKeySentence,
          order: caption.order,
        }

        if (caption.id) {
          await tx.videoCaption.update({
            where: { id: caption.id },
            data: captionData,
          })
          continue
        }

        await tx.videoCaption.create({
          data: {
            videoTrainingItemId: id,
            ...captionData,
          },
        })
      }

      if (characterIdsToDelete.length > 0) {
        await tx.videoCharacter.deleteMany({
          where: {
            id: {
              in: characterIdsToDelete,
            },
          },
        })
      }

      const existingCharacterUpdates = nextCharacters.filter((character) => character.id)
      for (const character of existingCharacterUpdates) {
        await tx.videoCharacter.update({
          where: { id: character.id },
          data: {
            name: `__tmp__${character.id}`,
            order: character.order,
          },
        })
      }

      for (const character of nextCharacters) {
        const characterData = {
          name: character.name,
          avatarUrl: character.avatarUrl,
          order: character.order,
        }

        if (character.id) {
          await tx.videoCharacter.update({
            where: { id: character.id },
            data: characterData,
          })
          continue
        }

        await tx.videoCharacter.create({
          data: {
            videoTrainingItemId: id,
            ...characterData,
          },
        })
      }
    })

    oldFilesToDelete.forEach((filePath) => deletePublicFile(filePath))

    const updatedItem = await getVideoTrainingItemForResponse(id, guard.user.id)
    if (!updatedItem) {
      throw new Error('Video training item not found after update.')
    }

    return NextResponse.json(updatedItem)
  } catch (error) {
    newFilesToCleanup.forEach((filePath) => deletePublicFile(filePath))
    console.error('Error updating video training item:', error)
    return buildErrorResponse(error, 'Failed to update video training item')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const existingItem = await prisma.videoTrainingItem.findUnique({
      where: { id },
      include: {
        characters: true,
      },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Video training item not found' }, { status: 404 })
    }

    await prisma.videoTrainingItem.delete({
      where: { id },
    })

    deletePublicFile(existingItem.mediaUrl)
    deletePublicFile(existingItem.coverUrl)
    existingItem.characters.forEach((character) => deletePublicFile(character.avatarUrl))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video training item:', error)
    return buildErrorResponse(error, 'Failed to delete video training item')
  }
}
