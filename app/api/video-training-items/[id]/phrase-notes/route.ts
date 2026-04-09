import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiUser } from '@/lib/authz'

async function getValidCaptionId(videoTrainingItemId: string, captionId?: string | null) {
  if (!captionId) {
    return null
  }

  const caption = await prisma.videoCaption.findFirst({
    where: {
      id: captionId,
      videoTrainingItemId,
    },
    select: {
      id: true,
    },
  })

  return caption?.id || null
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
    const userId = guard.user.id
    const notes = await prisma.videoPhraseNote.findMany({
      where: {
        videoTrainingItemId: id,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching video phrase notes:', error)
    return NextResponse.json({ error: 'Failed to fetch video phrase notes' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const { phrase, note = '', captionId = null } = await request.json()
    const normalizedPhrase = typeof phrase === 'string' ? phrase.trim() : ''

    if (!normalizedPhrase) {
      return NextResponse.json({ error: 'Phrase is required' }, { status: 400 })
    }

    const videoTrainingItem = await prisma.videoTrainingItem.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!videoTrainingItem) {
      return NextResponse.json({ error: 'Video training item not found' }, { status: 404 })
    }

    const validCaptionId = await getValidCaptionId(id, captionId)
    const phraseNote = await prisma.videoPhraseNote.create({
      data: {
        videoTrainingItemId: id,
        captionId: validCaptionId,
        phrase: normalizedPhrase,
        note: typeof note === 'string' ? note.trim() : '',
        userId: guard.user.id,
      },
    })

    return NextResponse.json(phraseNote)
  } catch (error) {
    console.error('Error creating video phrase note:', error)
    return NextResponse.json({ error: 'Failed to create video phrase note' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const { noteId, phrase, note = '', captionId = null } = await request.json()
    const normalizedNoteId = typeof noteId === 'string' ? noteId.trim() : ''
    const normalizedPhrase = typeof phrase === 'string' ? phrase.trim() : ''
    const normalizedUserId = guard.user.id

    if (!normalizedNoteId || !normalizedPhrase) {
      return NextResponse.json({ error: 'Note ID and phrase are required' }, { status: 400 })
    }

    const validCaptionId = await getValidCaptionId(id, captionId)
    const phraseNote = await prisma.videoPhraseNote.updateMany({
      where: {
        id: normalizedNoteId,
        videoTrainingItemId: id,
        userId: normalizedUserId,
      },
      data: {
        captionId: validCaptionId,
        phrase: normalizedPhrase,
        note: typeof note === 'string' ? note.trim() : '',
      },
    })

    if (phraseNote.count === 0) {
      return NextResponse.json({ error: 'Video phrase note not found' }, { status: 404 })
    }

    const updatedNote = await prisma.videoPhraseNote.findUnique({
      where: { id: normalizedNoteId },
    })

    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error('Error updating video phrase note:', error)
    return NextResponse.json({ error: 'Failed to update video phrase note' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId') || ''
    const userId = guard.user.id

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const deleted = await prisma.videoPhraseNote.deleteMany({
      where: {
        id: noteId,
        videoTrainingItemId: id,
        userId,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Video phrase note not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video phrase note:', error)
    return NextResponse.json({ error: 'Failed to delete video phrase note' }, { status: 500 })
  }
}
