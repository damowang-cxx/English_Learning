import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取单个训练条目详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.trainingItem.findUnique({
      where: { id: params.id },
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
