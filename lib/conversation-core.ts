import { parseJsonString, safeJsonStringify } from '@/lib/dialogue'
import { prisma } from '@/lib/prisma'

export type ConversationMode = 'free' | 'scenario'
export type ConversationInputMode = 'text' | 'audio' | 'realtime'
export type TranscriptSource = 'realtime_transcript' | 'file_transcription' | 'text_input'
export type ConversationTurnStatus = 'started' | 'completed' | 'failed'
export type ConversationSessionStatus = 'active' | 'completed' | 'abandoned'
export type AssessmentIssueType =
  | 'grammar_tense'
  | 'vocab_limited'
  | 'pronunciation_low_confidence'
  | 'tone_too_direct'
  | 'goal_missing'
  | 'fluency_pause'
  | 'sentence_too_short'
  | 'other'
export type ProfileEventSeverity = 'low' | 'medium' | 'high'

export interface Transcript {
  source: TranscriptSource
  text: string
  language?: string | null
  confidence?: number | null
  segments?: unknown[]
  raw?: unknown
}

export interface AiReply {
  role: 'coach' | 'role' | 'system'
  text: string
  language?: string | null
  speechText?: string | null
  speechToken?: string | null
  audioUrl?: string | null
  suggestedScenarioIds?: string[]
  metadata?: Record<string, unknown>
}

export interface Assessment {
  score?: number | null
  passed?: boolean | null
  goalAchieved?: boolean | null
  issueTypes: AssessmentIssueType[]
  feedbackZh?: string | null
  betterAnswerEn?: string | null
  coveredPoints?: string[]
  missingPoints?: string[]
  raw?: unknown
}

export interface ProfileEvent {
  type: AssessmentIssueType
  severity: ProfileEventSeverity
  evidence: string
  suggestion: string
  mode: ConversationMode
  scenarioId?: string | null
  nodeId?: string | null
  stageId?: string | null
  turnId?: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export interface ConversationSession {
  id: string
  mode: ConversationMode
  userId: string
  scenarioId: string | null
  currentNodeId: string | null
  currentStageId: string | null
  stageState: Record<string, unknown>
  status: ConversationSessionStatus
  metadata: Record<string, unknown>
  totalScore: number
  completedNodeCount: number
  lastActivityAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationTurn {
  id: string
  sessionId: string
  scenarioId: string | null
  nodeId: string | null
  stageId: string | null
  userId: string
  inputMode: ConversationInputMode
  turnStatus: ConversationTurnStatus
  turnIndex: number
  transcriptSource: TranscriptSource
  userText: string
  transcriptText: string | null
  transcript: Transcript
  aiReply: AiReply | null
  assessment: Assessment | null
  profileEvents: ProfileEvent[]
  error: Record<string, unknown> | null
  routerIntent: string
  router: Record<string, unknown>
  stageState: Record<string, unknown>
  nextAction: string
  createdAt: string
}

type DialogueSessionRecord = Awaited<ReturnType<typeof prisma.dialogueSession.create>>
type DialogueTurnRecord = Awaited<ReturnType<typeof prisma.dialogueAttempt.create>>

export interface ConversationTurnResult {
  turn: ConversationTurn
  record: DialogueTurnRecord
}

interface BaseTurnInput {
  sessionId: string
  userId: string
  scenarioId?: string | null
  nodeId?: string | null
  stageId?: string | null
  inputMode: ConversationInputMode
  transcriptSource: TranscriptSource
  userText: string
  transcript?: Partial<Transcript> | null
  stageState?: Record<string, unknown> | null
  routerIntent?: string
  router?: unknown
  nextAction?: string
}

interface CompleteTurnFields {
  aiReply?: AiReply | null
  assessment?: Assessment | null
  profileEvents?: ProfileEvent[]
  error?: Record<string, unknown> | null
  evaluator?: unknown
  coach?: unknown
  roleReplyEn?: string | null
  coachReplyZh?: string | null
  betterAnswerEn?: string | null
  passed?: boolean | null
  score?: number | null
  nextAction?: string
}

export interface CreateConversationSessionInput {
  userId: string
  mode: ConversationMode
  scenarioId?: string | null
  currentNodeId?: string | null
  currentStageId?: string | null
  stageState?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface GetOrCreateFreeConversationSessionInput {
  userId: string
  sessionId?: string | null
  metadata?: Record<string, unknown>
}

export interface StartConversationTurnInput extends BaseTurnInput {
  metadata?: Record<string, unknown>
}

export interface CompleteConversationTurnInput extends CompleteTurnFields {
  turnId: string
  userId: string
  transcript?: Partial<Transcript> | null
  stageState?: Record<string, unknown> | null
}

export interface FailConversationTurnInput {
  turnId: string
  userId: string
  transcript?: Partial<Transcript> | null
  error: Record<string, unknown>
}

export interface RecordCompletedConversationTurnInput extends BaseTurnInput, CompleteTurnFields {}

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

function normalizeConversationMode(value: unknown): ConversationMode {
  return value === 'free' ? 'free' : 'scenario'
}

function normalizeInputMode(value: unknown): ConversationInputMode {
  return value === 'audio' || value === 'realtime' ? value : 'text'
}

function normalizeTranscriptSource(value: unknown): TranscriptSource {
  if (value === 'realtime_transcript' || value === 'file_transcription') {
    return value
  }

  return 'text_input'
}

function normalizeTurnStatus(value: unknown): ConversationTurnStatus {
  if (value === 'started' || value === 'failed') {
    return value
  }

  return 'completed'
}

function normalizeSessionStatus(value: unknown): ConversationSessionStatus {
  if (value === 'completed' || value === 'abandoned') {
    return value
  }

  return 'active'
}

function normalizeSeverity(value: unknown): ProfileEventSeverity {
  if (value === 'high' || value === 'medium') {
    return value
  }

  return 'low'
}

function normalizeIssueType(value: unknown): AssessmentIssueType {
  switch (value) {
    case 'grammar_tense':
    case 'vocab_limited':
    case 'pronunciation_low_confidence':
    case 'tone_too_direct':
    case 'goal_missing':
    case 'fluency_pause':
    case 'sentence_too_short':
      return value
    default:
      return 'other'
  }
}

function normalizeIssueTypes(value: unknown): AssessmentIssueType[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeIssueType)
}

function normalizeTranscript({
  source,
  text,
  transcript,
}: {
  source: TranscriptSource
  text: string
  transcript?: Partial<Transcript> | null
}): Transcript {
  return {
    ...transcript,
    source,
    text: String(transcript?.text || text || '').trim(),
    language: transcript?.language ?? null,
    confidence: typeof transcript?.confidence === 'number' ? transcript.confidence : null,
  }
}

function normalizeAssessment(value: Assessment | null | undefined): Assessment | null {
  if (!value) {
    return null
  }

  return {
    ...value,
    score: typeof value.score === 'number' ? value.score : null,
    passed: typeof value.passed === 'boolean' ? value.passed : null,
    goalAchieved: typeof value.goalAchieved === 'boolean' ? value.goalAchieved : null,
    issueTypes: normalizeIssueTypes(value.issueTypes),
    coveredPoints: Array.isArray(value.coveredPoints) ? value.coveredPoints : [],
    missingPoints: Array.isArray(value.missingPoints) ? value.missingPoints : [],
  }
}

function normalizeProfileEvents({
  events,
  mode,
  turnId,
  scenarioId,
  nodeId,
  stageId,
}: {
  events: ProfileEvent[] | undefined
  mode: ConversationMode
  turnId?: string
  scenarioId?: string | null
  nodeId?: string | null
  stageId?: string | null
}) {
  return (events || [])
    .map((event) => ({
      type: normalizeIssueType(event.type),
      severity: normalizeSeverity(event.severity),
      evidence: String(event.evidence || '').trim().slice(0, 2000),
      suggestion: String(event.suggestion || '').trim().slice(0, 2000),
      mode: event.mode || mode,
      scenarioId: event.scenarioId ?? scenarioId ?? null,
      nodeId: event.nodeId ?? nodeId ?? null,
      stageId: event.stageId ?? stageId ?? null,
      turnId: event.turnId || turnId,
      metadata: event.metadata || {},
      createdAt: event.createdAt,
    }))
    .filter((event) => event.evidence || event.suggestion || event.type !== 'other')
}

function serializeConversationSession(record: DialogueSessionRecord): ConversationSession {
  return {
    id: record.id,
    mode: normalizeConversationMode(record.mode),
    userId: record.userId,
    scenarioId: record.scenarioId,
    currentNodeId: record.currentNodeId,
    currentStageId: record.currentStageId,
    stageState: parseJsonString<Record<string, unknown>>(record.stageStateJson, {}),
    status: normalizeSessionStatus(record.status),
    metadata: parseJsonString<Record<string, unknown>>(record.metadataJson, {}),
    totalScore: record.totalScore,
    completedNodeCount: record.completedNodeCount,
    lastActivityAt: toIso(record.lastActivityAt) || '',
    completedAt: toIso(record.completedAt),
    createdAt: toIso(record.createdAt) || '',
    updatedAt: toIso(record.updatedAt) || '',
  }
}

function serializeConversationTurn(record: DialogueTurnRecord): ConversationTurn {
  const transcriptSource = normalizeTranscriptSource(record.transcriptSource)
  const transcriptSnapshot = parseJsonString<Partial<Transcript>>(record.transcriptJson, {})
  const aiReplySnapshot = parseJsonString<Partial<AiReply>>(record.aiReplyJson, {})
  const assessmentSnapshot = record.assessmentJson
    ? normalizeAssessment(parseJsonString<Assessment | null>(record.assessmentJson, null))
    : null
  const profileEvents = normalizeProfileEvents({
    events: parseJsonString<ProfileEvent[]>(record.profileEventsJson, []),
    mode: record.scenarioId ? 'scenario' : 'free',
    turnId: record.id,
    scenarioId: record.scenarioId,
    nodeId: record.nodeId,
    stageId: record.stageId,
  })
  const fallbackReplyText = record.coachReplyZh || record.roleReplyEn || ''
  const aiReply =
    aiReplySnapshot.text || fallbackReplyText
      ? {
          role: aiReplySnapshot.role || (record.roleReplyEn ? 'role' : 'coach'),
          text: aiReplySnapshot.text || fallbackReplyText,
          language: aiReplySnapshot.language ?? null,
          speechText: aiReplySnapshot.speechText ?? null,
          speechToken: aiReplySnapshot.speechToken ?? null,
          audioUrl: aiReplySnapshot.audioUrl ?? null,
          suggestedScenarioIds: Array.isArray(aiReplySnapshot.suggestedScenarioIds)
            ? aiReplySnapshot.suggestedScenarioIds
            : [],
          metadata: aiReplySnapshot.metadata || {},
        } satisfies AiReply
      : null

  return {
    id: record.id,
    sessionId: record.sessionId,
    scenarioId: record.scenarioId,
    nodeId: record.nodeId,
    stageId: record.stageId,
    userId: record.userId,
    inputMode: normalizeInputMode(record.inputMode),
    turnStatus: normalizeTurnStatus(record.turnStatus),
    turnIndex: record.turnIndex,
    transcriptSource,
    userText: record.userText,
    transcriptText: record.transcriptText,
    transcript: normalizeTranscript({
      source: transcriptSource,
      text: record.transcriptText || record.userText,
      transcript: transcriptSnapshot,
    }),
    aiReply,
    assessment: assessmentSnapshot,
    profileEvents,
    error: record.errorJson ? parseJsonString<Record<string, unknown> | null>(record.errorJson, null) : null,
    routerIntent: record.routerIntent,
    router: parseJsonString<Record<string, unknown>>(record.routerJson, {}),
    stageState: parseJsonString<Record<string, unknown>>(record.stageStateJson, {}),
    nextAction: record.nextAction,
    createdAt: toIso(record.createdAt) || '',
  }
}

async function getNextTurnIndex(sessionId: string) {
  const aggregate = await prisma.dialogueAttempt.aggregate({
    where: { sessionId },
    _max: { turnIndex: true },
  })

  return (aggregate._max.turnIndex ?? -1) + 1
}

async function getOwnedSession(sessionId: string, userId: string) {
  const session = await prisma.dialogueSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  })

  if (!session) {
    throw new Error('Conversation session not found.')
  }

  return session
}

async function persistProfileEvents(record: DialogueTurnRecord, profileEvents: ProfileEvent[]) {
  const mode = record.scenarioId ? 'scenario' : 'free'
  const normalizedEvents = normalizeProfileEvents({
    events: profileEvents,
    mode,
    turnId: record.id,
    scenarioId: record.scenarioId,
    nodeId: record.nodeId,
    stageId: record.stageId,
  })

  if (!normalizedEvents.length) {
    return record
  }

  await prisma.dialogueProfileEvent.createMany({
    data: normalizedEvents.map((event) => ({
      userId: record.userId,
      sessionId: record.sessionId,
      turnId: record.id,
      mode: event.mode,
      scenarioId: event.scenarioId,
      nodeId: event.nodeId,
      stageId: event.stageId,
      type: event.type,
      severity: event.severity,
      evidence: event.evidence,
      suggestion: event.suggestion,
      metadataJson: safeJsonStringify(event.metadata || {}),
    })),
  })

  return prisma.dialogueAttempt.update({
    where: { id: record.id },
    data: {
      profileEventsJson: safeJsonStringify(normalizedEvents),
    },
  })
}

function buildLegacyReplyFields(fields: CompleteTurnFields) {
  const aiReply = fields.aiReply || null

  return {
    roleReplyEn: fields.roleReplyEn ?? (aiReply?.role === 'role' ? aiReply.text : null),
    coachReplyZh: fields.coachReplyZh ?? (aiReply?.role === 'coach' ? aiReply.text : null),
    betterAnswerEn: fields.betterAnswerEn ?? fields.assessment?.betterAnswerEn ?? null,
    passed: fields.passed ?? fields.assessment?.passed ?? null,
    score: fields.score ?? fields.assessment?.score ?? null,
  }
}

export async function createConversationSession({
  userId,
  mode,
  scenarioId = null,
  currentNodeId = null,
  currentStageId = null,
  stageState = {},
  metadata = {},
}: CreateConversationSessionInput) {
  if (mode === 'scenario' && !scenarioId) {
    throw new Error('scenarioId is required for scenario conversation sessions.')
  }

  const record = await prisma.dialogueSession.create({
    data: {
      mode,
      scenarioId: mode === 'scenario' ? scenarioId : null,
      userId,
      currentNodeId: mode === 'scenario' ? currentNodeId : null,
      currentStageId: mode === 'scenario' ? currentStageId : null,
      stageStateJson: safeJsonStringify(stageState),
      status: 'active',
      metadataJson: safeJsonStringify(metadata),
    },
  })

  return serializeConversationSession(record)
}

export async function getConversationSession(sessionId: string, userId: string) {
  const session = await prisma.dialogueSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  })

  return session ? serializeConversationSession(session) : null
}

export async function getOrCreateFreeConversationSession({
  userId,
  sessionId,
  metadata = {},
}: GetOrCreateFreeConversationSessionInput) {
  if (sessionId) {
    const existing = await prisma.dialogueSession.findFirst({
      where: {
        id: sessionId,
        userId,
        mode: 'free',
        status: 'active',
      },
    })

    if (existing) {
      return serializeConversationSession(existing)
    }
  }

  return createConversationSession({
    userId,
    mode: 'free',
    metadata,
  })
}

export async function startConversationTurn(input: StartConversationTurnInput): Promise<ConversationTurnResult> {
  const session = await getOwnedSession(input.sessionId, input.userId)
  const transcript = normalizeTranscript({
    source: input.transcriptSource,
    text: input.userText,
    transcript: input.transcript,
  })

  const record = await prisma.dialogueAttempt.create({
    data: {
      sessionId: session.id,
      scenarioId: input.scenarioId ?? session.scenarioId ?? null,
      nodeId: input.nodeId ?? session.currentNodeId ?? null,
      stageId: input.stageId ?? session.currentStageId ?? null,
      userId: input.userId,
      inputMode: input.inputMode,
      turnStatus: 'started',
      turnIndex: await getNextTurnIndex(session.id),
      transcriptSource: input.transcriptSource,
      userText: input.userText,
      transcriptText: transcript.text || null,
      transcriptJson: safeJsonStringify(transcript),
      stageStateJson: safeJsonStringify(input.stageState || {}),
      routerIntent: input.routerIntent || 'conversation',
      routerJson: safeJsonStringify(input.router || {}),
      nextAction: input.nextAction || 'stay',
    },
  })

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  return {
    record,
    turn: serializeConversationTurn(record),
  }
}

export async function completeConversationTurn(input: CompleteConversationTurnInput): Promise<ConversationTurnResult> {
  const existing = await prisma.dialogueAttempt.findFirst({
    where: {
      id: input.turnId,
      userId: input.userId,
    },
  })

  if (!existing) {
    throw new Error('Conversation turn not found.')
  }

  const transcript = input.transcript
    ? normalizeTranscript({
        source: normalizeTranscriptSource(existing.transcriptSource),
        text: existing.transcriptText || existing.userText,
        transcript: input.transcript,
      })
    : parseJsonString<Transcript>(existing.transcriptJson, normalizeTranscript({
        source: normalizeTranscriptSource(existing.transcriptSource),
        text: existing.transcriptText || existing.userText,
      }))
  const assessment = normalizeAssessment(input.assessment)
  const legacyReply = buildLegacyReplyFields({ ...input, assessment })
  const updated = await prisma.dialogueAttempt.update({
    where: { id: existing.id },
    data: {
      turnStatus: 'completed',
      transcriptText: transcript.text || null,
      transcriptJson: safeJsonStringify(transcript),
      aiReplyJson: safeJsonStringify(input.aiReply || {}),
      assessmentJson: assessment ? safeJsonStringify(assessment) : null,
      errorJson: input.error ? safeJsonStringify(input.error) : null,
      stageStateJson: safeJsonStringify(input.stageState || parseJsonString<Record<string, unknown>>(existing.stageStateJson, {})),
      evaluatorJson: input.evaluator === undefined ? existing.evaluatorJson : safeJsonStringify(input.evaluator),
      coachJson: input.coach === undefined ? existing.coachJson : safeJsonStringify(input.coach),
      roleReplyEn: legacyReply.roleReplyEn,
      coachReplyZh: legacyReply.coachReplyZh,
      betterAnswerEn: legacyReply.betterAnswerEn,
      passed: legacyReply.passed,
      score: legacyReply.score,
      nextAction: input.nextAction || existing.nextAction,
      profileEventsJson: safeJsonStringify(input.profileEvents || []),
    },
  })
  const record = await persistProfileEvents(updated, input.profileEvents || [])

  await prisma.dialogueSession.update({
    where: { id: existing.sessionId },
    data: { lastActivityAt: new Date() },
  })

  return {
    record,
    turn: serializeConversationTurn(record),
  }
}

export async function failConversationTurn(input: FailConversationTurnInput): Promise<ConversationTurnResult> {
  const existing = await prisma.dialogueAttempt.findFirst({
    where: {
      id: input.turnId,
      userId: input.userId,
    },
  })

  if (!existing) {
    throw new Error('Conversation turn not found.')
  }

  const transcript = input.transcript
    ? normalizeTranscript({
        source: normalizeTranscriptSource(existing.transcriptSource),
        text: existing.transcriptText || existing.userText,
        transcript: input.transcript,
      })
    : parseJsonString<Transcript>(existing.transcriptJson, normalizeTranscript({
        source: normalizeTranscriptSource(existing.transcriptSource),
        text: existing.transcriptText || existing.userText,
      }))
  const record = await prisma.dialogueAttempt.update({
    where: { id: existing.id },
    data: {
      turnStatus: 'failed',
      transcriptText: transcript.text || null,
      transcriptJson: safeJsonStringify(transcript),
      errorJson: safeJsonStringify(input.error),
      stageStateJson: safeJsonStringify(parseJsonString<Record<string, unknown>>(existing.stageStateJson, {})),
      nextAction: 'error',
    },
  })

  await prisma.dialogueSession.update({
    where: { id: existing.sessionId },
    data: { lastActivityAt: new Date() },
  })

  return {
    record,
    turn: serializeConversationTurn(record),
  }
}

export async function recordCompletedConversationTurn(
  input: RecordCompletedConversationTurnInput
): Promise<ConversationTurnResult> {
  const session = await getOwnedSession(input.sessionId, input.userId)
  const transcript = normalizeTranscript({
    source: input.transcriptSource,
    text: input.userText,
    transcript: input.transcript,
  })
  const assessment = normalizeAssessment(input.assessment)
  const legacyReply = buildLegacyReplyFields({ ...input, assessment })
  const record = await prisma.dialogueAttempt.create({
    data: {
      sessionId: session.id,
      scenarioId: input.scenarioId ?? session.scenarioId ?? null,
      nodeId: input.nodeId ?? session.currentNodeId ?? null,
      stageId: input.stageId ?? session.currentStageId ?? null,
      userId: input.userId,
      inputMode: input.inputMode,
      turnStatus: 'completed',
      turnIndex: await getNextTurnIndex(session.id),
      transcriptSource: input.transcriptSource,
      userText: input.userText,
      transcriptText: transcript.text || null,
      transcriptJson: safeJsonStringify(transcript),
      stageStateJson: safeJsonStringify(input.stageState || {}),
      aiReplyJson: safeJsonStringify(input.aiReply || {}),
      assessmentJson: assessment ? safeJsonStringify(assessment) : null,
      profileEventsJson: safeJsonStringify(input.profileEvents || []),
      errorJson: input.error ? safeJsonStringify(input.error) : null,
      routerIntent: input.routerIntent || 'conversation',
      routerJson: safeJsonStringify(input.router || {}),
      evaluatorJson: input.evaluator === undefined ? null : safeJsonStringify(input.evaluator),
      coachJson: input.coach === undefined ? null : safeJsonStringify(input.coach),
      roleReplyEn: legacyReply.roleReplyEn,
      coachReplyZh: legacyReply.coachReplyZh,
      betterAnswerEn: legacyReply.betterAnswerEn,
      passed: legacyReply.passed,
      score: legacyReply.score,
      nextAction: input.nextAction || 'stay',
    },
  })
  const persistedRecord = await persistProfileEvents(record, input.profileEvents || [])

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  return {
    record: persistedRecord,
    turn: serializeConversationTurn(persistedRecord),
  }
}
