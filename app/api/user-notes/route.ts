import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取或创建用户笔记
export async function POST(request: NextRequest) {
  try {
    const { sentenceId, words, notes, userId = 'default' } = await request.json()

    if (!sentenceId) {
      return NextResponse.json(
        { error: 'Sentence ID is required' },
        { status: 400 }
      )
    }

    // 使用 upsert 来创建或更新笔记
    const userNote = await prisma.userNote.upsert({
      where: {
        sentenceId_userId: {
          sentenceId,
          userId
        }
      },
      update: {
        words: words || '',
        notes: notes || ''
      },
      create: {
        sentenceId,
        userId,
        words: words || '',
        notes: notes || ''
      }
    })

    return NextResponse.json(userNote)
  } catch (error) {
    console.error('Error saving user note:', error)
    return NextResponse.json(
      { error: 'Failed to save user note' },
      { status: 500 }
    )
  }
}

// 获取用户笔记
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sentenceId = searchParams.get('sentenceId')
    const userId = searchParams.get('userId') || 'default'

    if (!sentenceId) {
      return NextResponse.json(
        { error: 'Sentence ID is required' },
        { status: 400 }
      )
    }

    const userNote = await prisma.userNote.findUnique({
      where: {
        sentenceId_userId: {
          sentenceId,
          userId
        }
      }
    })

    return NextResponse.json(userNote || { words: '', notes: '' })
  } catch (error) {
    console.error('Error fetching user note:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user note' },
      { status: 500 }
    )
  }
}
