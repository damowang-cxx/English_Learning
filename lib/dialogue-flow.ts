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

type DialogueScenarioWithGraph = Awaited<ReturnType<typeof getScenarioWithGraph>>
type DialogueSessionWithContext = Awaited<ReturnType<typeof getSessionWithContext>>

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

function scenarioToContext(scenario: NonNullable<DialogueScenarioWithGraph>) {
  return {
    title: scenario.title,
    description: scenario.description,
    difficulty: scenario.difficulty,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
  }
}

function nodeToContext(node: NonNullable<DialogueSessionWithContext>['scenario']['nodes'][number]) {
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

function serializeNode(node: NonNullable<DialogueSessionWithContext>['scenario']['nodes'][number] | null) {
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

function serializeAttempt(attempt: NonNullable<DialogueSessionWithContext>['attempts'][number]) {
  return {
    id: attempt.id,
    nodeId: attempt.nodeId,
    inputMode: attempt.inputMode,
    userText: attempt.userText,
    transcriptText: attempt.transcriptText,
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

function buildSessionPayload(session: NonNullable<DialogueSessionWithContext>) {
  const tags = normalizeDialogueTags(session.scenario.tagsJson)
  const currentNode =
    session.currentNode
    || session.scenario.nodes.find((node) => node.id === session.currentNodeId)
    || null
  const averageScore =
    session.completedNodeCount > 0
      ? Math.round(session.totalScore / session.completedNodeCount)
      : 0

  return {
    session: {
      id: session.id,
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
      id: session.scenario.id,
      title: session.scenario.title,
      description: session.scenario.description,
      difficulty: session.scenario.difficulty,
      userRole: session.scenario.userRole,
      aiRole: session.scenario.aiRole,
      tags,
      coverUrl: session.scenario.coverUrl,
      roleVoice: session.scenario.roleVoice,
      coachVoice: session.scenario.coachVoice,
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
  scenario: NonNullable<DialogueSessionWithContext>['scenario'],
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
  scenario: NonNullable<DialogueSessionWithContext>['scenario']
  nextNode: NonNullable<DialogueSessionWithContext>['scenario']['nodes'][number] | null
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
  session,
  node,
  result,
  scoreToAdd,
}: {
  session: NonNullable<DialogueSessionWithContext>
  node: NonNullable<DialogueSessionWithContext>['scenario']['nodes'][number]
  result: 'pass' | 'fail' | 'max_retry'
  scoreToAdd: number
}) {
  const edge = getEdge(session.scenario, node.id, result)

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
      scenarioId,
      userId,
      currentNodeId: startNode.id,
      status: 'active',
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

  const startNode = getStartNode(session.scenario)

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

  const node =
    session.currentNode
    || session.scenario.nodes.find((entry) => entry.id === session.currentNodeId)
    || null

  if (!node) {
    throw new Error('Dialogue session has no current node.')
  }

  const scenarioContext = scenarioToContext(session.scenario)
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
          session,
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

    await prisma.dialogueAttempt.create({
      data: {
        sessionId: session.id,
        scenarioId: session.scenarioId,
        nodeId: node.id,
        userId,
        inputMode,
        userText,
        transcriptText,
        routerIntent,
        routerJson: safeJsonStringify(router),
        nextAction,
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

    const attempt = await prisma.dialogueAttempt.create({
      data: {
        sessionId: session.id,
        scenarioId: session.scenarioId,
        nodeId: node.id,
        userId,
        inputMode,
        userText,
        transcriptText,
        routerIntent,
        routerJson: safeJsonStringify(router),
        coachJson: safeJsonStringify(coach),
        coachReplyZh: coach.coach_reply_zh,
        betterAnswerEn: coach.better_answer_en,
        nextAction: 'coach',
      },
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

    const attempt = await prisma.dialogueAttempt.create({
      data: {
        sessionId: session.id,
        scenarioId: session.scenarioId,
        nodeId: node.id,
        userId,
        inputMode,
        userText,
        transcriptText,
        routerIntent,
        routerJson: safeJsonStringify(router),
        evaluatorJson: safeJsonStringify(evaluator),
        coachJson: safeJsonStringify(coach),
        coachReplyZh: coach.coach_reply_zh,
        betterAnswerEn: evaluator.better_answer_en || coach.better_answer_en,
        passed: evaluator.passed,
        score: evaluator.score,
        nextAction: 'mixed_review',
      },
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
      session,
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
      ? session.scenario.nodes.find((entry) => entry.id === nextNodeId) || null
      : null
  const roleReplyEn = advanceResult && nextNode
    ? await buildNextRoleReply({
        scenario: session.scenario,
        nextNode,
        learnerAnswer: answerText,
      })
    : null

  const attempt = await prisma.dialogueAttempt.create({
    data: {
      sessionId: session.id,
      scenarioId: session.scenarioId,
      nodeId: node.id,
      userId,
      inputMode,
      userText,
      transcriptText,
      routerIntent,
      routerJson: safeJsonStringify(router),
      evaluatorJson: safeJsonStringify(evaluator),
      coachJson: safeJsonStringify({
        coach_reply_zh: evaluator.coach_feedback_zh,
        better_answer_en: evaluator.better_answer_en,
      }),
      roleReplyEn,
      coachReplyZh: evaluator.coach_feedback_zh,
      betterAnswerEn: evaluator.better_answer_en,
      passed: evaluator.passed,
      score: evaluator.score,
      nextAction,
    },
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

  const node =
    session.currentNode
    || session.scenario.nodes.find((entry) => entry.id === session.currentNodeId)
    || null

  if (!node) {
    throw new Error('Dialogue session has no current node.')
  }

  const lastAttempt = [...session.attempts]
    .reverse()
    .find((attempt) => attempt.nodeId === node.id && attempt.evaluatorJson)
  const lastEvaluator = parseJsonString<DialogueEvaluatorOutput | null>(lastAttempt?.evaluatorJson, null)
  const coach = await coachDialogueLearner({
    scenario: scenarioToContext(session.scenario),
    node: nodeToContext(node),
    userQuestion: question,
    mode,
    lastEvaluator,
    betterAnswerEn: lastAttempt?.betterAnswerEn || node.sampleAnswer,
  })

  const attempt = await prisma.dialogueAttempt.create({
    data: {
      sessionId: session.id,
      scenarioId: session.scenarioId,
      nodeId: node.id,
      userId,
      inputMode: 'text',
      userText: question,
      routerIntent: mode === 'hint' ? 'ask_hint' : mode === 'translation' ? 'ask_translation' : 'ask_explanation',
      routerJson: safeJsonStringify({ intent: mode, confidence: 1 }),
      coachJson: safeJsonStringify(coach),
      coachReplyZh: coach.coach_reply_zh,
      betterAnswerEn: coach.better_answer_en,
      nextAction: 'coach',
    },
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

  const node =
    session.currentNode
    || session.scenario.nodes.find((entry) => entry.id === session.currentNodeId)
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

  const attempt = await prisma.dialogueAttempt.create({
    data: {
      sessionId: session.id,
      scenarioId: session.scenarioId,
      nodeId: node.id,
      userId,
      inputMode: 'text',
      userText: '[reveal_answer]',
      routerIntent: 'ask_hint',
      routerJson: safeJsonStringify({ intent: 'reveal_answer', confidence: 1 }),
      coachJson: safeJsonStringify(coach),
      coachReplyZh: coach.coach_reply_zh,
      betterAnswerEn: node.sampleAnswer || null,
      nextAction: 'coach',
    },
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
