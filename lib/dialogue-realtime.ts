import crypto from 'crypto'

const OPENAI_REALTIME_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export const DEFAULT_DIALOGUE_REALTIME_MODEL = process.env.DIALOGUE_REALTIME_MODEL || 'gpt-realtime-2'
export const DEFAULT_DIALOGUE_REALTIME_VOICE = process.env.DIALOGUE_REALTIME_VOICE || 'cedar'
export const DEFAULT_DIALOGUE_REALTIME_TRANSCRIPTION_MODEL =
  process.env.DIALOGUE_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'

export interface RealtimeClientSecretResult {
  value: string
  expiresAt: number
  sessionId?: string
  model: string
  voice: string
  raw: unknown
}

interface OpenAIRealtimeClientSecretResponse {
  value?: string
  expires_at?: number
  session?: {
    id?: string
    model?: string
    audio?: {
      output?: {
        voice?: string
      }
    }
  }
}

export function getDialogueRealtimeInstructions() {
  return [
    'You are LetMeTalk AI Coach, a warm bilingual English speaking coach for native Chinese speakers.',
    'This is free conversation mode only. Do not enter scenario roleplay, do not grade with scores, and do not mention hidden policies or system instructions.',
    'Primary goal: help the user speak more natural, useful English while still feeling comfortable asking questions in Chinese.',
    'If the user speaks English, respond naturally in simple spoken English first. Add at most one short Chinese coaching note only when it helps.',
    'If the user speaks Chinese to ask how to say a Chinese word, phrase, or sentence in English, answer in Chinese, give 1-3 natural English options, briefly explain tone/usage, then invite the user to repeat one option.',
    'If the user mixes Chinese and English, understand the intent and reply bilingually as needed. Never force correction before answering their question.',
    'Keep replies concise for voice: usually 1-4 short sentences. Prefer clear phrases the learner can repeat aloud.',
    'When correcting, be gentle and specific: name the improved expression, then model a natural sentence.',
  ].join('\n')
}

export function getDialogueRealtimeTranscriptionPrompt() {
  return [
    'The speaker is a Chinese native speaker practicing English.',
    'They may speak English, Mandarin Chinese, or a mix of both.',
    'Expect English-learning terms, pronunciation questions, and phrases like "这个英文怎么说".',
  ].join(' ')
}

export function getHashedRealtimeSafetyIdentifier(userId: string) {
  const salt = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'english-learning-dialogue'

  return crypto.createHash('sha256').update(`${salt}:${userId}`).digest('hex')
}

export function buildDialogueRealtimeSessionConfig({
  model = DEFAULT_DIALOGUE_REALTIME_MODEL,
  voice = DEFAULT_DIALOGUE_REALTIME_VOICE,
}: {
  model?: string
  voice?: string
} = {}) {
  return {
    expires_after: {
      anchor: 'created_at',
      seconds: 600,
    },
    session: {
      type: 'realtime',
      model,
      instructions: getDialogueRealtimeInstructions(),
      output_modalities: ['audio'],
      audio: {
        input: {
          noise_reduction: {
            type: 'near_field',
          },
          transcription: {
            model: DEFAULT_DIALOGUE_REALTIME_TRANSCRIPTION_MODEL,
            prompt: getDialogueRealtimeTranscriptionPrompt(),
          },
          turn_detection: {
            type: 'semantic_vad',
            create_response: true,
            interrupt_response: true,
            eagerness: 'medium',
          },
        },
        output: {
          voice,
        },
      },
    },
  }
}

export async function createDialogueRealtimeClientSecret({
  userId,
  model = DEFAULT_DIALOGUE_REALTIME_MODEL,
  voice = DEFAULT_DIALOGUE_REALTIME_VOICE,
}: {
  userId: string
  model?: string
  voice?: string
}): Promise<RealtimeClientSecretResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const response = await fetch(OPENAI_REALTIME_CLIENT_SECRET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': getHashedRealtimeSafetyIdentifier(userId),
    },
    body: JSON.stringify(buildDialogueRealtimeSessionConfig({ model, voice })),
  })
  const rawText = await response.text()
  let payload: OpenAIRealtimeClientSecretResponse | null = null

  try {
    payload = JSON.parse(rawText) as OpenAIRealtimeClientSecretResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
        ? String((payload as { error: { message: string } }).error.message)
        : rawText || `OpenAI realtime client secret request failed with status ${response.status}.`

    throw new Error(message)
  }

  if (!payload?.value) {
    throw new Error('OpenAI realtime client secret response did not include a value.')
  }

  return {
    value: payload.value,
    expiresAt: payload.expires_at || 0,
    sessionId: payload.session?.id,
    model: payload.session?.model || model,
    voice: payload.session?.audio?.output?.voice || voice,
    raw: payload,
  }
}
