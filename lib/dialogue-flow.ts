import { prisma } from '@/lib/prisma'
import {
  parseJsonString,
  safeJsonStringify,
  normalizeDialogueTags,
  type DialogueInputMode,
} from '@/lib/dialogue'
import {
  coachDialogueLearner,
  evaluateDialogueAnswer,
  generateDialogueRoleFollowup,
  routeDialogueInput,
  type DialogueCoachOutput,
  type DialogueEvaluatorOutput,
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
type LoadedDialogueNode = LoadedDialogueScenario['nodes'][number]

async function getScenarioWithGraph(scenarioId: string) {
  return prisma.dialogueScenario.findUnique({
    where: { id: scenarioId },
    include: {
      nodes: {
        orderBy: { order: 'asc' },
      },
      edges: true,
    },
  })
}

async function getSessionWithContext(sessionId: string, userId: string) {
  return prisma.dialogueSession.findFirst({
    where: {
      id: sessionId,
      userId,
      mode: 'scenario',
    },
    include: {
      scenario: {
        include: {
          nodes: {
            orderBy: { order: 'asc' },
          },
          edges: true,
        },
      },
      currentNode: true,
      attempts: {
        orderBy: { createdAt: 'asc' },
        take: 80,
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

function nodeToContext(node: LoadedDialogueNode) {
  return {
    id: node.id,
    title: node.title,
    roleLineEn: node.roleLineEn,
    roleLineZh: node.roleLineZh,
    goal: node.goal,
    rubricJson: node.rubricJson,
    hintJson: node.hintJson,
    sampleAnswer: node.sampleAnswer,
    retryLimit: node.retryLimit,
    allowDynamicFollowup: node.allowDynamicFollowup,
  }
}

function serializeNode(node: LoadedDialogueNode | null) {
  if (!node) {
    return null
  }

  return {
    id: node.id,
    order: node.order,
    title: node.title,
    roleLineEn: node.roleLineEn,
    roleLineZh: node.roleLineZh,
    goal: node.goal,
    rubric: parseJsonString<Record<string, unknown>>(node.rubricJson, {}),
    hints: parseJsonString<Record<string, unknown>>(node.hintJson, {}),
    sampleAnswer: node.sampleAnswer,
    retryLimit: node.retryLimit,
    allowDynamicFollowup: node.allowDynamicFollowup,
    positionX: node.positionX,
    positionY: node.positionY,
  }
}

function serializeAttempt(attempt: LoadedDialogueSession['attempts'][number]) {
  return {
    id: attempt.id,
    nodeId: attempt.nodeId,
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

function buildSessionPayload(session: LoadedDialogueSession) {
  if (!session.scenario) {
    throw new Error('Dialogue session is not attached to a scenario.')
  }

  const scenario = session.scenario
  const tags = normalizeDialogueTags(scenario.tagsJson)
  const currentNode =
    session.currentNode
    || scenario.nodes.find((node) => node.id === session.currentNodeId)
    || null
  const averageScore =
    session.completedNodeCount > 0
      ? Math.round(session.totalScore / session.completedNodeCount)
      : 0

  return {
    session: {
      id: session.id,
      mode: session.mode,
      scenarioId: session.scenarioId,
      currentNodeId: session.currentNodeId,
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
    currentNode: serializeNode(currentNode),
    attempts: session.attempts.map(serializeAttempt),
  }
}

function getStartNode(scenario: NonNullable<DialogueScenarioWithGraph>) {
  return (
    scenario.nodes.find((node) => node.id === scenario.startNodeId)
    || scenario.nodes[0]
    || null
  )
}

function getEdge(
  scenario: LoadedDialogueScenario,
  fromNodeId: string,
  result: string
) {
  return scenario.edges.find((edge) => edge.fromNodeId === fromNodeId && edge.onResult === result) || null
}

async function buildNextRoleReply({
  scenario,
  nextNode,
  learnerAnswer,
}: {
  scenario: LoadedDialogueScenario
  nextNode: LoadedDialogueNode | null
  learnerAnswer: string
}) {
  if (!nextNode) {
    return null
  }

  if (!nextNode.allowDynamicFollowup) {
    return nextNode.roleLineEn
  }

  try {
    const followup = await generateDialogueRoleFollowup({
      scenario: scenarioToContext(scenario),
      node: nodeToContext(nextNode),
      learnerAnswer,
    })
    const prefix = followup.role_reply_en.trim()
    return prefix ? `${prefix} ${nextNode.roleLineEn}` : nextNode.roleLineEn
  } catch (error) {
    console.error('Dialogue role followup failed:', error)
    return nextNode.roleLineEn
  }
}

async function advanceFromNode({
  scenario,
  node,
  result,
  scoreToAdd,
}: {
  scenario: LoadedDialogueScenario
  node: LoadedDialogueNode
  result: 'pass' | 'fail' | 'max_retry'
  scoreToAdd: number
}) {
  const edge = getEdge(scenario, node.id, result)

  if (!edge) {
    if (result === 'pass') {
      return {
        currentNodeId: null,
        status: 'completed',
        completedAt: new Date(),
        completedDelta: 1,
      } as const
    }

    return {
      currentNodeId: node.id,
      status: 'active',
      completedAt: null,
      completedDelta: 0,
    } as const
  }

  if (!edge.toNodeId) {
    return {
      currentNodeId: null,
      status: 'completed',
      completedAt: new Date(),
      completedDelta: 1,
    } as const
  }

  return {
    currentNodeId: edge.toNodeId,
    status: 'active',
    completedAt: null,
    completedDelta: result === 'fail' ? 0 : 1,
    scoreToAdd,
  } as const
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

function inferIssueType(value: string): AssessmentIssueType {
  const text = value.toLowerCase()

  if (text.includes('tense') || text.includes('grammar') || text.includes('时态') || text.includes('语法')) {
    return 'grammar_tense'
  }

  if (text.includes('vocab') || text.includes('word') || text.includes('词汇') || text.includes('用词')) {
    return 'vocab_limited'
  }

  if (text.includes('pronunciation') || text.includes('accent') || text.includes('发音')) {
    return 'pronunciation_low_confidence'
  }

  if (text.includes('tone') || text.includes('polite') || text.includes('direct') || text.includes('语气') || text.includes('礼貌')) {
    return 'tone_too_direct'
  }

  if (text.includes('goal') || text.includes('missing') || text.includes('objective') || text.includes('目的') || text.includes('要点')) {
    return 'goal_missing'
  }

  if (text.includes('fluency') || text.includes('pause') || text.includes('停顿') || text.includes('流利')) {
    return 'fluency_pause'
  }

  if (text.includes('short') || text.includes('too brief') || text.includes('太短')) {
    return 'sentence_too_short'
  }

  return 'other'
}

function buildAssessmentFromEvaluator(evaluator: DialogueEvaluatorOutput): Assessment {
  const issueSeed = [
    evaluator.major_issue || '',
    ...evaluator.missing_points,
  ].join(' ')
  const issueTypes = evaluator.passed ? [] : [inferIssueType(issueSeed)]

  return {
    score: evaluator.score,
    passed: evaluator.passed,
    goalAchieved: evaluator.goal_achieved,
    issueTypes,
    feedbackZh: evaluator.coach_feedback_zh,
    betterAnswerEn: evaluator.better_answer_en,
    coveredPoints: evaluator.covered_points,
    missingPoints: evaluator.missing_points,
    raw: evaluator,
  }
}

function buildProfileEventsFromAssessment({
  assessment,
  mode,
  scenarioId,
  nodeId,
}: {
  assessment: Assessment | null
  mode: 'scenario'
  scenarioId: string | null
  nodeId: string | null
}): ProfileEvent[] {
  if (!assessment || assessment.passed || !assessment.issueTypes.length) {
    return []
  }

  const score = typeof assessment.score === 'number' ? assessment.score : 0
  const severity = score < 60 ? 'high' : score < 80 ? 'medium' : 'low'
  const evidence =
    assessment.missingPoints?.join(' / ')
    || assessment.feedbackZh
    || 'The learner answer did not fully satisfy the current scene goal.'

  return assessment.issueTypes.map((type) => ({
    type,
    severity,
    evidence,
    suggestion: assessment.betterAnswerEn || assessment.feedbackZh || '',
    mode,
    scenarioId,
    nodeId,
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

  if (roleReplyEn) {
    return {
      role: 'role',
      text: roleReplyEn,
      language: 'en',
      speechText: roleReplyEn,
      metadata,
    }
  }

  return null
}

async function recordScenarioTurn({
  session,
  scenario,
  node,
  inputMode,
  userText,
  transcriptText,
  routerIntent,
  router,
  evaluator,
  coach,
  roleReplyEn,
  coachReplyZh,
  betterAnswerEn,
  passed,
  score,
  nextAction,
}: {
  session: LoadedDialogueSession
  scenario: LoadedDialogueScenario
  node: LoadedDialogueNode
  inputMode: DialogueInputMode
  userText: string
  transcriptText?: string | null
  routerIntent: string
  router: unknown
  evaluator?: DialogueEvaluatorOutput | null
  coach?: DialogueCoachOutput | Record<string, unknown> | null
  roleReplyEn?: string | null
  coachReplyZh?: string | null
  betterAnswerEn?: string | null
  passed?: boolean | null
  score?: number | null
  nextAction: string
}) {
  const assessment = evaluator ? buildAssessmentFromEvaluator(evaluator) : null
  const profileEvents = buildProfileEventsFromAssessment({
    assessment,
    mode: 'scenario',
    scenarioId: session.scenarioId,
    nodeId: node.id,
  })
  const aiReply = buildAiReply({
    roleReplyEn,
    coachReplyZh,
    betterAnswerEn,
    metadata: {
      scenarioId: scenario.id,
      nodeId: node.id,
      nextAction,
    },
  })
  const result = await recordCompletedConversationTurn({
    sessionId: session.id,
    userId: session.userId,
    scenarioId: session.scenarioId,
    nodeId: node.id,
    inputMode: normalizeConversationInputMode(inputMode),
    transcriptSource: getTranscriptSource(inputMode),
    userText,
    transcript: {
      text: transcriptText || userText,
      source: getTranscriptSource(inputMode),
      language: 'en',
    },
    routerIntent,
    router,
    evaluator,
    coach,
    aiReply,
    assessment,
    profileEvents,
    roleReplyEn,
    coachReplyZh,
    betterAnswerEn,
    passed: passed ?? evaluator?.passed ?? null,
    score: score ?? evaluator?.score ?? null,
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

  const startNode = getStartNode(scenario)

  if (!startNode) {
    throw new Error('Dialogue scenario has no starting node.')
  }

  const session = await prisma.dialogueSession.create({
    data: {
      mode: 'scenario',
      scenarioId,
      userId,
      currentNodeId: startNode.id,
      status: 'active',
      metadataJson: safeJsonStringify({
        scenarioTitle: scenario.title,
        startNodeId: startNode.id,
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
  const startNode = getStartNode(scenario)

  if (!startNode) {
    throw new Error('Dialogue scenario has no starting node.')
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
      currentNodeId: startNode.id,
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
  const node =
    session.currentNode
    || scenario.nodes.find((entry) => entry.id === session.currentNodeId)
    || null

  if (!node) {
    throw new Error('Dialogue session has no current node.')
  }

  const scenarioContext = scenarioToContext(scenario)
  const nodeContext = nodeToContext(node)
  const router = await routeDialogueInput({
    scenario: scenarioContext,
    node: nodeContext,
    userText,
  })

  const routerIntent = router.intent
  const answerText = (router.sceneAnswerText || userText).trim()
  const questionText = (router.questionText || userText).trim()
  const previousFailures = session.attempts.filter(
    (attempt) => attempt.nodeId === node.id && attempt.passed === false
  ).length

  if (routerIntent === 'control') {
    let nextAction: string = router.controlAction || 'repeat'

    if (router.controlAction === 'exit') {
      await prisma.dialogueSession.update({
        where: { id: session.id },
        data: {
          status: 'abandoned',
          lastActivityAt: new Date(),
        },
      })
      nextAction = 'exit'
    } else if (router.controlAction === 'continue') {
      const lastPassedAttempt = [...session.attempts]
        .reverse()
        .find((attempt) => attempt.nodeId === node.id && attempt.passed === true)

      if (lastPassedAttempt) {
        const advanced = await advanceFromNode({
          scenario,
          node,
          result: 'pass',
          scoreToAdd: lastPassedAttempt.score || 0,
        })
        await prisma.dialogueSession.update({
          where: { id: session.id },
          data: {
            currentNodeId: advanced.currentNodeId,
            status: advanced.status,
            completedAt: advanced.completedAt,
            completedNodeCount: {
              increment: advanced.completedDelta,
            },
            totalScore: {
              increment: advanced.completedDelta ? (lastPassedAttempt.score || 0) : 0,
            },
            lastActivityAt: new Date(),
          },
        })
        nextAction = 'advance'
      }
    }

    await recordScenarioTurn({
      session,
      scenario,
      node,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      nextAction,
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
      attempt: null,
      roleReplyEn: reloaded.currentNode?.roleLineEn || null,
      coachReplyZh: null,
      transcriptText: transcriptText || null,
      nextAction,
    }
  }

  const needsCoachOnly =
    routerIntent === 'ask_explanation'
    || routerIntent === 'ask_translation'
    || routerIntent === 'ask_hint'

  if (needsCoachOnly) {
    const coach = await coachDialogueLearner({
      scenario: scenarioContext,
      node: nodeContext,
      userQuestion: questionText,
      mode:
        routerIntent === 'ask_translation'
          ? 'translation'
          : routerIntent === 'ask_hint'
            ? 'hint'
            : 'explanation',
    })

    const attempt = await recordScenarioTurn({
      session,
      scenario,
      node,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      coach,
      coachReplyZh: coach.coach_reply_zh,
      betterAnswerEn: coach.better_answer_en,
      nextAction: 'coach',
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
      nextAction: 'coach',
    }
  }

  const evaluator = await evaluateDialogueAnswer({
    scenario: scenarioContext,
    node: nodeContext,
    answerText,
    previousFailures,
  })

  if (routerIntent === 'mixed') {
    const coach = await coachDialogueLearner({
      scenario: scenarioContext,
      node: nodeContext,
      userQuestion: questionText,
      mode: 'mixed',
      lastEvaluator: evaluator,
      betterAnswerEn: evaluator.better_answer_en,
    })

    const attempt = await recordScenarioTurn({
      session,
      scenario,
      node,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      router,
      evaluator,
      coach,
      coachReplyZh: coach.coach_reply_zh,
      betterAnswerEn: evaluator.better_answer_en || coach.better_answer_en,
      passed: evaluator.passed,
      score: evaluator.score,
      nextAction: 'mixed_review',
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
      evaluator,
      coach,
      attempt: serializeAttempt(attempt),
      roleReplyEn: null,
      coachReplyZh: coach.coach_reply_zh,
      transcriptText: transcriptText || null,
      nextAction: 'mixed_review',
    }
  }

  const currentFailureCount = evaluator.passed ? previousFailures : previousFailures + 1
  const reachedRetryLimit = !evaluator.passed && currentFailureCount >= node.retryLimit
  const advanceResult = evaluator.passed ? 'pass' : reachedRetryLimit ? 'max_retry' : null
  const nextAction = evaluator.passed ? 'advance' : reachedRetryLimit ? 'max_retry' : 'retry'
  let nextNodeId = node.id
  let nextStatus = 'active'
  let completedAt: Date | null = null
  let completedDelta = 0

  if (advanceResult) {
    const advanced = await advanceFromNode({
      scenario,
      node,
      result: advanceResult,
      scoreToAdd: evaluator.score,
    })
    nextNodeId = advanced.currentNodeId || ''
    nextStatus = advanced.status
    completedAt = advanced.completedAt
    completedDelta = advanced.completedDelta
  }

  const nextNode =
    nextNodeId
      ? scenario.nodes.find((entry) => entry.id === nextNodeId) || null
      : null
  const roleReplyEn = advanceResult && nextNode
    ? await buildNextRoleReply({
        scenario,
        nextNode,
        learnerAnswer: answerText,
      })
    : null

  const attempt = await recordScenarioTurn({
    session,
    scenario,
    node,
    inputMode,
    userText,
    transcriptText,
    routerIntent,
    router,
    evaluator,
    coach: {
      coach_reply_zh: evaluator.coach_feedback_zh,
      better_answer_en: evaluator.better_answer_en,
    },
    roleReplyEn,
    coachReplyZh: evaluator.coach_feedback_zh,
    betterAnswerEn: evaluator.better_answer_en,
    passed: evaluator.passed,
    score: evaluator.score,
    nextAction,
  })

  await prisma.dialogueSession.update({
    where: { id: session.id },
    data: {
      currentNodeId: nextNodeId || null,
      status: nextStatus,
      completedAt,
      completedNodeCount: {
        increment: completedDelta,
      },
      totalScore: {
        increment: completedDelta ? evaluator.score : 0,
      },
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
    evaluator,
    coach: null as DialogueCoachOutput | null,
    attempt: serializeAttempt(attempt),
    roleReplyEn,
    coachReplyZh: evaluator.coach_feedback_zh,
    transcriptText: transcriptText || null,
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
  const node =
    session.currentNode
    || scenario.nodes.find((entry) => entry.id === session.currentNodeId)
    || null

  if (!node) {
    throw new Error('Dialogue session has no current node.')
  }

  const lastAttempt = [...session.attempts]
    .reverse()
    .find((attempt) => attempt.nodeId === node.id && attempt.evaluatorJson)
  const lastEvaluator = parseJsonString<DialogueEvaluatorOutput | null>(lastAttempt?.evaluatorJson, null)
  const coach = await coachDialogueLearner({
    scenario: scenarioToContext(scenario),
    node: nodeToContext(node),
    userQuestion: question,
    mode,
    lastEvaluator,
    betterAnswerEn: lastAttempt?.betterAnswerEn || node.sampleAnswer,
  })

  const routerIntent = mode === 'hint' ? 'ask_hint' : mode === 'translation' ? 'ask_translation' : 'ask_explanation'
  const attempt = await recordScenarioTurn({
    session,
    scenario,
    node,
    inputMode: 'text',
    userText: question,
    routerIntent,
    router: { intent: mode, confidence: 1 },
    coach,
    coachReplyZh: coach.coach_reply_zh,
    betterAnswerEn: coach.better_answer_en,
    nextAction: 'coach',
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
    nextAction: 'coach',
  }
}

export async function revealDialogueAnswer(sessionId: string, userId: string) {
  const session = await getSessionWithContext(sessionId, userId)

  if (!session) {
    throw new Error('Dialogue session not found.')
  }

  const scenario = requireScenario(session)
  const node =
    session.currentNode
    || scenario.nodes.find((entry) => entry.id === session.currentNodeId)
    || null

  if (!node) {
    throw new Error('Dialogue session has no current node.')
  }

  const coach: DialogueCoachOutput = {
    coach_reply_zh: node.sampleAnswer
      ? `推荐回答：${node.sampleAnswer}`
      : '这个节点还没有配置推荐答案。',
    vocab_notes: [],
    grammar_notes: [],
    better_answer_en: node.sampleAnswer || null,
    invite_retry: true,
    tts_text_zh: node.sampleAnswer
      ? `推荐回答：${node.sampleAnswer}`
      : '这个节点还没有配置推荐答案。',
  }

  const attempt = await recordScenarioTurn({
    session,
    scenario,
    node,
    inputMode: 'text',
    userText: '[reveal_answer]',
    routerIntent: 'ask_hint',
    router: { intent: 'reveal_answer', confidence: 1 },
    coach,
    coachReplyZh: coach.coach_reply_zh,
    betterAnswerEn: node.sampleAnswer || null,
    nextAction: 'coach',
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
    nextAction: 'coach',
  }
}
