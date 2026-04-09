import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiUser } from '@/lib/authz'

export async function GET(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const captionId = request.nextUrl.searchParams.get('captionId') || ''
    const videoTrainingItemId = request.nextUrl.searchParams.get('videoTrainingItemId') || ''
    const userId = guard.user.id

    if (captionId) {
      const note = await prisma.videoCaptionNote.findUnique({
        where: {
          videoCaptionId_userId: {
            videoCaptionId: captionId,
            userId,
          },
        },
      })

      return NextResponse.json(note || { words: '', notes: '' })
    }

    if (videoTrainingItemId) {
      const notes = await prisma.videoCaptionNote.findMany({
        where: {
          userId,
          caption: {
            videoTrainingItemId,
          },
        },
        select: {
          id: true,
          videoCaptionId: true,
          words: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json(notes)
    }

    return NextResponse.json({ error: 'captionId or videoTrainingItemId is required' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching video caption notes:', error)
    return NextResponse.json({ error: 'Failed to fetch video caption notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { captionId, words, notes } = await request.json()
    const normalizedCaptionId = typeof captionId === 'string' ? captionId.trim() : ''
    const userId = guard.user.id

    if (!normalizedCaptionId) {
      return NextResponse.json({ error: 'captionId is required' }, { status: 400 })
    }

    const caption = await prisma.videoCaption.findUnique({
      where: { id: normalizedCaptionId },
      select: { id: true },
    })

    if (!caption) {
      return NextResponse.json({ error: 'Video caption not found' }, { status: 404 })
    }

    const note = await prisma.videoCaptionNote.upsert({
      where: {
        videoCaptionId_userId: {
          videoCaptionId: normalizedCaptionId,
          userId,
        },
      },
      update: {
        words: typeof words === 'string' ? words : '',
        notes: typeof notes === 'string' ? notes : '',
      },
      create: {
        videoCaptionId: normalizedCaptionId,
        userId,
        words: typeof words === 'string' ? words : '',
        notes: typeof notes === 'string' ? notes : '',
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error saving video caption note:', error)
    return NextResponse.json({ error: 'Failed to save video caption note' }, { status: 500 })
  }
}
