import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_DIALOGUE_COACH_VOICE,
  DEFAULT_DIALOGUE_ROLE_VOICE,
  normalizeDialogueScore,
  normalizeDialogueVoice,
  safeJsonStringify,
  type DialogueRouterIntent,
} from '@/lib/dialogue'

export interface DialogueAiScenarioContext {
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
}

export interface DialogueAiNodeContext {
  id: string
  title: string
  roleLineEn: string
  roleLineZh: string | null
  goal: string
  rubricJson: string
  hintJson: string
  sampleAnswer: string
  retryLimit: number
  allowDynamicFollowup: boolean
}

export interface DialogueRouterOutput {
  intent: DialogueRouterIntent
  confidence: number
  sceneAnswerText: string | null
  questionText: string | null
  controlAction: 'retry' | 'continue' | 'exit' | 'repeat' | null
}

export interface DialogueEvaluatorOutput {
  passed: boolean
  score: number
  goal_achieved: boolean
  covered_points: string[]
  missing_points: string[]
  major_issue: string | null
  coach_feedback_zh: string
  better_answer_en: string
  next_action: 'advance' | 'retry' | 'offer_hint'
}

export interface DialogueCoachOutput {
  coach_reply_zh: string
  vocab_notes: string[]
  grammar_notes: string[]
  better_answer_en: string | null
  invite_retry: boolean
  tts_text_zh: string
}

export interface DialogueRoleOutput {
  role_reply_en: string
  emotion: 'normal' | 'encouraging' | 'confused' | 'corrective'
  tts_instructions: string
}

export interface DialogueHomeCoachScenarioContext {
  id: string
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
  tags: string[]
  nodesCount: number
}

export interface DialogueHomeCoachMessage {
  role: 'user' | 'coach'
  text: string
}

export interface DialogueHomeCoachOutput {
  replyZh: string
  suggestedScenarioIds: string[]
  studyTips: string[]
  followupQuestion: string | null
  ttsTextZh: string
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'
const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'video/webm',
  'video/mp4',
])

const ROUTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: {
      type: 'string',
      enum: ['scene_answer', 'ask_explanation', 'ask_translation', 'ask_hint', 'control', 'mixed'],
    },
    confidence: { type: 'number' },
    sceneAnswerText: { type: ['string', 'null'] },
    questionText: { type: ['string', 'null'] },
    controlAction: {
      type: ['string', 'null'],
      enum: ['retry', 'continue', 'exit', 'repeat', null],
    },
  },
  required: ['intent', 'confidence', 'sceneAnswerText', 'questionText', 'controlAction'],
}

const EVALUATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    passed: { type: 'boolean' },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    goal_achieved: { type: 'boolean' },
    covered_points: { type: 'array', items: { type: 'string' } },
    missing_points: { type: 'array', items: { type: 'string' } },
    major_issue: { type: ['string', 'null'] },
    coach_feedback_zh: { type: 'string' },
    better_answer_en: { type: 'string' },
    next_action: { type: 'string', enum: ['advance', 'retry', 'offer_hint'] },
  },
  required: [
    'passed',
    'score',
    'goal_achieved',
    'covered_points',
    'missing_points',
    'major_issue',
    'coach_feedback_zh',
    'better_answer_en',
    'next_action',
  ],
}

const COACH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    coach_reply_zh: { type: 'string' },
    vocab_notes: { type: 'array', items: { type: 'string' } },
    grammar_notes: { type: 'array', items: { type: 'string' } },
    better_answer_en: { type: ['string', 'null'] },
    invite_retry: { type: 'boolean' },
    tts_text_zh: { type: 'string' },
  },
  required: ['coach_reply_zh', 'vocab_notes', 'grammar_notes', 'better_answer_en', 'invite_retry', 'tts_text_zh'],
}

const ROLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role_reply_en: { type: 'string' },
    emotion: { type: 'string', enum: ['normal', 'encouraging', 'confused', 'corrective'] },
    tts_instructions: { type: 'string' },
  },
  required: ['role_reply_en', 'emotion', 'tts_instructions'],
}

const HOME_COACH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    replyZh: { type: 'string' },
    suggestedScenarioIds: {
      type: 'array',
      items: { type: 'string' },
    },
    studyTips: {
      type: 'array',
      items: { type: 'string' },
    },
    followupQuestion: { type: ['string', 'null'] },
    ttsTextZh: { type: 'string' },
  },
  required: ['replyZh', 'suggestedScenarioIds', 'studyTips', 'followupQuestion', 'ttsTextZh'],
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.')
  }

  return apiKey
}

function getDialogueModel(envName: string, fallback: string) {
  return process.env[envName] || fallback
}

function getSpeechTokenSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.OPENAI_API_KEY || 'dialogue-home-coach-dev'
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signValue(value: string) {
  return crypto
    .createHmac('sha256', getSpeechTokenSecret())
    .update(value)
    .digest('base64url')
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

async function callResponsesJson<T>({
  model,
  name,
  instructions,
  input,
  schema,
}: {
  model: string
  name: string
  instructions: string
  input: unknown
  schema: object
}) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(input),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name,
          strict: true,
          schema,
        },
      },
    }),
  })

  const responsePayload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(responsePayload?.error?.message || `OpenAI request failed: ${response.status}`)
  }

  const outputText = getOutputText(responsePayload)
  if (!outputText) {
    throw new Error('OpenAI response did not include output text.')
  }

  return JSON.parse(outputText) as T
}

function buildSceneInput(
  scenario: DialogueAiScenarioContext,
  node: DialogueAiNodeContext,
  extra: Record<string, unknown>
) {
  return {
    scenario,
    currentNode: {
      id: node.id,
      title: node.title,
      aiLineEn: node.roleLineEn,
      aiLineZh: node.roleLineZh,
      userGoal: node.goal,
      rubricJson: node.rubricJson,
      hintJson: node.hintJson,
      sampleAnswer: node.sampleAnswer,
      retryLimit: node.retryLimit,
    },
    ...extra,
  }
}

export async function routeDialogueInput({
  scenario,
  node,
  userText,
}: {
  scenario: DialogueAiScenarioContext
  node: DialogueAiNodeContext
  userText: string
}) {
  const output = await callResponsesJson<DialogueRouterOutput>({
    model: getDialogueModel('DIALOGUE_ROUTER_MODEL', 'gpt-5.4-mini'),
    name: 'dialogue_router',
    schema: ROUTER_SCHEMA,
    instructions: [
      'You route one learner message in an English dialogue practice app.',
      'Classify whether the learner is answering the scene, asking the coach, asking for translation, asking for a hint, issuing a control command, or mixing a scene answer with a question.',
      'Preserve useful English answer text in sceneAnswerText. Preserve Chinese or meta question text in questionText.',
      'Do not evaluate correctness.',
    ].join('\n'),
    input: buildSceneInput(scenario, node, { userText }),
  })

  return {
    ...output,
    confidence: Math.min(1, Math.max(0, Number(output.confidence) || 0)),
  }
}

export async function evaluateDialogueAnswer({
  scenario,
  node,
  answerText,
  previousFailures,
}: {
  scenario: DialogueAiScenarioContext
  node: DialogueAiNodeContext
  answerText: string
  previousFailures: number
}) {
  const output = await callResponsesJson<DialogueEvaluatorOutput>({
    model: getDialogueModel('DIALOGUE_EVALUATOR_MODEL', 'gpt-5.4-mini'),
    name: 'dialogue_evaluator',
    schema: EVALUATOR_SCHEMA,
    instructions: [
      'You evaluate one learner answer for a scenario-based English speaking exercise.',
      'Judge whether the learner achieved the current node goal, covered the rubric meaning, and sounded natural enough for the scene.',
      'Do not grade accent. If the answer came from speech transcription, judge meaning and intelligibility only from the transcript.',
      'Return concise Chinese feedback and one natural English better answer.',
    ].join('\n'),
    input: buildSceneInput(scenario, node, { answerText, previousFailures }),
  })

  return {
    ...output,
    score: normalizeDialogueScore(output.score),
    covered_points: Array.isArray(output.covered_points) ? output.covered_points : [],
    missing_points: Array.isArray(output.missing_points) ? output.missing_points : [],
  }
}

export async function coachDialogueLearner({
  scenario,
  node,
  userQuestion,
  mode,
  lastEvaluator,
  betterAnswerEn,
}: {
  scenario: DialogueAiScenarioContext
  node: DialogueAiNodeContext
  userQuestion: string
  mode: 'explanation' | 'translation' | 'hint' | 'feedback' | 'mixed'
  lastEvaluator?: DialogueEvaluatorOutput | null
  betterAnswerEn?: string | null
}) {
  return callResponsesJson<DialogueCoachOutput>({
    model: getDialogueModel('DIALOGUE_COACH_MODEL', 'gpt-5.4-mini'),
    name: 'dialogue_coach',
    schema: COACH_SCHEMA,
    instructions: [
      'You are a warm Chinese-speaking English coach inside a scenario dialogue practice app.',
      'Answer in Simplified Chinese. Keep feedback practical and concise.',
      'Use the current scene, current node, recent error, and recommended answer. Do not advance story state.',
      'If the learner asks for translation, translate the role line and explain any useful phrase.',
    ].join('\n'),
    input: buildSceneInput(scenario, node, {
      mode,
      userQuestion,
      lastEvaluator,
      betterAnswerEn,
    }),
  })
}

export async function generateDialogueRoleFollowup({
  scenario,
  node,
  learnerAnswer,
}: {
  scenario: DialogueAiScenarioContext
  node: DialogueAiNodeContext
  learnerAnswer: string
}) {
  return callResponsesJson<DialogueRoleOutput>({
    model: getDialogueModel('DIALOGUE_ROLE_MODEL', 'gpt-5.4-mini'),
    name: 'dialogue_role_followup',
    schema: ROLE_SCHEMA,
    instructions: [
      'You are briefly role-playing the AI character in an English dialogue scenario.',
      'Return at most one short English sentence that naturally acknowledges the learner before the next fixed script line.',
      'Do not decide correctness, do not teach, and do not change the scenario objective.',
    ].join('\n'),
    input: buildSceneInput(scenario, node, { learnerAnswer }),
  })
}

export async function coachDialogueHome({
  message,
  recentMessages,
  scenarios,
}: {
  message: string
  recentMessages: DialogueHomeCoachMessage[]
  scenarios: DialogueHomeCoachScenarioContext[]
}) {
  const output = await callResponsesJson<DialogueHomeCoachOutput>({
    model: getDialogueModel('DIALOGUE_HOME_COACH_MODEL', getDialogueModel('DIALOGUE_COACH_MODEL', 'gpt-5.4-mini')),
    name: 'dialogue_home_coach',
    schema: HOME_COACH_SCHEMA,
    instructions: [
      'You are the always-on AI coach on the Dialogue home page of an English learning app.',
      'Answer in Simplified Chinese. You may freely answer English-learning questions, recommend published scenarios, and give study advice.',
      'You are not inside a specific scene node. Do not role-play a node, do not grade an answer, do not claim a session has started, and do not advance story state.',
      'When recommending scenarios, return up to 3 exact ids from the provided published scenario list. If none fit, return an empty list and explain what to practice generally.',
      'Keep replyZh concise but helpful. ttsTextZh should be a shorter spoken version of replyZh.',
    ].join('\n'),
    input: {
      message,
      recentMessages: recentMessages.slice(-8),
      publishedScenarios: scenarios,
    },
  })

  const allowedScenarioIds = new Set(scenarios.map((scenario) => scenario.id))

  return {
    ...output,
    suggestedScenarioIds: Array.isArray(output.suggestedScenarioIds)
      ? output.suggestedScenarioIds.filter((id) => allowedScenarioIds.has(id)).slice(0, 3)
      : [],
    studyTips: Array.isArray(output.studyTips) ? output.studyTips.slice(0, 4) : [],
    followupQuestion: output.followupQuestion?.trim() || null,
    ttsTextZh: output.ttsTextZh.trim() || output.replyZh,
  }
}

export function createDialogueHomeSpeechToken(text: string) {
  const payload = base64UrlEncode(JSON.stringify({
    text,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }))
  const signature = signValue(payload)
  return `${payload}.${signature}`
}

export function verifyDialogueHomeSpeechToken(token: string) {
  const [payload, signature] = token.split('.')

  if (!payload || !signature || signValue(payload) !== signature) {
    throw new Error('Invalid speech token.')
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as {
    text?: unknown
    expiresAt?: unknown
  }

  if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) {
    throw new Error('Speech token has expired.')
  }

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''

  if (!text) {
    throw new Error('Speech token has no speakable text.')
  }

  return text
}

export async function transcribeDialogueAudio(file: File) {
  if (!file || file.size <= 0) {
    throw new Error('Audio file is required.')
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error('Audio file is too large. Maximum size is 25 MB.')
  }

  if (file.type && !ALLOWED_AUDIO_TYPES.has(file.type)) {
    throw new Error(`Unsupported audio type: ${file.type}`)
  }

  const formData = new FormData()
  formData.append('file', file, file.name || 'dialogue-audio.webm')
  formData.append('model', getDialogueModel('DIALOGUE_STT_MODEL', 'gpt-4o-transcribe'))
  formData.append('response_format', 'json')

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Transcription failed: ${response.status}`)
  }

  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    throw new Error('Transcription returned empty text.')
  }

  return text
}

export async function synthesizeDialogueSpeech({
  text,
  voice,
  instructions,
}: {
  text: string
  voice?: string | null
  instructions?: string
}) {
  const normalizedText = text.trim()
  if (!normalizedText) {
    throw new Error('Speech text is required.')
  }

  const model = getDialogueModel('DIALOGUE_TTS_MODEL', 'gpt-4o-mini-tts')
  const normalizedVoice = normalizeDialogueVoice(voice, DEFAULT_DIALOGUE_ROLE_VOICE)
  const normalizedInstructions = (instructions || 'Speak clearly and naturally for an English learner.').trim()
  const cacheKey = crypto
    .createHash('sha256')
    .update(safeJsonStringify({ model, voice: normalizedVoice, text: normalizedText, instructions: normalizedInstructions }))
    .digest('hex')

  const existing = await prisma.dialogueSpeechAsset.findUnique({
    where: { cacheKey },
  })

  if (existing) {
    return existing
  }

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      voice: normalizedVoice,
      input: normalizedText,
      instructions: normalizedInstructions,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || `Speech synthesis failed: ${response.status}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  const speechDir = path.join(process.cwd(), 'public', 'dialogue-speech')
  await fs.mkdir(speechDir, { recursive: true })
  const fileName = `${cacheKey}.mp3`
  const filePath = path.join(speechDir, fileName)
  await fs.writeFile(filePath, audioBuffer)
  const audioUrl = `/dialogue-speech/${fileName}`

  try {
    return await prisma.dialogueSpeechAsset.create({
      data: {
        cacheKey,
        text: normalizedText,
        voice: normalizedVoice,
        model,
        instructions: normalizedInstructions,
        audioUrl,
      },
    })
  } catch {
    const createdByRace = await prisma.dialogueSpeechAsset.findUnique({
      where: { cacheKey },
    })

    if (createdByRace) {
      return createdByRace
    }

    throw new Error('Failed to cache synthesized speech.')
  }
}

export function getRoleVoiceForScenario(value: string | null | undefined) {
  return normalizeDialogueVoice(value, DEFAULT_DIALOGUE_ROLE_VOICE)
}

export function getCoachVoiceForScenario(value: string | null | undefined) {
  return normalizeDialogueVoice(value, DEFAULT_DIALOGUE_COACH_VOICE)
}
