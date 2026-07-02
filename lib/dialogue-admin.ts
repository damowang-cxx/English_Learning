import {
  DEFAULT_DIALOGUE_COACH_VOICE,
  DEFAULT_DIALOGUE_ROLE_VOICE,
  normalizeDialoguePosition,
  normalizeDialogueTags,
  normalizeDialogueVoice,
  parseJsonString,
  safeJsonStringify,
} from '@/lib/dialogue'

export interface DialogueAdminStagePayload {
  id: string
  order: number
  title: string
  openingLineEn: string
  openingLineZh: string | null
  objective: string
  slotsJson: string
  completionJson: string
  assessmentJson: string
  hintsJson: string
  outcomesJson: string
  positionX: number
  positionY: number
}

export interface DialogueAdminTransitionPayload {
  id?: string
  fromStageId: string
  outcomeKey: string
  label: string
  conditionJson: string
  priority: number
  isFallback: boolean
  toStageId: string | null
}

export interface DialogueAdminScenarioPayload {
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
  tags: string[]
  coverUrl: string | null
  startStageId: string | null
  roleVoice: string
  coachVoice: string
  stages: DialogueAdminStagePayload[]
  transitions: DialogueAdminTransitionPayload[]
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

function parseObject(value: string) {
  return parseJsonString<Record<string, unknown>>(value, {})
}

function parseArray(value: string) {
  return parseJsonString<unknown[]>(value, [])
}

function normalizeStage(value: unknown, index: number): DialogueAdminStagePayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const id = String(candidate.id || '').trim()
  const order = Number(candidate.order)

  if (!id) {
    return null
  }

  return {
    id,
    order: Number.isFinite(order) ? Math.round(order) : index,
    title: String(candidate.title || '').trim(),
    openingLineEn: String(candidate.openingLineEn || '').trim(),
    openingLineZh: String(candidate.openingLineZh || '').trim() || null,
    objective: String(candidate.objective || '').trim(),
    slotsJson: normalizeJsonField(candidate.slotsJson ?? candidate.slots, '[]'),
    completionJson: normalizeJsonField(candidate.completionJson ?? candidate.completion, '{}'),
    assessmentJson: normalizeJsonField(candidate.assessmentJson ?? candidate.assessment, '{}'),
    hintsJson: normalizeJsonField(candidate.hintsJson ?? candidate.hints, '{}'),
    outcomesJson: normalizeJsonField(candidate.outcomesJson ?? candidate.outcomes, '[]'),
    positionX: normalizeDialoguePosition(candidate.positionX),
    positionY: normalizeDialoguePosition(candidate.positionY),
  }
}

function normalizeTransition(value: unknown): DialogueAdminTransitionPayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const fromStageId = String(candidate.fromStageId || '').trim()
  const toStageId = String(candidate.toStageId || '').trim()
  const outcomeKey = String(candidate.outcomeKey || '').trim()
  const priority = Number(candidate.priority)

  if (!fromStageId || !outcomeKey) {
    return null
  }

  return {
    id: String(candidate.id || '').trim() || undefined,
    fromStageId,
    outcomeKey,
    label: String(candidate.label || '').trim(),
    conditionJson: normalizeJsonField(candidate.conditionJson ?? candidate.condition, '{}'),
    priority: Number.isFinite(priority) ? Math.round(priority) : 0,
    isFallback: Boolean(candidate.isFallback),
    toStageId: toStageId || null,
  }
}

function getSlotKeys(stage: DialogueAdminStagePayload, requiredOnly: boolean) {
  return parseArray(stage.slotsJson)
    .map((slot) => slot && typeof slot === 'object' ? slot as Record<string, unknown> : null)
    .filter((slot): slot is Record<string, unknown> => Boolean(slot))
    .filter((slot) => !requiredOnly || slot.required !== false)
    .map((slot) => String(slot.key || '').trim())
    .filter(Boolean)
}

function getOutcomeKeys(stage: DialogueAdminStagePayload) {
  return parseArray(stage.outcomesJson)
    .map((outcome) => outcome && typeof outcome === 'object' ? outcome as Record<string, unknown> : null)
    .filter((outcome): outcome is Record<string, unknown> => Boolean(outcome))
    .map((outcome) => String(outcome.key || '').trim())
    .filter(Boolean)
}

function hasMeaningfulTransitionCondition(transition: DialogueAdminTransitionPayload) {
  const condition = parseObject(transition.conditionJson)
  const intent = String(condition.intent || '').trim()
  const keywords = Array.isArray(condition.keywords) ? condition.keywords : []
  const examples = Array.isArray(condition.examples) ? condition.examples : []
  return Boolean(intent || keywords.length || examples.length)
}

export function normalizeDialogueAdminPayload(value: unknown): DialogueAdminScenarioPayload {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const title = String(body.title || '').trim()

  if (!title) {
    throw new Error('Title is required.')
  }

  const stages = Array.isArray(body.stages)
    ? body.stages.map(normalizeStage).filter((stage): stage is DialogueAdminStagePayload => Boolean(stage))
    : []

  if (stages.length === 0) {
    throw new Error('At least one valid dialogue stage is required.')
  }

  const stageIds = new Set(stages.map((stage) => stage.id))
  const transitions = Array.isArray(body.transitions)
    ? body.transitions.map(normalizeTransition).filter((transition): transition is DialogueAdminTransitionPayload => Boolean(transition))
    : []

  const validTransitions: DialogueAdminTransitionPayload[] = []
  const fallbackKeys = new Set<string>()

  for (const transition of transitions) {
    if (!stageIds.has(transition.fromStageId)) {
      throw new Error(`Transition references unknown fromStageId: ${transition.fromStageId}`)
    }

    if (transition.toStageId && !stageIds.has(transition.toStageId)) {
      throw new Error(`Transition references unknown toStageId: ${transition.toStageId}`)
    }

    const key = `${transition.fromStageId}:${transition.outcomeKey}`
    if (transition.isFallback && fallbackKeys.has(key)) {
      throw new Error(`Duplicate fallback ${transition.outcomeKey} transition for stage ${transition.fromStageId}`)
    }
    if (transition.isFallback) {
      fallbackKeys.add(key)
    }

    validTransitions.push(transition)
  }

  const startStageId = String(body.startStageId || '').trim() || stages[0].id
  if (!stageIds.has(startStageId)) {
    throw new Error('Start stage must reference an existing stage.')
  }

  return {
    title,
    description: String(body.description || '').trim(),
    difficulty: String(body.difficulty || 'beginner').trim() || 'beginner',
    userRole: String(body.userRole || '').trim(),
    aiRole: String(body.aiRole || '').trim(),
    tags: normalizeDialogueTags(body.tags ?? body.tagsJson),
    coverUrl: String(body.coverUrl || '').trim() || null,
    startStageId,
    roleVoice: normalizeDialogueVoice(body.roleVoice, DEFAULT_DIALOGUE_ROLE_VOICE),
    coachVoice: normalizeDialogueVoice(body.coachVoice, DEFAULT_DIALOGUE_COACH_VOICE),
    stages: stages.sort((left, right) => left.order - right.order),
    transitions: validTransitions.sort((left, right) => left.priority - right.priority),
  }
}

export function validateDialoguePublishGraph(payload: DialogueAdminScenarioPayload) {
  if (!payload.title.trim()) {
    throw new Error('Title is required before publishing.')
  }

  if (!payload.startStageId) {
    throw new Error('Choose a start stage before publishing.')
  }

  if (payload.stages.length === 0) {
    throw new Error('Add at least one stage before publishing.')
  }

  const stageIds = new Set(payload.stages.map((stage) => stage.id))
  if (!stageIds.has(payload.startStageId)) {
    throw new Error('Start stage must exist before publishing.')
  }

  const transitionsByStageOutcome = new Map<string, DialogueAdminTransitionPayload[]>()
  for (const transition of payload.transitions) {
    if (!stageIds.has(transition.fromStageId)) {
      throw new Error(`Transition references unknown from stage: ${transition.fromStageId}`)
    }

    if (transition.toStageId && !stageIds.has(transition.toStageId)) {
      throw new Error(`Transition references unknown target stage: ${transition.toStageId}`)
    }

    const key = `${transition.fromStageId}:${transition.outcomeKey}`
    transitionsByStageOutcome.set(key, [...(transitionsByStageOutcome.get(key) || []), transition])
  }

  const fallbackKeys = new Set<string>()
  for (const transition of payload.transitions) {
    const key = `${transition.fromStageId}:${transition.outcomeKey}`
    if (transition.isFallback && fallbackKeys.has(key)) {
      throw new Error(`Only one fallback ${transition.outcomeKey} transition is allowed for stage ${transition.fromStageId}.`)
    }
    if (transition.isFallback) {
      fallbackKeys.add(key)
    }
  }

  for (const stage of payload.stages) {
    if (!stage.openingLineEn.trim()) {
      throw new Error(`Stage ${stage.title || stage.id} needs an English opening line.`)
    }

    if (!stage.objective.trim()) {
      throw new Error(`Stage ${stage.title || stage.id} needs an objective.`)
    }

    if (getSlotKeys(stage, true).length === 0) {
      throw new Error(`Stage ${stage.title || stage.id} needs at least one required slot.`)
    }

    for (const outcomeKey of getOutcomeKeys(stage)) {
      if (!transitionsByStageOutcome.has(`${stage.id}:${outcomeKey}`)) {
        throw new Error(`Stage ${stage.title || stage.id} outcome ${outcomeKey} needs a transition.`)
      }
    }
  }

  for (const [key, transitions] of transitionsByStageOutcome) {
    if (transitions.length <= 1) {
      continue
    }

    for (const transition of transitions) {
      if (!transition.isFallback && !hasMeaningfulTransitionCondition(transition)) {
        throw new Error(`Transition ${key} needs conditionJson unless it is fallback.`)
      }
    }
  }
}

export function serializeDialogueAdminScenario<
  T extends {
    tagsJson: string
    stages?: Array<{
      slotsJson: string
      completionJson: string
      assessmentJson: string
      hintsJson: string
      outcomesJson: string
    }>
    transitions?: Array<{ conditionJson: string }>
  }
>(scenario: T) {
  return {
    ...scenario,
    tags: normalizeDialogueTags(scenario.tagsJson),
    stages: scenario.stages?.map((stage) => ({
      ...stage,
      slots: parseJsonString<unknown[]>(stage.slotsJson, []),
      completion: parseJsonString<Record<string, unknown>>(stage.completionJson, {}),
      assessment: parseJsonString<Record<string, unknown>>(stage.assessmentJson, {}),
      hints: parseJsonString<Record<string, unknown>>(stage.hintsJson, {}),
      outcomes: parseJsonString<unknown[]>(stage.outcomesJson, []),
    })),
    transitions: scenario.transitions?.map((transition) => ({
      ...transition,
      condition: parseJsonString<Record<string, unknown>>(transition.conditionJson, {}),
    })),
  }
}
