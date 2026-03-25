import { NextRequest, NextResponse } from 'next/server'
import { getGlobalVocabulary, toMyqwertyExportWords } from '@/lib/global-vocabulary'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default'
    const result = await getGlobalVocabulary({ userId })
    const words = toMyqwertyExportWords(result.items)

    return NextResponse.json(
      {
        version: 1,
        generatedAt: result.generatedAt,
        totalWords: words.length,
        words,
      },
      {
        headers: CORS_HEADERS,
      }
    )
  } catch (error) {
    console.error('Global vocabulary export API error:', error)
    return NextResponse.json(
      { error: 'Failed to export global vocabulary.' },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    )
  }
}
