import {
  DEFAULT_DIALOGUE_COACH_VOICE,
  DEFAULT_DIALOGUE_ROLE_VOICE,
  clampDialogueRetryLimit,
  isDialogueEdgeResult,
  normalizeDialoguePosition,
  normalizeDialogueTags,
  normalizeDialogueVoice,
  parseJsonString,
  safeJsonStringify,
} from '@/lib/dialogue'

export interface DialogueAdminNodePayload {
  id: string
  order: number
  title: string
  roleLineEn: string
  roleLineZh: string | null
  goal: string
  rubricJson: string
  hintJson: string
  sampleAnswer: string
  retryLimit: number
  allowDynamicFollowup: boolean
  positionX: number
  positionY: number
}

export interface DialogueAdminEdgePayload {
  id?: string
  fromNodeId: string
  onResult: 'pass' | 'fail' | 'max_retry'
  toNodeId: string | null
}

export interface DialogueAdminScenarioPayload {
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
  tags: string[]
  coverUrl: string | null
  startNodeId: string | null
  roleVoice: string
  coachVoice: string
  nodes: DialogueAdminNodePayload[]
  edges: DialogueAdminEdgePayload[]
}

function normalizeJsonField(value: unknown, fallback: '[]' | '{}') {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return fallback
    }

    try {
      JSON.parse(trimmed)
      return trimmed
    } catch {
      return fallback
    }
  }

  return safeJsonStringify(value, fallback)
}

function normalizeNode(value: unknown, index: number): DialogueAdminNodePayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const id = String(candidate.id || '').trim()
  const roleLineEn = String(candidate.roleLineEn || '').trim()
  const goal = String(candidate.goal || '').trim()

  if (!id || !roleLineEn || !goal) {
    return null
  }

  const order = Number(candidate.order)

  return {
    id,
    order: Number.isFinite(order) ? Math.round(order) : index,
    title: String(candidate.title || '').trim(),
    roleLineEn,
    roleLineZh: String(candidate.roleLineZh || '').trim() || null,
    goal,
    rubricJson: normalizeJsonField(candidate.rubricJson ?? candidate.rubric, '{}'),
    hintJson: normalizeJsonField(candidate.hintJson ?? candidate.hints, '{}'),
    sampleAnswer: String(candidate.sampleAnswer || '').trim(),
    retryLimit: clampDialogueRetryLimit(candidate.retryLimit),
    allowDynamicFollowup: Boolean(candidate.allowDynamicFollowup),
    positionX: normalizeDialoguePosition(candidate.positionX),
    positionY: normalizeDialoguePosition(candidate.positionY),
  }
}

function normalizeEdge(value: unknown): DialogueAdminEdgePayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const fromNodeId = String(candidate.fromNodeId || '').trim()
  const toNodeId = String(candidate.toNodeId || '').trim()
  const onResult = String(candidate.onResult || '').trim()

  if (!fromNodeId || !isDialogueEdgeResult(onResult)) {
    return null
  }

  return {
    id: String(candidate.id || '').trim() || undefined,
    fromNodeId,
    onResult,
    toNodeId: toNodeId || null,
  }
}

export function normalizeDialogueAdminPayload(value: unknown): DialogueAdminScenarioPayload {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const title = String(body.title || '').trim()

  if (!title) {
    throw new Error('Title is required.')
  }

  const nodes = Array.isArray(body.nodes)
    ? body.nodes.map(normalizeNode).filter((node): node is DialogueAdminNodePayload => Boolean(node))
    : []

  if (nodes.length === 0) {
    throw new Error('At least one valid dialogue node is required.')
  }

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = Array.isArray(body.edges)
    ? body.edges.map(normalizeEdge).filter((edge): edge is DialogueAdminEdgePayload => Boolean(edge))
    : []

  const dedupeEdgeKeys = new Set<string>()
  const validEdges: DialogueAdminEdgePayload[] = []

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      throw new Error(`Edge references unknown fromNodeId: ${edge.fromNodeId}`)
    }

    if (edge.toNodeId && !nodeIds.has(edge.toNodeId)) {
      throw new Error(`Edge references unknown toNodeId: ${edge.toNodeId}`)
    }

    const edgeKey = `${edge.fromNodeId}:${edge.onResult}`
    if (dedupeEdgeKeys.has(edgeKey)) {
      throw new Error(`Duplicate ${edge.onResult} edge for node ${edge.fromNodeId}`)
    }
    dedupeEdgeKeys.add(edgeKey)
    validEdges.push(edge)
  }

  const startNodeId = String(body.startNodeId || '').trim() || nodes[0].id
  if (!nodeIds.has(startNodeId)) {
    throw new Error('Start node must reference an existing node.')
  }

  return {
    title,
    description: String(body.description || '').trim(),
    difficulty: String(body.difficulty || 'beginner').trim() || 'beginner',
    userRole: String(body.userRole || '').trim(),
    aiRole: String(body.aiRole || '').trim(),
    tags: normalizeDialogueTags(body.tags ?? body.tagsJson),
    coverUrl: String(body.coverUrl || '').trim() || null,
    startNodeId,
    roleVoice: normalizeDialogueVoice(body.roleVoice, DEFAULT_DIALOGUE_ROLE_VOICE),
    coachVoice: normalizeDialogueVoice(body.coachVoice, DEFAULT_DIALOGUE_COACH_VOICE),
    nodes: nodes.sort((left, right) => left.order - right.order),
    edges: validEdges,
  }
}

export function validateDialoguePublishGraph(payload: DialogueAdminScenarioPayload) {
  if (!payload.title.trim()) {
    throw new Error('Title is required before publishing.')
  }

  if (!payload.startNodeId) {
    throw new Error('Choose a start node before publishing.')
  }

  if (payload.nodes.length === 0) {
    throw new Error('Add at least one node before publishing.')
  }

  const nodeIds = new Set(payload.nodes.map((node) => node.id))
  if (!nodeIds.has(payload.startNodeId)) {
    throw new Error('Start node must exist before publishing.')
  }

  for (const node of payload.nodes) {
    if (!node.roleLineEn.trim()) {
      throw new Error(`Node ${node.title || node.id} needs an English role line.`)
    }

    if (!node.goal.trim()) {
      throw new Error(`Node ${node.title || node.id} needs a learner goal.`)
    }
  }

  for (const edge of payload.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      throw new Error(`Edge references unknown from node: ${edge.fromNodeId}`)
    }

    if (edge.toNodeId && !nodeIds.has(edge.toNodeId)) {
      throw new Error(`Edge references unknown target node: ${edge.toNodeId}`)
    }
  }
}

export function serializeDialogueAdminScenario<
  T extends {
    tagsJson: string
    nodes?: Array<{ rubricJson: string; hintJson: string }>
  }
>(scenario: T) {
  return {
    ...scenario,
    tags: normalizeDialogueTags(scenario.tagsJson),
    nodes: scenario.nodes?.map((node) => ({
      ...node,
      rubric: parseJsonString<Record<string, unknown>>(node.rubricJson, {}),
      hints: parseJsonString<Record<string, unknown>>(node.hintJson, {}),
    })),
  }
}
