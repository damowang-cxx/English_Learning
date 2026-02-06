import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// 获取单个训练条目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const item = await prisma.trainingItem.findUnique({
      where: { id },
      include: {
        sentences: {
          orderBy: { order: 'asc' },
          include: {
            userNotes: true
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
  try {
    const { id } = await params
    const formData = await request.formData()
    const title = formData.get('title') as string
    const audioFile = formData.get('audio') as File | null
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

    // 如果提供了新的音频文件，保存它
    if (audioFile && audioFile.size > 0) {
      // 删除旧音频文件（如果存在）
      const oldAudioPath = path.join(process.cwd(), 'public', existingItem.audioUrl)
      if (fs.existsSync(oldAudioPath)) {
        try {
          fs.unlinkSync(oldAudioPath)
        } catch (error) {
          console.error('Error deleting old audio file:', error)
        }
      }

      // 保存新音频文件
      const audioFileName = `${Date.now()}_${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      audioPath = `/audio/${audioFileName}`
      
      const audioDir = path.join(process.cwd(), 'public', 'audio')
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true })
      }

      const bytes = await audioFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      fs.writeFileSync(path.join(audioDir, audioFileName), buffer)
    }

    // 解析句子数据
    const sentences = JSON.parse(sentencesData)

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
          create: sentences.map((s: any, index: number) => ({
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

    return NextResponse.json(trainingItem)
  } catch (error) {
    console.error('Error updating training item:', error)
    return NextResponse.json(
      { error: 'Failed to update training item' },
      { status: 500 }
    )
  }
}
