import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/')
    
    // 安全检查：防止路径遍历攻击
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const audioPath = path.join(process.cwd(), 'public', 'audio', filePath)
    
    // 检查文件是否存在
    if (!fs.existsSync(audioPath)) {
      console.error(`Audio file not found: ${audioPath}`)
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(audioPath)
    const fileStats = fs.statSync(audioPath)
    
    // 获取文件扩展名以确定 MIME 类型
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm'
    }
    const contentType = mimeTypes[ext] || 'audio/mpeg'

    // 返回文件，设置正确的 Content-Type 和缓存头
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (error) {
    console.error('Error serving audio file:', error)
    return NextResponse.json(
      { error: 'Failed to serve audio file' },
      { status: 500 }
    )
  }
}
