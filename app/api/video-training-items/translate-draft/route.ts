import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { captions } = await request.json()
    const captionCount = Array.isArray(captions) ? captions.length : 0

    return NextResponse.json(
      {
        error: 'Translation provider not configured',
        status: 'provider_not_configured',
        captionCount,
        drafts: [],
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error creating translation draft:', error)
    return NextResponse.json({ error: 'Failed to create translation draft' }, { status: 500 })
  }
}
