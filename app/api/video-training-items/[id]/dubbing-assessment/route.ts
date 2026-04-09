import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

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
