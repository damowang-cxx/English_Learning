import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // 等待 params Promise 解析
    const { path: pathArray } = await params
    const filePath = pathArray.join('/')
    
    // 安全检查：防止路径遍历攻击
    // 检查路径片段中是否有 '..' 作为单独的组件（真正的路径遍历）
    const pathSegments = filePath.split('/')
    if (pathSegments.some(segment => segment === '..' || segment === '.')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    // 构建完整路径
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    const audioPath = path.join(audioDir, filePath)
    
    // 使用 path.resolve 和 path.relative 确保路径在目标目录内（防止路径遍历）
    const resolvedPath = path.resolve(audioPath)
    const resolvedDir = path.resolve(audioDir)
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }
    
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
