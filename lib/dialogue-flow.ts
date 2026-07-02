import { prisma } from '@/lib/prisma'
import {
  normalizeDialogueTags,
  parseJsonString,
  safeJsonStringify,
  type DialogueInputMode,
} from '@/lib/dialogue'
import {
  coachDialogueLearner,
  routeDialogueInput,
  runDialogueStageAgent,
  type DialogueAiStageContext,
  type DialogueCoachOutput,
} from '@/lib/dialogue-ai'
import {
  recordCompletedConversationTurn,
  type AiReply,
  type Assessment,
  type AssessmentIssueType,
  type ConversationInputMode,
  type ProfileEvent,
  type TranscriptSource,
} from '@/lib/conversation-core'

type DialogueScenarioWithGraph = Awaited<ReturnType<typeof getScenarioWithGraph>>
type DialogueSessionWithContext = Awaited<ReturnType<typeof getSessionWithContext>>
type LoadedDialogueSession = NonNullable<DialogueSessionWithContext>
type LoadedDialogueScenario = NonNullable<LoadedDialogueSession['scenario']>
type LoadedDialogueStage = LoadedDialogueScenario['stages'][number]
type LoadedDialogueTransition = LoadedDialogueScenario['transitions'][number]
type ScenarioStageMemory = {
  globalSlots: Record<string, unknown>
  activeStageState: Record<string, unknown>
  history: Array<Record<string, unknown>>
}

function getScenarioWithGraph(scenarioId: string) {
  return prisma.dialogueScenario.findUnique({
    where: { id: scenarioId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
      },
      transitions: true,
    },
  })
}

function getSessionWithContext(sessionId: string, userId: string) {
  return prisma.dialogueSession.findFirst({
    where: {
      id: sessionId,
      userId,
      mode: 'scenario',
    },
    include: {
      scenario: {
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
          transitions: true,
        },
      },
      currentStage: true,
      attempts: {
        orderBy: { createdAt: 'asc' },
        take: 120,
      },
    },
  })
}

function scenarioToContext(scenario: NonNullable<DialogueScenarioWithGraph> | LoadedDialogueScenario) {
  return {
    title: scenario.title,
    description: scenario.description,
    difficulty: scenario.difficulty,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
  }
}

function stageToContext(stage: LoadedDialogueStage): DialogueAiStageContext {
  return {
    id: stage.id,
    title: stage.title,
    openingLineEn: stage.openingLineEn,
    openingLineZh: stage.openingLineZh,
    objective: stage.objective,
    slotsJson: stage.slotsJson,
    completionJson: stage.completionJson,
    assessmentJson: stage.assessmentJson,
    hintsJson: stage.hintsJson,
    outcomesJson: stage.outcomesJson,
  }
}

function stageToLegacyNodeContext(stage: LoadedDialogueStage) {
  const hints = parseJsonString<Record<string, unknown>>(stage.hintsJson, {})
  const sampleAnswer = String(hints.sampleAnswer || hints.example || '').trim()

  return {
    id: stage.id,
    title: stage.title,
    roleLineEn: stage.openingLineEn,
    roleLineZh: stage.openingLineZh,
    goal: stage.objective,
    rubricJson: stage.assessmentJson,
    hintJson: stage.hintsJson,
    sampleAnswer,
    retryLimit: 2,
    allowDynamicFollowup: true,
  }
}

function serializeStage(stage: LoadedDialogueStage | null) {
  if (!stage) {
    return null
  }

  const hints = parseJsonString<Record<string, unknown>>(stage.hintsJson, {})

  return {
    id: stage.id,
    order: stage.order,
    title: stage.title,
    openingLineEn: stage.openingLineEn,
    openingLineZh: stage.openingLineZh,
    objective: stage.objective,
    slots: parseJsonString<unknown[]>(stage.slotsJson, []),
    completion: parseJsonString<Record<string, unknown>>(stage.completionJson, {}),
    assessment: parseJsonString<Record<string, unknown>>(stage.assessmentJson, {}),
    hints,
    outcomes: parseJsonString<unknown[]>(stage.outcomesJson, []),
    positionX: stage.positionX,
    positionY: stage.positionY,
  }
}

function serializeCurrentNode(stage: LoadedDialogueStage | null) {
  if (!stage) {
    return null
  }

  const hints = parseJsonString<Record<string, unknown>>(stage.hintsJson, {})

  return {
    id: stage.id,
    order: stage.order,
    title: stage.title,
    roleLineEn: stage.openingLineEn,
    roleLineZh: stage.openingLineZh,
    goal: stage.objective,
    sampleAnswer: String(hints.sampleAnswer || hints.example || '').trim(),
    retryLimit: 0,
  }
}

function serializeTransition(transition: LoadedDialogueTransition | null, confidence?: number | null, reason?: string | null) {
  if (!transition) {
    return null
  }

  return {
    id: transition.id,
    fromStageId: transition.fromStageId,
    toStageId: transition.toStageId,
    outcomeKey: transition.outcomeKey,
    label: transition.label,
    condition: parseJsonString<Record<string, unknown>>(transition.conditionJson, {}),
    priority: transition.priority,
    isFallback: transition.isFallback,
    confidence: confidence ?? null,
    reason: reason || null,
  }
}

function serializeAttempt(attempt: LoadedDialogueSession['attempts'][number]) {
  return {
    id: attempt.id,
    nodeId: attempt.nodeId,
    stageId: attempt.stageId,
    inputMode: attempt.inputMode,
    turnStatus: attempt.turnStatus,
    turnIndex: attempt.turnIndex,
    transcriptSource: attempt.transcriptSource,
    userText: attempt.userText,
    transcriptText: attempt.transcriptText,
    transcript: parseJsonString<Record<string, unknown>>(attempt.transcriptJson, {}),
    aiReply: parseJsonString<Record<string, unknown>>(attempt.aiReplyJson, {}),
    assessment: parseJsonString<Record<string, unknown>>(attempt.assessmentJson, {}),
    profileEvents: parseJsonString<Record<string, unknown>[]>(attempt.profileEventsJson, []),
    error: parseJsonString<Record<string, unknown> | null>(attempt.errorJson, null),
    stageState: parseJsonString<Record<string, unknown>>(attempt.stageStateJson, {}),
    routerIntent: attempt.routerIntent,
    router: parseJsonString<Record<string, unknown>>(attempt.routerJson, {}),
    evaluator: parseJsonString<Record<string, unknown>>(attempt.evaluatorJson, {}),
    coach: parseJsonString<Record<string, unknown>>(attempt.coachJson, {}),
    roleReplyEn: attempt.roleReplyEn,
    coachReplyZh: attempt.coachReplyZh,
    betterAnswerEn: attempt.betterAnswerEn,
    passed: attempt.passed,
    score: attempt.score,
    nextAction: attempt.nextAction,
    createdAt: attempt.createdAt.toISOString(),
  }
}

function getCurrentStage(session: LoadedDialogueSession) {
  const scenario = requireScenario(session)
  return (
    session.currentStage
    || scenario.stages.find((stage) => stage.id === session.currentStageId)
    || null
  )
}

function buildSessionPayload(session: LoadedDialogueSession) {
  const scenario = requireScenario(session)
  const tags = normalizeDialogueTags(scenario.tagsJson)
  const currentStage = getCurrentStage(session)
  const averageScore =
    session.completedNodeCount > 0
      ? Math.round(session.totalScore / session.completedNodeCount)
      : 0

  return {
    session: {
      id: session.id,
      mode: session.mode,
      scenarioId: session.scenarioId,
      currentNodeId: null,
      currentStageId: session.currentStageId,
      stageState: parseScenarioStageMemory(session.stageStateJson),
      status: session.status,
      totalScore: session.totalScore,
      averageScore,
      completedNodeCount: session.completedNodeCount,
      lastActivityAt: session.lastActivityAt.toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
    },
    scenario: {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      difficulty: scenario.difficulty,
      userRole: scenario.userRole,
      aiRole: scenario.aiRole,
      tags,
      coverUrl: scenario.coverUrl,
      roleVoice: scenario.roleVoice,
      coachVoice: scenario.coachVoice,
    },
    currentNode: serializeCurrentNode(currentStage),
    currentStage: serializeStage(currentStage),
    attempts: session.attempts.map(serializeAttempt),
  }
}

function getStartStage(scenario: NonNullable<DialogueScenarioWithGraph> | LoadedDialogueScenario) {
  return (
    scenario.stages.find((stage) => stage.id === scenario.startStageId)
    || scenario.stages[0]
    || null
  )
}

function requireScenario(session: LoadedDialogueSession): LoadedDialogueScenario {
  if (!session.scenario) {
    throw new Error('Dialogue session is not attached to a scenario.')
  }

  return session.scenario
}

function getTranscriptSource(inputMode: DialogueInputMode): TranscriptSource {
  return inputMode === 'audio' ? 'file_transcription' : 'text_input'
}

function normalizeConversationInputMode(inputMode: DialogueInputMode): ConversationInputMode {
  return inputMode === 'audio' ? 'audio' : 'text'
}

function getStageOutcomeKeys(stage: LoadedDialogueStage) {
  return parseJsonString<unknown[]>(stage.outcomesJson, [])
    .map((outcome) => outcome && typeof outcome === 'object' ? outcome as Record<string, unknown> : null)
    .filter((outcome): outcome is Record<string, unknown> => Boolean(outcome))
    .map((outcome) => String(outcome.key || '').trim())
    .filter(Boolean)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function emptyScenarioStageMemory(): ScenarioStageMemory {
  return {
    globalSlots: {},
    activeStageState: {},
    history: [],
  }
}

function parseScenarioStageMemory(value: string | null | undefined): ScenarioStageMemory {
  const parsed = parseJsonString<Record<string, unknown>>(value, {})

  if (
    isRecord(parsed.globalSlots)
    || isRecord(parsed.activeStageState)
    || Array.isArray(parsed.history)
  ) {
    return {
      globalSlots: isRecord(parsed.globalSlots) ? parsed.globalSlots : {},
      activeStageState: isRecord(parsed.activeStageState) ? parsed.activeStageState : {},
      history: Array.isArray(parsed.history)
        ? parsed.history.filter(isRecord).slice(-16)
        : [],
    }
  }

  return {
    ...emptyScenarioStageMemory(),
    activeStageState: parsed,
  }
}

function applySlotUpdatesToGlobalSlots(
  globalSlots: Record<string, unknown>,
  slotUpdates: Awaited<ReturnType<typeof runDialogueStageAgent>>['slotUpdates']
) {
  const nextGlobalSlots = { ...globalSlots }

  for (const update of slotUpdates) {
    const key = String(update?.key || '').trim()
    const value = typeof update?.value === 'string' ? update.value.trim() : update?.value

    if (key && value !== '' && value !== null && value !== undefined) {
      nextGlobalSlots[key] = value
    }
  }

  return nextGlobalSlots
}

function completeStageMemory({
  memory,
  stage,
  outcomeKey,
  nextStage,
  userText,
}: {
  memory: ScenarioStageMemory
  stage: LoadedDialogueStage
  outcomeKey: string | null
  nextStage: LoadedDialogueStage | null
  userText: string
}): ScenarioStageMemory {
  return {
    globalSlots: memory.globalSlots,
    activeStageState: {},
    history: [
      ...memory.history,
      {
        stageId: stage.id,
        stageTitle: stage.title,
        outcomeKey,
        nextStageId: nextStage?.id || null,
        completedAt: new Date().toISOString(),
        lastUserText: userText.slice(0, 500),
        stageState: memory.activeStageState,
      },
    ].slice(-16),
  }
}

function parseAgentState(value: string) {
  const parsed = parseJsonString<Record<string, unknown>>(value, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function mergeStageState(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return {
    ...existing,
    ...next,
  }
}

function inferIssueType(value: string): AssessmentIssueType {
  const text = value.toLowerCase()

  if (text.includes('tense') || text.includes('grammar') || text.includes('语法')) {
    return 'grammar_tense'
  }
  if (text.includes('vocab') || text.includes('word') || text.includes('词')) {
    return 'vocab_limited'
  }
  if (text.includes('tone') || text.includes('polite') || text.includes('direct') || text.includes('语气')) {
    return 'tone_too_direct'
  }
  if (text.includes('goal') || text.includes('missing') || text.includes('objective') || text.includes('目标')) {
    return 'goal_missing'
  }
  if (text.includes('fluency') || text.includes('pause')) {
    return 'fluency_pause'
  }
  if (text.includes('short') || text.includes('brief')) {
    return 'sentence_too_short'
  }

  return 'other'
}

function buildAssessmentFromStageAgent(agentAssessment: Awaited<ReturnType<typeof runDialogueStageAgent>>['assessment']): Assessment | null {
  if (!agentAssessment) {
    return null
  }

  const issueTypes = agentAssessment.issueTypes.length
    ? agentAssessment.issueTypes.map(inferIssueType)
    : agentAssessment.passed === false
      ? [inferIssueType([agentAssessment.feedbackZh, ...agentAssessment.missingPoints].join(' '))]
      : []

  return {
    score: agentAssessment.score,
    passed: agentAssessment.passed,
    goalAchieved: agentAssessment.goalAchieved,
    issueTypes,
    feedbackZh: agentAssessment.feedbackZh,
    betterAnswerEn: agentAssessment.betterAnswerEn,
    coveredPoints: agentAssessment.coveredPoints,
    missingPoints: agentAssessment.missingPoints,
    raw: agentAssessment,
  }
}

function buildProfileEventsFromAssessment({
  assessment,
  scenarioId,
  stageId,
}: {
  assessment: Assessment | null
  scenarioId: string | null
  stageId: string | null
}): ProfileEvent[] {
  if (!assessment || assessment.passed || !assessment.issueTypes.length) {
    return []
  }

  const score = typeof assessment.score === 'number' ? assessment.score : 0
  const severity = score < 60 ? 'high' : score < 80 ? 'medium' : 'low'
  const evidence =
    assessment.missingPoints?.join(' / ')
    || assessment.feedbackZh
    || 'The learner answer did not fully satisfy the current stage objective.'

  return assessment.issueTypes.map((type) => ({
    type,
    severity,
    evidence,
    suggestion: assessment.betterAnswerEn || assessment.feedbackZh || '',
    mode: 'scenario',
    scenarioId,
    stageId,
    metadata: {
      score,
      goalAchieved: assessment.goalAchieved,
    },
  }))
}

function buildAiReply({
  roleReplyEn,
  coachReplyZh,
  betterAnswerEn,
  metadata,
}: {
  roleReplyEn?: string | null
  coachReplyZh?: string | null
  betterAnswerEn?: string | null
  metadata?: Record<string, unknown>
}): AiReply | null {
  if (roleReplyEn) {
    return {
      role: 'role',
      text: roleReplyEn,
      language: 'en',
      speechText: roleReplyEn,
      metadata: {
        ...metadata,
        coachReplyZh: coachReplyZh || null,
        betterAnswerEn: betterAnswerEn || null,
      },
    }
  }

  if (coachReplyZh) {
    return {
      role: 'coach',
      text: coachReplyZh,
      language: 'zh',
      speechText: coachReplyZh,
      metadata: {
        ...metadata,
        betterAnswerEn: betterAnswerEn || null,
      },
    }
  }

  return null
}

function getRecentTurns(session: LoadedDialogueSession, stageId: string) {
  return session.attempts
    .filter((attempt) => attempt.stageId === stageId)
    .slice(-8)
    .flatMap((attempt) => {
      const turns: Array<{ role: 'user' | 'assistant' | 'coach' | 'system'; text: string }> = []
      if (attempt.userText) {
        turns.push({ role: 'user', text: attempt.userText })
      }
      if (attempt.roleReplyEn) {
        turns.push({ role: 'assistant', text: attempt.roleReplyEn })
      }
      if (attempt.coachReplyZh) {
        turns.push({ role: 'coach', text: attempt.coachReplyZh })
      }
      return turns
    })
}

function matchTransitionForOutcome({
  scenario,
  stage,
  outcomeKey,
}: {
  scenario: LoadedDialogueScenario
  stage: LoadedDialogueStage
  outcomeKey: string | null
}) {
  const transitions = scenario.transitions
    .filter((transition) => transition.fromStageId === stage.id)
    .sort((left, right) => left.priority - right.priority || left.createdAt.getTime() - right.createdAt.getTime())

  if (!outcomeKey) {
    return transitions.find((transition) => transition.isFallback) || null
  }

  const exact = transitions.filter((transition) => transition.outcomeKey === outcomeKey)
  return exact.find((transition) => !transition.isFallback) || exact[0] || transitions.find((transition) => transition.isFallback) || null
}

async function recordScenarioTurn({
  session,
  scenario,
  stage,
  inputMode,
  userText,
  transcriptText,
  routerIntent,
  router,
  coach,
  roleReplyEn,
  coachReplyZh,
  betterAnswerEn,
  assessment,
  profileEvents,
  stageState,
  nextAction,
}: {
  session: LoadedDialogueSession
  scenario: LoadedDialogueScenario
  stage: LoadedDialogueStage
  inputMode: DialogueInputMode
  userText: string
  transcriptText?: string | null
  routerIntent: string
  router: unknown
  coach?: DialogueCoachOutput | Record<string, unknown> | null
  roleReplyEn?: string | null
  coachReplyZh?: string | null
  betterAnswerEn?: string | null
  assessment?: Assessment | null
  profileEvents?: ProfileEvent[]
  stageState: Record<string, unknown>
  nextAction: string
}) {
  const aiReply = buildAiReply({
    roleReplyEn,
    coachReplyZh,
    betterAnswerEn,
    metadata: {
      scenarioId: scenario.id,
      stageId: stage.id,
      nextAction,
      stageState,
    },
  })
  const result = await recordCompletedConversationTurn({
    sessionId: session.id,
    userId: session.userId,
    scenarioId: session.scenarioId,
    stageId: stage.id,
    inputMode: normalizeConversationInputMode(inputMode),
    transcriptSource: getTranscriptSource(inputMode),
    userText,
    transcript: {
      text: transcriptText || userText,
      source: getTranscriptSource(inputMode),
      language: 'en',
    },
    stageState,
    routerIntent,
    router,
    coach,
    aiReply,
    assessment,
    profileEvents: profileEvents || [],
    roleReplyEn,
    coachReplyZh,
    betterAnswerEn,
    passed: assessment?.passed ?? null,
    score: assessment?.score ?? null,
    nextAction,
  })

  return result.record
}

export async function getDialogueSessionPayload(sessionId: string, userId: string) {
  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    return null
  }

  return buildSessionPayload(session)
}

export async function createDialogueSession(scenarioId: string, userId: string) {
  const scenario = await getScenarioWithGraph(scenarioId)

  if (!scenario || !scenario.isPublished) {
    throw new Error('Dialogue scenario not found.')
  }

  const startStage = getStartStage(scenario)

  if (!startStage) {
    throw new Error('Dialogue scenario has no starting stage.')
  }

  const session = await prisma.dialogueSession.create({
    data: {
      mode: 'scenario',
      scenarioId,
      userId,
      currentStageId: startStage.id,
      currentNodeId: null,
      stageStateJson: safeJsonStringify(emptyScenarioStageMemory()),
      status: 'active',
      metadataJson: safeJsonStringify({
        scenarioTitle: scenario.title,
        startStageId: startStage.id,
        runtimeVersion: 'v2',
      }),
    },
  })

  const loadedSession = await getSessionWithContext(session.id, userId)

  if (!loadedSession) {
    throw new Error('Dialogue session could not be loaded.')
  }

  return buildSessionPayload(loadedSession)
}

export async function resetDialogueSession(sessionId: string, userId: string) {
  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    throw new Error('Dialogue session not found.')
  }

  const scenario = requireScenario(session)
  const startStage = getStartStage(scenario)

  if (!startStage) {
    throw new Error('Dialogue scenario has no starting stage.')
  }

  await prisma.dialogueAttempt.deleteMany({
    where: {
      sessionId: session.id,
      userId,
    },
  })

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: {
      currentNodeId: null,
      currentStageId: startStage.id,
      stageStateJson: safeJsonStringify(emptyScenarioStageMemory()),
      status: 'active',
      totalScore: 0,
      completedNodeCount: 0,
      completedAt: null,
      lastActivityAt: new Date(),
    },
  })

  const reloaded = await getSessionWithContext(session.id, userId)
  if (!reloaded) {
    throw new Error('Dialogue session could not be loaded.')
  }

  return buildSessionPayload(reloaded)
}

export async function respondToDialogueSession({
  sessionId,
  userId,
  text,
  inputMode,
  transcriptText,
}: {
  sessionId: string
  userId: string
  text: string
  inputMode: DialogueInputMode
  transcriptText?: string | null
}) {
  const userText = text.trim()

  if (!userText) {
    throw new Error('Response text is required.')
  }

  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    throw new Error('Dialogue session not found.')
  }

  if (session.status !== 'active') {
    throw new Error('Dialogue session is not active.')
  }

  const scenario = requireScenario(session)
  const stage = getCurrentStage(session)

  if (!stage) {
    throw new Error('Dialogue session has no current stage.')
  }

  const scenarioContext = scenarioToContext(scenario)
  const stageContext = stageToContext(stage)
  const nodeContext = stageToLegacyNodeContext(stage)
  const router = await routeDialogueInput({
    scenario: scenarioContext,
    node: nodeContext,
    userText,
  })

  const routerIntent = router.intent
  const answerText = (router.sceneAnswerText || userText).trim()
  const questionText = (router.questionText || userText).trim()
  const currentMemory = parseScenarioStageMemory(session.stageStateJson)
  const currentStageState = currentMemory.activeStageState

  if (routerIntent === 'exit') {
    await prisma.dialogueSession.update({
      where: { id: session.id },
      data: {
        status: 'abandoned',
        lastActivityAt: new Date(),
      },
    })

    const attempt = await recordScenarioTurn({
      session,
      scenario,
      stage,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      stageState: currentMemory,
      nextAction: 'exit',
    })
    const reloaded = await getSessionWithContext(session.id, userId)
    if (!reloaded) {
      throw new Error('Dialogue session could not be loaded.')
    }

    return {
      ...buildSessionPayload(reloaded),
      router,
      evaluator: null,
      coach: null,
      attempt: serializeAttempt(attempt),
      roleReplyEn: null,
      coachReplyZh: null,
      transcriptText: transcriptText || null,
      stageState: currentMemory,
      stageCompleted: false,
      outcomeKey: null,
      matchedTransition: null,
      nextStage: null,
      nextAction: 'exit',
    }
  }

  if (routerIntent === 'repeat_role_line') {
    const attempt = await recordScenarioTurn({
      session,
      scenario,
      stage,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      roleReplyEn: stage.openingLineEn,
      stageState: currentMemory,
      nextAction: 'repeat_role_line',
    })
    await prisma.dialogueSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    })
    const reloaded = await getSessionWithContext(session.id, userId)
    if (!reloaded) {
      throw new Error('Dialogue session could not be loaded.')
    }

    return {
      ...buildSessionPayload(reloaded),
      router,
      evaluator: null,
      coach: null,
      attempt: serializeAttempt(attempt),
      roleReplyEn: stage.openingLineEn,
      coachReplyZh: null,
      transcriptText: transcriptText || null,
      stageState: currentMemory,
      stageCompleted: false,
      outcomeKey: null,
      matchedTransition: null,
      nextStage: null,
      nextAction: 'repeat_role_line',
    }
  }

  if (routerIntent === 'ask_coach' || routerIntent === 'request_hint' || routerIntent === 'mixed') {
    const coach = await coachDialogueLearner({
      scenario: scenarioContext,
      node: nodeContext,
      userQuestion: questionText,
      mode: routerIntent === 'request_hint' ? 'hint' : routerIntent === 'mixed' ? 'mixed' : 'explanation',
      betterAnswerEn: answerText || '',
    })

    const nextAction = routerIntent === 'request_hint' ? 'hint' : routerIntent === 'mixed' ? 'mixed_coach' : 'coach'
    const attempt = await recordScenarioTurn({
      session,
      scenario,
      stage,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      coach,
      coachReplyZh: coach.coach_reply_zh,
      betterAnswerEn: coach.better_answer_en,
      stageState: currentMemory,
      nextAction,
    })

    await prisma.dialogueSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: new Date(),
      },
    })

    const reloaded = await getSessionWithContext(session.id, userId)
    if (!reloaded) {
      throw new Error('Dialogue session could not be loaded.')
    }

    return {
      ...buildSessionPayload(reloaded),
      router,
      evaluator: null,
      coach,
      attempt: serializeAttempt(attempt),
      roleReplyEn: null,
      coachReplyZh: coach.coach_reply_zh,
      transcriptText: transcriptText || null,
      stageState: currentMemory,
      stageCompleted: false,
      outcomeKey: null,
      matchedTransition: null,
      nextStage: null,
      nextAction,
    }
  }

  if (routerIntent === 'skip') {
    const transition = matchTransitionForOutcome({
      scenario,
      stage,
      outcomeKey: 'skip',
    })
    const nextStage =
      transition?.toStageId
        ? scenario.stages.find((entry) => entry.id === transition.toStageId) || null
        : null
    const stageCompleted = Boolean(transition)
    const roleReplyEn = nextStage ? nextStage.openingLineEn : null
    const coachReplyZh = stageCompleted
      ? '好的，我们跳过当前阶段，继续下一个阶段。'
      : '当前阶段没有配置 skip 分支，你可以请求提示，或继续尝试回答。'
    const nextAction = stageCompleted ? 'skip' : 'skip_unavailable'
    const skipMemory = stageCompleted
      ? completeStageMemory({
          memory: currentMemory,
          stage,
          outcomeKey: 'skip',
          nextStage,
          userText,
        })
      : currentMemory
    const attempt = await recordScenarioTurn({
      session,
      scenario,
      stage,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      roleReplyEn,
      coachReplyZh,
      stageState: skipMemory,
      nextAction,
    })

    if (stageCompleted) {
      await prisma.dialogueSession.update({
        where: { id: session.id },
        data: {
          currentStageId: nextStage?.id || null,
          stageStateJson: safeJsonStringify(skipMemory),
          status: nextStage ? 'active' : 'completed',
          completedAt: nextStage ? null : new Date(),
          completedNodeCount: {
            increment: 1,
          },
          lastActivityAt: new Date(),
        },
      })
    } else {
      await prisma.dialogueSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      })
    }

    const reloaded = await getSessionWithContext(session.id, userId)
    if (!reloaded) {
      throw new Error('Dialogue session could not be loaded.')
    }

    return {
      ...buildSessionPayload(reloaded),
      router,
      evaluator: null,
      coach: null,
      attempt: serializeAttempt(attempt),
      roleReplyEn,
      coachReplyZh,
      transcriptText: transcriptText || null,
      stageState: skipMemory,
      stageCompleted,
      outcomeKey: 'skip',
      matchedTransition: serializeTransition(transition, stageCompleted ? 1 : null, 'Matched skip control action.'),
      nextStage: serializeStage(nextStage),
      nextAction,
    }
  }

  const agent = await runDialogueStageAgent({
    scenario: scenarioContext,
    stage: stageContext,
    userText: answerText,
    stageState: currentStageState,
    globalSlots: currentMemory.globalSlots,
    history: currentMemory.history,
    recentTurns: getRecentTurns(session, stage.id),
  })
  const nextStageState = mergeStageState(currentStageState, parseAgentState(agent.stageStateJson))
  const assessment = buildAssessmentFromStageAgent(agent.assessment)
  const profileEvents = buildProfileEventsFromAssessment({
    assessment,
    scenarioId: session.scenarioId,
    stageId: stage.id,
  })
  const stageOutcomeKeys = getStageOutcomeKeys(stage)
  const requiresOutcome = stageOutcomeKeys.length > 0
  const stageCompleted = Boolean(agent.isStageComplete && (!requiresOutcome || agent.outcomeKey))
  const transition = stageCompleted && agent.outcomeKey
    ? matchTransitionForOutcome({
        scenario,
        stage,
        outcomeKey: agent.outcomeKey,
      })
    : null
  const nextStage =
    transition?.toStageId
      ? scenario.stages.find((entry) => entry.id === transition.toStageId) || null
      : null
  const nextMemoryBeforeTransition: ScenarioStageMemory = {
    globalSlots: applySlotUpdatesToGlobalSlots(currentMemory.globalSlots, agent.slotUpdates),
    activeStageState: nextStageState,
    history: currentMemory.history,
  }
  const nextMemory = stageCompleted
    ? completeStageMemory({
        memory: nextMemoryBeforeTransition,
        stage,
        outcomeKey: agent.outcomeKey,
        nextStage,
        userText,
      })
    : nextMemoryBeforeTransition
  const roleReplyEn = stageCompleted
    ? nextStage?.openingLineEn || agent.roleReplyEn || null
    : agent.roleReplyEn || null
  const coachReplyZh = stageCompleted ? agent.coachFeedbackZh : null
  const nextAction = stageCompleted ? 'complete_stage' : agent.nextAction
  const routerSnapshot = {
    ...router,
    stageAgent: agent,
    stageState: nextMemory,
    matchedTransition: serializeTransition(transition, agent.outcomeConfidence, 'Matched by stage outcome.'),
  }

  const attempt = await recordScenarioTurn({
    session,
    scenario,
    stage,
    inputMode,
    userText,
    transcriptText,
    routerIntent,
    router: routerSnapshot,
    coach: agent.coachFeedbackZh ? { coach_reply_zh: agent.coachFeedbackZh } : null,
    roleReplyEn,
    coachReplyZh,
    betterAnswerEn: assessment?.betterAnswerEn || null,
    assessment,
    profileEvents,
    stageState: nextMemory,
    nextAction,
  })

  if (stageCompleted) {
    await prisma.dialogueSession.update({
      where: { id: session.id },
      data: {
        currentStageId: nextStage?.id || null,
        stageStateJson: safeJsonStringify(nextMemory),
        status: nextStage ? 'active' : 'completed',
        completedAt: nextStage ? null : new Date(),
        completedNodeCount: {
          increment: 1,
        },
        totalScore: {
          increment: typeof assessment?.score === 'number' ? assessment.score : 0,
        },
        lastActivityAt: new Date(),
      },
    })
  } else {
    await prisma.dialogueSession.update({
      where: { id: session.id },
      data: {
        stageStateJson: safeJsonStringify(nextMemory),
        lastActivityAt: new Date(),
      },
    })
  }

  const reloaded = await getSessionWithContext(session.id, userId)
  if (!reloaded) {
    throw new Error('Dialogue session could not be loaded.')
  }

  return {
    ...buildSessionPayload(reloaded),
    router: routerSnapshot,
    evaluator: assessment
      ? {
          passed: Boolean(assessment.passed),
          score: assessment.score || 0,
          coach_feedback_zh: assessment.feedbackZh || agent.coachFeedbackZh || '',
          better_answer_en: assessment.betterAnswerEn || '',
          missing_points: assessment.missingPoints || [],
          covered_points: assessment.coveredPoints || [],
        }
      : null,
    coach: null as DialogueCoachOutput | null,
    attempt: serializeAttempt(attempt),
    roleReplyEn,
    coachReplyZh,
    transcriptText: transcriptText || null,
    stageState: nextMemory,
    stageCompleted,
    outcomeKey: agent.outcomeKey,
    outcomeConfidence: agent.outcomeConfidence,
    matchedTransition: serializeTransition(transition, agent.outcomeConfidence, 'Matched by stage outcome.'),
    nextStage: serializeStage(nextStage),
    nextAction,
  }
}

export async function askDialogueCoach({
  sessionId,
  userId,
  question,
  mode,
}: {
  sessionId: string
  userId: string
  question: string
  mode: 'explanation' | 'translation' | 'hint' | 'feedback'
}) {
  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    throw new Error('Dialogue session not found.')
  }

  if (session.status !== 'active') {
    throw new Error('Dialogue session is not active.')
  }

  const scenario = requireScenario(session)
  const stage = getCurrentStage(session)

  if (!stage) {
    throw new Error('Dialogue session has no current stage.')
  }

  const coach = await coachDialogueLearner({
    scenario: scenarioToContext(scenario),
    node: stageToLegacyNodeContext(stage),
    userQuestion: question,
    mode,
    betterAnswerEn: '',
  })

  const routerIntent = mode === 'hint' ? 'request_hint' : 'ask_coach'
  const stageState = parseScenarioStageMemory(session.stageStateJson)
  const nextAction = mode === 'hint' ? 'hint' : 'coach'
  const attempt = await recordScenarioTurn({
    session,
    scenario,
    stage,
    inputMode: 'text',
    userText: question,
    routerIntent,
    router: { intent: routerIntent, mode, confidence: 1 },
    coach,
    coachReplyZh: coach.coach_reply_zh,
    betterAnswerEn: coach.better_answer_en,
    stageState,
    nextAction,
  })

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: {
      lastActivityAt: new Date(),
    },
  })

  const reloaded = await getSessionWithContext(session.id, userId)
  if (!reloaded) {
    throw new Error('Dialogue session could not be loaded.')
  }

  return {
    ...buildSessionPayload(reloaded),
    coach,
    attempt: serializeAttempt(attempt),
    coachReplyZh: coach.coach_reply_zh,
    stageState,
    stageCompleted: false,
    outcomeKey: null,
    matchedTransition: null,
    nextStage: null,
    nextAction,
  }
}

export async function revealDialogueAnswer(sessionId: string, userId: string) {
  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    throw new Error('Dialogue session not found.')
  }

  const scenario = requireScenario(session)
  const stage = getCurrentStage(session)

  if (!stage) {
    throw new Error('Dialogue session has no current stage.')
  }

  const hints = parseJsonString<Record<string, unknown>>(stage.hintsJson, {})
  const sampleAnswer = String(hints.sampleAnswer || hints.example || '').trim()
  const coach: DialogueCoachOutput = {
    coach_reply_zh: sampleAnswer
      ? `推荐表达：${sampleAnswer}`
      : '这个阶段还没有配置推荐表达。你可以先回答当前角色的问题。',
    vocab_notes: [],
    grammar_notes: [],
    better_answer_en: sampleAnswer || null,
    invite_retry: true,
    tts_text_zh: sampleAnswer
      ? `推荐表达：${sampleAnswer}`
      : '这个阶段还没有配置推荐表达。你可以先回答当前角色的问题。',
  }
  const stageState = parseScenarioStageMemory(session.stageStateJson)
  const attempt = await recordScenarioTurn({
    session,
    scenario,
    stage,
    inputMode: 'text',
    userText: '[reveal_answer]',
    routerIntent: 'request_hint',
    router: { intent: 'request_hint', action: 'reveal_answer', confidence: 1 },
    coach,
    coachReplyZh: coach.coach_reply_zh,
    betterAnswerEn: sampleAnswer || null,
    stageState,
    nextAction: 'hint',
  })

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: {
      lastActivityAt: new Date(),
    },
  })

  const reloaded = await getSessionWithContext(session.id, userId)
  if (!reloaded) {
    throw new Error('Dialogue session could not be loaded.')
  }

  return {
    ...buildSessionPayload(reloaded),
    coach,
    attempt: serializeAttempt(attempt),
    coachReplyZh: coach.coach_reply_zh,
    stageState,
    stageCompleted: false,
    outcomeKey: null,
    matchedTransition: null,
    nextStage: null,
    nextAction: 'hint',
  }
}
