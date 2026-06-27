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
  type DialogueEdgeResult,
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
  onResult: DialogueEdgeResult
  label: string
  conditionJson: string
  priority: number
  isFallback: boolean
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

  if (!id) {
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
  const priority = Number(candidate.priority)

  return {
    id: String(candidate.id || '').trim() || undefined,
    fromNodeId,
    onResult,
    label: String(candidate.label || '').trim(),
    conditionJson: normalizeJsonField(candidate.conditionJson ?? candidate.condition, '{}'),
    priority: Number.isFinite(priority) ? Math.round(priority) : 0,
    isFallback: Boolean(candidate.isFallback),
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

  const fallbackEdgeKeys = new Set<string>()
  const validEdges: DialogueAdminEdgePayload[] = []

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      throw new Error(`Edge references unknown fromNodeId: ${edge.fromNodeId}`)
    }

    if (edge.toNodeId && !nodeIds.has(edge.toNodeId)) {
      throw new Error(`Edge references unknown toNodeId: ${edge.toNodeId}`)
    }

    const edgeKey = `${edge.fromNodeId}:${edge.onResult}`
    if (edge.isFallback && fallbackEdgeKeys.has(edgeKey)) {
      throw new Error(`Duplicate fallback ${edge.onResult} edge for node ${edge.fromNodeId}`)
    }
    if (edge.isFallback) {
      fallbackEdgeKeys.add(edgeKey)
    }
    validEdges.push(edge)
  }
  const passEdgesByNode = new Map<string, DialogueAdminEdgePayload[]>()
  for (const edge of validEdges) {
    if (edge.onResult !== 'pass') {
      continue
    }

    passEdgesByNode.set(edge.fromNodeId, [...(passEdgesByNode.get(edge.fromNodeId) || []), edge])
  }

  for (const [fromNodeId, nodePassEdges] of passEdgesByNode) {
    if (nodePassEdges.length <= 1) {
      continue
    }

    for (const edge of nodePassEdges) {
      if (!edge.isFallback && edge.conditionJson === '{}') {
        throw new Error(`Pass edge from ${fromNodeId} needs conditionJson unless it is fallback.`)
      }
    }
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
    edges: validEdges.sort((left, right) => left.priority - right.priority),
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

  const fallbackEdgeKeys = new Set<string>()
  const passEdgesByNode = new Map<string, DialogueAdminEdgePayload[]>()
  for (const edge of payload.edges) {
    const edgeKey = `${edge.fromNodeId}:${edge.onResult}`
    if (edge.isFallback && fallbackEdgeKeys.has(edgeKey)) {
      throw new Error(`Only one fallback ${edge.onResult} edge is allowed for node ${edge.fromNodeId}.`)
    }
    if (edge.isFallback) {
      fallbackEdgeKeys.add(edgeKey)
    }
    if (edge.onResult === 'pass') {
      passEdgesByNode.set(edge.fromNodeId, [...(passEdgesByNode.get(edge.fromNodeId) || []), edge])
    }
  }

  for (const [fromNodeId, nodePassEdges] of passEdgesByNode) {
    if (nodePassEdges.length <= 1) {
      continue
    }

    for (const edge of nodePassEdges) {
      if (!edge.isFallback && edge.conditionJson === '{}') {
        throw new Error(`Pass edge from ${fromNodeId} needs conditionJson unless it is fallback.`)
      }
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
