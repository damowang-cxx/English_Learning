import { NextRequest, NextResponse } from 'next/server'
import { getECDICTSuggestions } from '@/lib/ecdict'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''

  if (!query.trim()) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const suggestions = getECDICTSuggestions(query)
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Dictionary suggest error:', error)
    return NextResponse.json(
      { suggestions: [], error: 'Dictionary unavailable.' },
      { status: 503 }
    )
  }
}
