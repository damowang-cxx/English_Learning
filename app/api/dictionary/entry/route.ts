import { NextRequest, NextResponse } from 'next/server'
import { getECDICTEntry } from '@/lib/ecdict'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get('word') || ''

  if (!word.trim()) {
    return NextResponse.json({ entry: null }, { status: 400 })
  }

  try {
    const entry = getECDICTEntry(word)

    if (!entry) {
      return NextResponse.json({ entry: null }, { status: 404 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('Dictionary entry error:', error)
    return NextResponse.json(
      { entry: null, error: 'Dictionary unavailable.' },
      { status: 503 }
    )
  }
}
