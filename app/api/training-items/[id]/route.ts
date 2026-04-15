import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin, requireApiUser } from '@/lib/authz'
import { getUploadFile } from '@/lib/upload-form'
import { isUploadValidationError } from '@/lib/upload-validation'
import { deletePublicFile, savePublicUploadFile } from '@/lib/video-training-storage'
import fs from 'fs'
import path from 'path'

interface SentenceInput {
  text: string
  translation?: string | null
  startTime: number
  endTime: number
}

// 获取单个训练条目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const item = await prisma.trainingItem.findUnique({
      where: { id },
      include: {
        sentences: {
          orderBy: { order: 'asc' },
          include: {
            userNotes: {
              where: {
                userId: guard.user.id,
              },
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Training item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching training item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training item' },
      { status: 500 }
    )
  }
}

// 更新训练条目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  let newAudioPathToCleanup: string | null = null
  let oldAudioPathToDelete: string | null = null

  try {
    const { id } = await params
    const formData = await request.formData()
    const title = formData.get('title') as string
    const audioFile = getUploadFile(formData, 'audio')
    const sentencesData = formData.get('sentences') as string

    if (!title || !sentencesData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 检查训练条目是否存在
    const existingItem = await prisma.trainingItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Training item not found' },
        { status: 404 }
      )
    }

    let audioPath = existingItem.audioUrl

    if (audioFile && audioFile.size > 0) {
      audioPath = await savePublicUploadFile(audioFile, 'audio', 'audio')
      newAudioPathToCleanup = audioPath
      oldAudioPathToDelete = existingItem.audioUrl
    }

    // 解析句子数据
    const sentences = JSON.parse(sentencesData) as SentenceInput[]

    // 删除所有旧的句子
    await prisma.sentence.deleteMany({
      where: { trainingItemId: id }
    })

    // 更新训练条目和创建新句子
    const trainingItem = await prisma.trainingItem.update({
      where: { id },
      data: {
        title,
        audioUrl: audioPath,
        sentences: {
          create: sentences.map((s, index: number) => ({
            text: s.text,
            translation: s.translation || null,
            startTime: s.startTime,
            endTime: s.endTime,
            order: index
          }))
        }
      },
      include: {
        sentences: {
          orderBy: { order: 'asc' }
        }
      }
    })

    newAudioPathToCleanup = null
    deletePublicFile(oldAudioPathToDelete)

    return NextResponse.json(trainingItem)
  } catch (error) {
    deletePublicFile(newAudioPathToCleanup)
    console.error('Error updating training item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update training item' },
      { status: isUploadValidationError(error) ? 400 : 500 }
    )
  }
}

// 删除整篇训练条目
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

    const existingItem = await prisma.trainingItem.findUnique({
      where: { id },
      include: {
        sentences: {
          select: { id: true },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Training item not found' },
        { status: 404 }
      )
    }

    const sentenceIds = existingItem.sentences.map((sentence) => sentence.id)

    await prisma.$transaction(async (tx) => {
      if (sentenceIds.length > 0) {
        await tx.userNote.deleteMany({
          where: {
            sentenceId: {
              in: sentenceIds,
            },
          },
        })
      }

      await tx.sentence.deleteMany({
        where: { trainingItemId: id },
      })

      await tx.trainingItem.delete({
        where: { id },
      })
    })

    const audioFilePath = path.join(process.cwd(), 'public', existingItem.audioUrl.replace(/^\/+/, ''))
    if (fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath)
      } catch (error) {
        console.error('Error deleting audio file:', error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting training item:', error)
    return NextResponse.json(
      { error: 'Failed to delete training item' },
      { status: 500 }
    )
  }
}
