import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  return NextResponse.json(
    {
      error: 'Dubbing assessment is reserved for a later release',
      status: 'not_implemented',
      videoTrainingItemId: id,
    },
    { status: 501 }
  )
}
