import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin, requireApiUser } from '@/lib/authz'
import { deletePublicFile } from '@/lib/video-training-storage'

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
    const item = await prisma.videoTrainingItem.findUnique({
      where: { id },
      include: {
        captions: {
          orderBy: { order: 'asc' },
          include: {
            captionNotes: {
              where: {
                userId: guard.user.id,
              },
            },
          },
        },
        characters: {
          orderBy: { order: 'asc' },
        },
        phraseNotes: {
          where: {
            userId: guard.user.id,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Video training item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching video training item:', error)
    return NextResponse.json({ error: 'Failed to fetch video training item' }, { status: 500 })
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
    return NextResponse.json({ error: 'Failed to delete video training item' }, { status: 500 })
  }
}
