import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

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
  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const audioFile = formData.get('audio') as File
    const sentencesData = formData.get('sentences') as string

    if (!title || !audioFile || !sentencesData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 保存音频文件到 public/audio 目录
    const audioFileName = `${Date.now()}_${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const audioPath = `/audio/${audioFileName}`
    
    // 在 Next.js 中，我们需要使用文件系统 API
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    
    // 确保目录存在
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true })
    }

    // 保存文件
    const bytes = await audioFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    fs.writeFileSync(path.join(audioDir, audioFileName), buffer)

    // 解析句子数据
    const sentences = JSON.parse(sentencesData)

    // 创建训练条目和句子
    const trainingItem = await prisma.trainingItem.create({
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
    console.error('Error creating training item:', error)
    return NextResponse.json(
      { error: 'Failed to create training item' },
      { status: 500 }
    )
  }
}
