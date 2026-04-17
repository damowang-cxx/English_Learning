import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import {
  getCoachVoiceForScenario,
  synthesizeDialogueSpeech,
  verifyDialogueHomeSpeechToken,
} from '@/lib/dialogue-ai'

export async function POST(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json()
    const token = String(body?.speechToken || '').trim()

    if (!token) {
      return NextResponse.json({ error: 'speechToken is required.' }, { status: 400 })
    }

    const text = verifyDialogueHomeSpeechToken(token)
    const asset = await synthesizeDialogueSpeech({
      text,
      voice: getCoachVoiceForScenario(process.env.DIALOGUE_HOME_COACH_VOICE),
      instructions: 'Speak in warm, clear Simplified Chinese as an English learning coach.',
    })

    return NextResponse.json({
      text,
      audioUrl: asset.audioUrl,
      voice: asset.voice,
      model: asset.model,
    })
  } catch (error) {
    console.error('Error speaking dialogue home coach response:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to speak dialogue home coach response' },
      { status: 500 }
    )
  }
}
