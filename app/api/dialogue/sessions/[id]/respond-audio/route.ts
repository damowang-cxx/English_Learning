import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { transcribeDialogueAudio } from '@/lib/dialogue-ai'
import { respondToDialogueSession } from '@/lib/dialogue-flow'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const formData = await request.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio file is required.' }, { status: 400 })
    }

    const transcriptText = await transcribeDialogueAudio(audio)
    const payload = await respondToDialogueSession({
      sessionId: id,
      userId: guard.user.id,
      text: transcriptText,
      inputMode: 'audio',
      transcriptText,
    })

    return NextResponse.json({
      ...payload,
      transcriptText,
    })
  } catch (error) {
    console.error('Error responding to dialogue session with audio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit dialogue audio' },
      { status: 500 }
    )
  }
}
