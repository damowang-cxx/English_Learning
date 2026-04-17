import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/authz'
import { synthesizeDialogueSpeech } from '@/lib/dialogue-ai'
import { normalizeDialogueVoice, DEFAULT_DIALOGUE_ROLE_VOICE } from '@/lib/dialogue'

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json()
    const text = String(body?.text || 'Hello, I am your dialogue coach.').trim()
    const voice = normalizeDialogueVoice(body?.voice, DEFAULT_DIALOGUE_ROLE_VOICE)
    const language = body?.language === 'zh' ? 'zh' : 'en'
    const instructions =
      language === 'zh'
        ? 'Speak in warm, clear Simplified Chinese as an English coach.'
        : 'Speak in clear natural English for an English learner.'
    const asset = await synthesizeDialogueSpeech({
      text,
      voice,
      instructions,
    })

    return NextResponse.json({
      text,
      voice: asset.voice,
      model: asset.model,
      audioUrl: asset.audioUrl,
    })
  } catch (error) {
    console.error('Error creating dialogue voice preview:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create voice preview' },
      { status: 500 }
    )
  }
}
