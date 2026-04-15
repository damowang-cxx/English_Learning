import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin } from '@/lib/authz'
import { getUploadFile } from '@/lib/upload-form'
import { isUploadValidationError } from '@/lib/upload-validation'
import { deletePublicFile, savePublicUploadFile } from '@/lib/video-training-storage'

interface SentenceInput {
  text: string
  translation?: string | null
  startTime: number
  endTime: number
}

// 获取所有训练条目
export async function GET() {
  try {
    const items = await prisma.trainingItem.findMany({
      include: {
        sentences: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching training items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training items' },
      { status: 500 }
    )
  }
}

// 创建新的训练条目
export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  let audioPathToCleanup: string | null = null

  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const audioFile = getUploadFile(formData, 'audio')
    const sentencesData = formData.get('sentences') as string

    if (!title || !audioFile || !sentencesData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const audioPath = await savePublicUploadFile(audioFile, 'audio', 'audio')
    audioPathToCleanup = audioPath

    // 解析句子数据
    const sentences = JSON.parse(sentencesData) as SentenceInput[]

    // 创建训练条目和句子
    const trainingItem = await prisma.trainingItem.create({
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

    audioPathToCleanup = null
    return NextResponse.json(trainingItem)
  } catch (error) {
    deletePublicFile(audioPathToCleanup)
    console.error('Error creating training item:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create training item' },
      { status: isUploadValidationError(error) ? 400 : 500 }
    )
  }
}
