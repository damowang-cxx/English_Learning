import { NextRequest, NextResponse } from 'next/server'

type TranslationDraftQuality = 'normal' | 'high'

interface TranslationDraftCaptionInput {
  id: string
  index: number
  speaker?: string | null
  enText: string
  prevEnText?: string | null
  nextEnText?: string | null
}

interface TranslationDraftOutput {
  translations?: Array<{
    id?: string
    zhText?: string
    needsReview?: boolean | null
    note?: string | null
  }>
}

const MODEL_BY_QUALITY: Record<TranslationDraftQuality, string> = {
  normal: 'gpt-5.4-mini',
  high: 'gpt-5.4',
}

const TRANSLATION_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          zhText: { type: 'string' },
          needsReview: { type: ['boolean', 'null'] },
          note: { type: ['string', 'null'] },
        },
        required: ['id', 'zhText', 'needsReview', 'note'],
      },
    },
  },
  required: ['translations'],
}

function normalizeQuality(value: unknown): TranslationDraftQuality | null {
  return value === 'normal' || value === 'high' ? value : null
}

function normalizeCaptions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((caption, index): TranslationDraftCaptionInput | null => {
      if (!caption || typeof caption !== 'object') {
        return null
      }

      const candidate = caption as Record<string, unknown>
      const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
      const enText = typeof candidate.enText === 'string' ? candidate.enText.trim() : ''
      const inputIndex = Number(candidate.index)
      const speaker = typeof candidate.speaker === 'string' ? candidate.speaker.trim() : ''
      const prevEnText = typeof candidate.prevEnText === 'string' ? candidate.prevEnText.trim() : ''
      const nextEnText = typeof candidate.nextEnText === 'string' ? candidate.nextEnText.trim() : ''

      if (!id || !enText) {
        return null
      }

      return {
        id,
        index: Number.isFinite(inputIndex) ? inputIndex : index,
        speaker: speaker || null,
        enText,
        prevEnText: prevEnText || null,
        nextEnText: nextEnText || null,
      }
    })
    .filter((caption): caption is TranslationDraftCaptionInput => Boolean(caption))
}

function getOutputText(responsePayload: unknown) {
  if (!responsePayload || typeof responsePayload !== 'object') {
    return ''
  }

  const payload = responsePayload as { output_text?: unknown; output?: unknown }

  if (typeof payload.output_text === 'string') {
    return payload.output_text
  }

  if (!Array.isArray(payload.output)) {
    return ''
  }

  const textParts: string[] = []

  for (const item of payload.output) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const outputItem = item as { content?: unknown }

    if (!Array.isArray(outputItem.content)) {
      continue
    }

    for (const content of outputItem.content) {
      if (!content || typeof content !== 'object') {
        continue
      }

      const contentItem = content as { text?: unknown }

      if (typeof contentItem.text === 'string') {
        textParts.push(contentItem.text)
      }
    }
  }

  return textParts.join('')
}

function normalizeOutput(payload: TranslationDraftOutput, allowedIds: Set<string>) {
  const translations = Array.isArray(payload.translations) ? payload.translations : []

  return translations
    .map((translation) => {
      const id = typeof translation.id === 'string' ? translation.id.trim() : ''

      if (!id || !allowedIds.has(id)) {
        return null
      }

      const zhText = typeof translation.zhText === 'string' ? translation.zhText.trim() : ''
      const note = typeof translation.note === 'string' ? translation.note.trim() : ''

      return {
        id,
        zhText,
        needsReview: Boolean(translation.needsReview) || !zhText,
        note,
      }
    })
    .filter((translation): translation is { id: string; zhText: string; needsReview: boolean; note: string } =>
      Boolean(translation)
    )
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY is not configured on the server.',
          status: 'openai_api_key_missing',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const modelQuality = normalizeQuality(body?.modelQuality)
    const captions = normalizeCaptions(body?.captions)

    if (!modelQuality) {
      return NextResponse.json({ error: 'modelQuality must be "normal" or "high".' }, { status: 400 })
    }

    if (captions.length === 0) {
      return NextResponse.json({ error: 'At least one caption with id and enText is required.' }, { status: 400 })
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_BY_QUALITY[modelQuality],
        instructions: [
          'Translate English subtitle lines into natural Simplified Chinese for an English-learning video product.',
          'Use speaker and neighboring lines only as context.',
          'Return one translation for each provided id.',
          'Do not change, infer, or return timing information.',
          'If a line is ambiguous or context is insufficient, set needsReview true and add a short note.',
        ].join('\n'),
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({ captions }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'video_translation_draft',
            strict: true,
            schema: TRANSLATION_DRAFT_SCHEMA,
          },
        },
      }),
    })

    const responsePayload = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          error: responsePayload?.error?.message || `OpenAI request failed: ${response.status}`,
          status: 'openai_request_failed',
        },
        { status: response.status }
      )
    }

    const outputText = getOutputText(responsePayload)
    const parsedOutput = JSON.parse(outputText) as TranslationDraftOutput
    const allowedIds = new Set(captions.map((caption) => caption.id))
    const translations = normalizeOutput(parsedOutput, allowedIds)

    return NextResponse.json({
      model: MODEL_BY_QUALITY[modelQuality],
      translations,
    })
  } catch (error) {
    console.error('Error creating video translation draft:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create translation draft' },
      { status: 500 }
    )
  }
}
