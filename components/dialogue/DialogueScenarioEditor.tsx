'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import { AlertTriangle, CheckCircle2, GitBranch, HelpCircle, Link2, Plus, Save, Settings2, Trash2, Volume2, X } from 'lucide-react'
import { isAdminRole } from '@/lib/auth-types'
import { withBasePath } from '@/lib/base-path'
import { DIALOGUE_VOICES } from '@/lib/dialogue'

type Status = { type: 'success' | 'error' | 'info'; message: string }
type Summary = { id: string; title: string; isPublished: boolean; nodesCount: number; updatedAt: string }
type JsonObject = Record<string, unknown>
type StageSlot = { key: string; label: string; required: boolean; description: string }
type StageOutcome = { key: string; label: string; description: string }
type DStage = {
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
type Detail = {
  id: string
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
  tags: string[]
  coverUrl: string | null
  isPublished: boolean
  startStageId: string | null
  roleVoice: string
  coachVoice: string
  stages: DStage[]
  transitions: Array<{
    id: string
    fromStageId: string
    outcomeKey: string
    label: string
    conditionJson: string
    priority: number
    isFallback: boolean
    toStageId: string | null
  }>
}
type StageData = Record<string, unknown> & { label: string; stage: DStage }
type TransitionData = Record<string, unknown> & {
  outcomeKey: string
  label: string
  conditionJson: string
  priority: number
  isFallback: boolean
}
type FlowStage = Node<StageData>
type FlowTransition = Edge<TransitionData>

const fieldClass = 'w-full rounded-md border border-cyan-500/24 bg-black/45 px-3 py-2 text-sm text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60'
const compactFieldClass = 'w-full rounded-md border border-cyan-500/22 bg-black/45 px-3 py-2 text-xs text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/30 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40'
const panelClass = 'rounded-lg border border-cyan-500/18 bg-black/26 p-3'

function localStageId() {
  return `dlg_stage_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function localTransitionId() {
  return `dlg_transition_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function isJsonObjectString(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

function isJsonArrayString(value: string) {
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,，]/).map((entry) => entry.trim()).filter(Boolean)
  }
  return []
}

function cleanStringArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
}

function normalizeSlots(value: string): StageSlot[] {
  return parseJson<unknown[]>(value, [])
    .map((slot) => slot && typeof slot === 'object' ? slot as Record<string, unknown> : null)
    .filter((slot): slot is Record<string, unknown> => Boolean(slot))
    .map((slot) => ({
      key: String(slot.key || '').trim(),
      label: String(slot.label || '').trim(),
      required: slot.required !== false,
      description: String(slot.description || '').trim(),
    }))
}

function normalizeOutcomes(value: string): StageOutcome[] {
  return parseJson<unknown[]>(value, [])
    .map((outcome) => outcome && typeof outcome === 'object' ? outcome as Record<string, unknown> : null)
    .filter((outcome): outcome is Record<string, unknown> => Boolean(outcome))
    .map((outcome) => ({
      key: String(outcome.key || '').trim(),
      label: String(outcome.label || '').trim(),
      description: String(outcome.description || '').trim(),
    }))
}

function labelFor(stage: DStage) {
  return `${stage.title || `Stage ${stage.order + 1}`}\n${stage.objective || '还未设置阶段目标'}`
}

function toFlowStage(stage: DStage): FlowStage {
  return {
    id: stage.id,
    position: { x: stage.positionX, y: stage.positionY },
    data: { label: labelFor(stage), stage },
  }
}

function transitionLabel(transition: FlowTransition) {
  return typeof transition.label === 'string' && transition.label.trim()
    ? transition.label.trim()
    : String(transition.data?.outcomeKey || 'outcome')
}

function transitionPriority(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0
}

function transitionConditionJson(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : '{}'
}

function normalizeTransitionData(transition: FlowTransition): TransitionData {
  return {
    outcomeKey: String(transition.data?.outcomeKey || 'complete').trim() || 'complete',
    label: typeof transition.data?.label === 'string' && transition.data.label.trim()
      ? transition.data.label
      : transitionLabel(transition),
    conditionJson: transitionConditionJson(transition.data?.conditionJson),
    priority: transitionPriority(transition.data?.priority),
    isFallback: Boolean(transition.data?.isFallback),
  }
}

function updateFlowTransitionData(transition: FlowTransition, patch: Partial<TransitionData>): FlowTransition {
  const data = {
    ...normalizeTransitionData(transition),
    ...patch,
  }
  return {
    ...transition,
    label: data.label || data.outcomeKey,
    animated: true,
    data,
  }
}

function toFlowTransition(transition: Detail['transitions'][number]): FlowTransition {
  return {
    id: transition.id,
    source: transition.fromStageId,
    target: transition.toStageId || '',
    label: transition.label || transition.outcomeKey,
    animated: true,
    data: {
      outcomeKey: transition.outcomeKey,
      label: transition.label || transition.outcomeKey,
      conditionJson: transition.conditionJson || '{}',
      priority: transition.priority || 0,
      isFallback: Boolean(transition.isFallback),
    },
  }
}

function emptyStage(order: number): DStage {
  return {
    id: localStageId(),
    order,
    title: `阶段 ${order + 1}`,
    openingLineEn: 'Hello. What would you like to do?',
    openingLineZh: '你好，你想做什么？',
    objective: '帮助用户明确当前阶段的选择或信息。',
    slotsJson: prettyJson([
      {
        key: 'user_choice',
        label: '用户选择',
        required: true,
        description: '用户在这个阶段做出的核心选择。',
      },
    ]),
    completionJson: prettyJson({
      rule: 'Required slots are collected and the objective is achieved.',
    }),
    assessmentJson: prettyJson({
      scoringFocus: ['是否完成交际目的', '表达是否自然'],
      commonErrors: ['回答太短，没有给出足够信息'],
    }),
    hintsJson: prettyJson({
      hints: ['先说明你的选择，再补充原因或偏好。'],
      sampleAnswer: 'I think I would like to eat out today.',
    }),
    outcomesJson: prettyJson([]),
    positionX: 140 + order * 240,
    positionY: 140,
  }
}

function conditionObject(transition: FlowTransition) {
  return parseJson<JsonObject>(transitionConditionJson(transition.data?.conditionJson), {})
}

function hasMeaningfulCondition(transition: FlowTransition) {
  const condition = conditionObject(transition)
  return Boolean(String(condition.intent || '').trim() || toStringArray(condition.keywords).length || toStringArray(condition.examples).length)
}

function friendlyError(message: string) {
  if (message.includes('Title')) return '请先填写场景标题。'
  if (message.includes('stage')) return '请检查阶段配置：起始阶段、阶段目标和信息槽都需要有效。'
  if (message.includes('fallback')) return '同一个阶段、同一个 outcome 只能有一条 fallback 分支。'
  if (message.includes('transition')) return '请检查分支配置：每个 outcome 需要连接到下一阶段或结束。'
  return message
}

interface LineListEditorProps {
  label: string
  help: string
  values: string[]
  placeholder: string
  onChange: (values: string[]) => void
}

function LineListEditor({ label, help, values, placeholder, onChange }: LineListEditorProps) {
  const visibleValues = values.length ? values : ['']
  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-cyan-50">{label}</div>
          <p className="mt-1 text-xs leading-5 text-cyan-100/58">{help}</p>
        </div>
        <button type="button" className={buttonClass} onClick={() => onChange([...values, ''])}>
          <Plus className="h-3.5 w-3.5" />
          ADD
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {visibleValues.map((value, index) => (
          <div key={`${label}_${index}`} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={value}
              onChange={(event) => {
                const next = [...visibleValues]
                next[index] = event.target.value
                onChange(next)
              }}
              className={compactFieldClass}
              placeholder={placeholder}
            />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-red-400/28 px-3 py-2 text-xs text-red-200 transition-colors hover:border-red-300/60"
              onClick={() => onChange(visibleValues.filter((_, entryIndex) => entryIndex !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModalShell({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-cyan-300/28 bg-slate-950 p-5 shadow-[0_0_36px_rgba(34,211,238,0.16)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-cyan-500/18 pb-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em] text-cyan-300/65">{eyebrow}</div>
            <h2 className="mt-2 text-xl font-semibold text-cyan-50">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-cyan-500/24 p-2 text-cyan-200 transition-colors hover:border-cyan-300/60" aria-label="Close modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  )
}

export default function DialogueScenarioEditor() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [scenario, setScenario] = useState<Detail | null>(null)
  const [stages, setStages, onStagesChange] = useNodesState<FlowStage>([])
  const [transitions, setTransitions, onTransitionsChange] = useEdgesState<FlowTransition>([])
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [stageModalId, setStageModalId] = useState<string | null>(null)
  const [transitionModalId, setTransitionModalId] = useState<string | null>(null)
  const [showStageJson, setShowStageJson] = useState(false)
  const [showTransitionJson, setShowTransitionJson] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedStage = useMemo(() => stages.find((stage) => stage.id === selectedStageId) || null, [selectedStageId, stages])
  const activeStage = useMemo(() => stages.find((stage) => stage.id === stageModalId) || null, [stageModalId, stages])
  const activeTransition = useMemo(() => transitions.find((transition) => transition.id === transitionModalId) || null, [transitionModalId, transitions])

  useEffect(() => {
    if (authStatus === 'loading') return
    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/dialogue/builder')}`)
      return
    }
    if (!isAdmin) router.replace('/403')
  }, [authStatus, isAdmin, router, session?.user?.id])

  const loadSummaries = useCallback(async () => {
    const response = await fetch(withBasePath('/api/dialogue/admin/scenarios'), { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || `Load failed: ${response.status}`)
    setSummaries(payload)
  }, [])

  const loadScenario = useCallback(async (id: string) => {
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${id}`), { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `Load failed: ${response.status}`)
      const detail = payload as Detail
      setScenario(detail)
      setStages((detail.stages || []).map(toFlowStage))
      setTransitions((detail.transitions || []).filter((transition) => transition.toStageId).map(toFlowTransition))
      setSelectedStageId(detail.startStageId || detail.stages?.[0]?.id || null)
      setStageModalId(null)
      setTransitionModalId(null)
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '加载场景失败。' })
    } finally {
      setBusy(false)
    }
  }, [setStages, setTransitions])

  useEffect(() => {
    if (authStatus !== 'authenticated' || !isAdmin) return
    void loadSummaries().catch((error) => setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '加载场景列表失败。' }))
  }, [authStatus, isAdmin, loadSummaries])

  const updateScenario = <K extends keyof Detail>(key: K, value: Detail[K]) => {
    setScenario((current) => current ? { ...current, [key]: value } : current)
  }

  const updateStageById = useCallback(<K extends keyof DStage>(stageId: string, key: K, value: DStage[K]) => {
    setStages((items) => items.map((stage) => {
      if (stage.id !== stageId) return stage
      const nextStage = { ...stage.data.stage, [key]: value }
      return { ...stage, data: { ...stage.data, stage: nextStage, label: labelFor(nextStage) } }
    }))
  }, [setStages])

  const updateStageJson = useCallback((stageId: string, key: 'slotsJson' | 'outcomesJson' | 'completionJson' | 'assessmentJson' | 'hintsJson', value: unknown) => {
    updateStageById(stageId, key, prettyJson(value))
  }, [updateStageById])

  const updateTransitionById = useCallback((transitionId: string, patch: Partial<TransitionData>) => {
    setTransitions((items) => items.map((transition) => transition.id === transitionId ? updateFlowTransitionData(transition, patch) : transition))
  }, [setTransitions])

  const updateTransitionCondition = useCallback((transitionId: string, key: 'intent' | 'keywords' | 'examples', value: string | string[]) => {
    setTransitions((items) => items.map((transition) => {
      if (transition.id !== transitionId) return transition
      const condition = conditionObject(transition)
      return updateFlowTransitionData(transition, {
        conditionJson: prettyJson({
          ...condition,
          [key]: Array.isArray(value) ? cleanStringArray(value) : value,
        }),
      })
    }))
  }, [setTransitions])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    const sourceTransitionCount = transitions.filter((transition) => transition.source === connection.source).length
    const transitionId = localTransitionId()
    setTransitions((items) => addEdge({
      id: transitionId,
      source: connection.source || '',
      target: connection.target || '',
      label: 'complete',
      animated: true,
      data: {
        outcomeKey: 'complete',
        label: 'complete',
        conditionJson: prettyJson({ intent: '', keywords: [], examples: [] }),
        priority: sourceTransitionCount,
        isFallback: false,
      },
    }, items))
    setTransitionModalId(transitionId)
    setShowTransitionJson(false)
  }, [setTransitions, transitions])

  const addStage = () => {
    if (!scenario) return
    const stage = emptyStage(stages.length)
    const parentStage = selectedStageId ? stages.find((item) => item.id === selectedStageId) : null
    if (parentStage) {
      const siblingCount = transitions.filter((transition) => transition.source === parentStage.id).length
      stage.positionX = parentStage.position.x + siblingCount * 260
      stage.positionY = parentStage.position.y + 220
    }
    setStages((items) => [...items, toFlowStage(stage)])
    setSelectedStageId(stage.id)
    setStageModalId(stage.id)
    setShowStageJson(false)
    if (!scenario.startStageId) updateScenario('startStageId', stage.id)
  }

  const deleteStage = (stageId: string) => {
    setStages((items) => items.filter((stage) => stage.id !== stageId))
    setTransitions((items) => items.filter((transition) => transition.source !== stageId && transition.target !== stageId))
    setScenario((current) => current?.startStageId === stageId ? { ...current, startStageId: null } : current)
    setSelectedStageId((current) => current === stageId ? null : current)
    setStageModalId(null)
  }

  const deleteTransition = (transitionId: string) => {
    setTransitions((items) => items.filter((transition) => transition.id !== transitionId))
    setTransitionModalId(null)
  }

  const createScenario = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(withBasePath('/api/dialogue/admin/scenarios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New dialogue scenario' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `Create failed: ${response.status}`)
      await loadSummaries()
      await loadScenario(payload.id)
      setStatus({ type: 'success', message: '场景已创建。点击阶段即可设置自适应对话规则。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '创建场景失败。' })
    } finally {
      setBusy(false)
    }
  }

  const collectValidationErrors = (requirePublishReady: boolean) => {
    const errors: string[] = []
    const stageIds = new Set(stages.map((stage) => stage.id))

    if (!scenario) return ['请选择或创建一个场景。']
    if (!scenario.title.trim()) errors.push('请先填写场景标题。')
    if (stages.length === 0) errors.push('至少需要一个阶段。')
    if (scenario.startStageId && !stageIds.has(scenario.startStageId)) errors.push('起始阶段不存在，请重新选择。')
    if (requirePublishReady && !scenario.startStageId) errors.push('发布前必须选择起始阶段。')

    const transitionsByStageOutcome = new Map<string, FlowTransition[]>()
    for (const transition of transitions) {
      if (!stageIds.has(transition.source) || !stageIds.has(transition.target)) errors.push(`分支 ${transitionLabel(transition)} 引用了不存在的阶段。`)
      if (!isJsonObjectString(transitionConditionJson(transition.data?.conditionJson))) errors.push(`分支 ${transitionLabel(transition)} 的语义条件 JSON 格式不正确。`)
      const outcomeKey = String(transition.data?.outcomeKey || '').trim()
      const key = `${transition.source}:${outcomeKey}`
      transitionsByStageOutcome.set(key, [...(transitionsByStageOutcome.get(key) || []), transition])
    }

    const fallbackKeys = new Set<string>()
    for (const transition of transitions) {
      const outcomeKey = String(transition.data?.outcomeKey || '').trim()
      const key = `${transition.source}:${outcomeKey}`
      if (transition.data?.isFallback && fallbackKeys.has(key)) errors.push(`阶段 ${transition.source} 的 ${outcomeKey} 结果只能有一条 fallback 分支。`)
      if (transition.data?.isFallback) fallbackKeys.add(key)
    }

    for (const stage of stages) {
      if (!isJsonArrayString(stage.data.stage.slotsJson)) errors.push(`${stage.data.stage.title || stage.id} 的信息槽 JSON 格式不正确。`)
      if (!isJsonArrayString(stage.data.stage.outcomesJson)) errors.push(`${stage.data.stage.title || stage.id} 的结果 JSON 格式不正确。`)
      if (!isJsonObjectString(stage.data.stage.completionJson)) errors.push(`${stage.data.stage.title || stage.id} 的完成规则 JSON 格式不正确。`)
      if (!isJsonObjectString(stage.data.stage.assessmentJson)) errors.push(`${stage.data.stage.title || stage.id} 的评分规则 JSON 格式不正确。`)
      if (!isJsonObjectString(stage.data.stage.hintsJson)) errors.push(`${stage.data.stage.title || stage.id} 的提示 JSON 格式不正确。`)

      if (requirePublishReady && !stage.data.stage.openingLineEn.trim()) errors.push(`${stage.data.stage.title || stage.id} 缺少英文开场台词。`)
      if (requirePublishReady && !stage.data.stage.objective.trim()) errors.push(`${stage.data.stage.title || stage.id} 缺少阶段目标。`)
      if (requirePublishReady && normalizeSlots(stage.data.stage.slotsJson).filter((slot) => slot.required && slot.key).length === 0) errors.push(`${stage.data.stage.title || stage.id} 至少需要一个 required slot。`)
      for (const outcome of normalizeOutcomes(stage.data.stage.outcomesJson)) {
        if (outcome.key && !transitionsByStageOutcome.has(`${stage.id}:${outcome.key}`)) {
          errors.push(`${stage.data.stage.title || stage.id} 的 outcome ${outcome.key} 需要连接一个分支。`)
        }
      }
    }

    for (const [key, groupedTransitions] of transitionsByStageOutcome) {
      if (groupedTransitions.length <= 1) continue
      for (const transition of groupedTransitions) {
        if (!transition.data?.isFallback && !hasMeaningfulCondition(transition)) {
          errors.push(`${key} 有多条分支，非 fallback 分支必须填写意图、关键词或示例回答。`)
        }
      }
    }

    return [...new Set(errors)]
  }

  const buildSavePayload = () => {
    if (!scenario) return null
    return {
      ...scenario,
      stages: stages.map((stage, index) => ({
        ...stage.data.stage,
        order: index,
        positionX: stage.position.x,
        positionY: stage.position.y,
      })),
      transitions: transitions.map((transition) => ({
        id: transition.id,
        fromStageId: transition.source,
        toStageId: transition.target,
        outcomeKey: String(transition.data?.outcomeKey || 'complete').trim() || 'complete',
        label: transitionLabel(transition),
        conditionJson: transitionConditionJson(transition.data?.conditionJson),
        priority: transitionPriority(transition.data?.priority),
        isFallback: Boolean(transition.data?.isFallback),
      })),
    }
  }

  const saveScenario = async ({ requirePublishReady = false, successMessage = '场景草稿已保存。' } = {}) => {
    if (!scenario) return false
    const validationErrors = collectValidationErrors(requirePublishReady)
    if (validationErrors.length > 0) {
      setStatus({ type: 'error', message: validationErrors[0] })
      return false
    }
    const payload = buildSavePayload()
    if (!payload) return false

    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || `Save failed: ${response.status}`)
      setScenario(data)
      setStages((data.stages || []).map(toFlowStage))
      setTransitions((data.transitions || []).filter((transition: Detail['transitions'][number]) => transition.toStageId).map(toFlowTransition))
      await loadSummaries()
      if (successMessage) setStatus({ type: 'success', message: successMessage })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '保存场景失败。' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const publishScenario = async (isPublished: boolean) => {
    if (!scenario) return
    const saved = await saveScenario({ requirePublishReady: isPublished, successMessage: '' })
    if (!saved) return
    setBusy(true)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}/publish`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `Publish failed: ${response.status}`)
      setScenario((current) => current ? { ...current, isPublished: payload.isPublished } : current)
      await loadSummaries()
      setStatus({ type: 'success', message: payload.isPublished ? '场景已发布。' : '场景已取消发布。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '更新发布状态失败。' })
    } finally {
      setBusy(false)
    }
  }

  const deleteScenario = async () => {
    if (!scenario || !window.confirm(`Delete dialogue scenario "${scenario.title}"?`)) return
    setBusy(true)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}`), { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || `Delete failed: ${response.status}`)
      setScenario(null)
      setStages([])
      setTransitions([])
      setSelectedStageId(null)
      setStageModalId(null)
      setTransitionModalId(null)
      await loadSummaries()
      setStatus({ type: 'success', message: '场景已删除。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '删除场景失败。' })
    } finally {
      setBusy(false)
    }
  }

  const previewVoice = async (language: 'en' | 'zh') => {
    if (!scenario) return
    setBusy(true)
    try {
      const response = await fetch(withBasePath('/api/dialogue/admin/voice-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          voice: language === 'zh' ? scenario.coachVoice : scenario.roleVoice,
          text: language === 'zh' ? '你好，我会帮你把回答说得更自然。' : 'Hello, let us practice this stage together.',
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `Preview failed: ${response.status}`)
      await new Audio(withBasePath(payload.audioUrl)).play()
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '语音试听失败。' })
    } finally {
      setBusy(false)
    }
  }

  if (authStatus === 'loading' || !session?.user?.id || !isAdmin) {
    return <div className="relative z-50 flex min-h-screen items-center justify-center text-cyan-300">CHECKING ACCESS...</div>
  }

  const validationPreview = scenario ? collectValidationErrors(true).slice(0, 3) : []
  const activeSlots = activeStage ? normalizeSlots(activeStage.data.stage.slotsJson) : []
  const activeOutcomes = activeStage ? normalizeOutcomes(activeStage.data.stage.outcomesJson) : []
  const activeCompletion = activeStage ? parseJson<JsonObject>(activeStage.data.stage.completionJson, {}) : {}
  const activeAssessment = activeStage ? parseJson<JsonObject>(activeStage.data.stage.assessmentJson, {}) : {}
  const activeHints = activeStage ? parseJson<JsonObject>(activeStage.data.stage.hintsJson, {}) : {}
  const activeTransitionCondition = activeTransition ? conditionObject(activeTransition) : {}

  return (
    <div className="dialogue-editor min-h-screen px-4 py-8 text-cyan-50 md:px-6">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-lg border border-cyan-500/28 bg-black/55 p-4 shadow-[0_0_28px_rgba(34,211,238,0.08)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/65">SCENARIO BUILDER V2</div>
            <h1 className="mt-2 text-2xl font-semibold">自适应阶段场景编辑器</h1>
            <p className="mt-1 text-sm text-cyan-100/58">Stage 代表一个可多轮推进的任务阶段，Transition 代表完成后的命名结果分支。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push('/dialogue')} className={buttonClass}>BACK</button>
            <button type="button" onClick={() => void createScenario()} disabled={busy} className={`${buttonClass} bg-cyan-400/[0.12]`}>
              <Plus className="h-3.5 w-3.5" />
              NEW SCENE
            </button>
          </div>
        </header>

        {status ? (
          <div className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${status.type === 'error' ? 'border-red-500/35 bg-red-500/[0.08] text-red-100' : 'border-cyan-400/35 bg-cyan-400/[0.08] text-cyan-100'}`}>
            {status.type === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{status.message}</span>
          </div>
        ) : null}

        <div className="grid min-h-[76vh] gap-4 xl:grid-cols-[270px_1fr_330px]">
          <aside className="overflow-hidden rounded-lg border border-cyan-500/22 bg-black/45">
            <div className="flex items-center justify-between border-b border-cyan-500/18 px-4 py-3">
              <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/70">SCENES</div>
              <button type="button" onClick={() => void createScenario()} disabled={busy} className="rounded border border-cyan-500/24 p-1.5 text-cyan-200 hover:border-cyan-300/60 disabled:opacity-40" aria-label="Create scenario">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
              {summaries.map((item) => (
                <button key={item.id} type="button" onClick={() => void loadScenario(item.id)} className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${scenario?.id === item.id ? 'border-cyan-300/55 bg-cyan-400/[0.12]' : 'border-cyan-500/18 bg-black/24 hover:border-cyan-300/42'}`}>
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-cyan-200/58"><span>{item.nodesCount} STAGES</span><span>{item.isPublished ? 'LIVE' : 'DRAFT'}</span></div>
                </button>
              ))}
              {summaries.length === 0 ? <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/60">还没有场景，先创建一个。</div> : null}
            </div>
          </aside>

          <main className="relative overflow-hidden rounded-lg border border-cyan-500/22 bg-black/34 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            {scenario ? (
              <>
                <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={addStage} className={`${buttonClass} bg-black/70 backdrop-blur`}><Plus className="h-3.5 w-3.5" />添加阶段</button>
                  {selectedStage ? <button type="button" onClick={() => setStageModalId(selectedStage.id)} className={`${buttonClass} bg-black/70 backdrop-blur`}>编辑：{selectedStage.data.stage.title}</button> : null}
                </div>
                <ReactFlow
                  nodes={stages}
                  edges={transitions}
                  onNodesChange={onStagesChange}
                  onEdgesChange={onTransitionsChange}
                  onConnect={onConnect}
                  onNodeClick={(_, stage) => {
                    setSelectedStageId(stage.id)
                    setStageModalId(stage.id)
                    setShowStageJson(false)
                  }}
                  onEdgeClick={(event, transition) => {
                    event.stopPropagation()
                    setTransitionModalId(transition.id)
                    setShowTransitionJson(false)
                  }}
                  onPaneClick={() => setSelectedStageId(null)}
                  fitView
                >
                  <MiniMap pannable zoomable />
                  <Background />
                  <Controls />
                </ReactFlow>
              </>
            ) : (
              <div className="flex h-full min-h-[560px] items-center justify-center px-6 text-center text-cyan-100/58">
                <div>
                  <GitBranch className="mx-auto mb-4 h-9 w-9 text-cyan-300/58" />
                  <div className="text-lg font-semibold text-cyan-50">选择或创建一个场景</div>
                  <p className="mt-2 max-w-md text-sm leading-6">在画布中创建 Stage，用 Transition 连接命名结果分支。</p>
                </div>
              </div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/22 bg-black/45 p-4">
            {scenario ? (
              <div className="space-y-5">
                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/68">SCENE SETTINGS</h2><span className="rounded border border-cyan-500/20 px-2 py-1 text-[10px]">{scenario.isPublished ? 'LIVE' : 'DRAFT'}</span></div>
                  <input value={scenario.title} onChange={(event) => updateScenario('title', event.target.value)} className={fieldClass} placeholder="场景标题，例如：午餐决策" />
                  <textarea value={scenario.description} onChange={(event) => updateScenario('description', event.target.value)} rows={3} className={fieldClass} placeholder="这个场景训练什么口语能力？" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={scenario.difficulty} onChange={(event) => updateScenario('difficulty', event.target.value)} className={fieldClass} placeholder="beginner" />
                    <input value={scenario.tags.join(', ')} onChange={(event) => updateScenario('tags', event.target.value.split(/[,，]/).map((entry) => entry.trim()).filter(Boolean))} className={fieldClass} placeholder="daily, food" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={scenario.userRole} onChange={(event) => updateScenario('userRole', event.target.value)} className={fieldClass} placeholder="Learner" />
                    <input value={scenario.aiRole} onChange={(event) => updateScenario('aiRole', event.target.value)} className={fieldClass} placeholder="Coach" />
                  </div>
                  <input value={scenario.coverUrl || ''} onChange={(event) => updateScenario('coverUrl', event.target.value)} className={fieldClass} placeholder="封面 URL，可选" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={scenario.roleVoice} onChange={(event) => updateScenario('roleVoice', event.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                    <select value={scenario.coachVoice} onChange={(event) => updateScenario('coachVoice', event.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void previewVoice('en')} className={`${buttonClass} flex-1`}><Volume2 className="h-3.5 w-3.5" />ROLE</button>
                    <button type="button" disabled={busy} onClick={() => void previewVoice('zh')} className={`${buttonClass} flex-1`}><Volume2 className="h-3.5 w-3.5" />COACH</button>
                  </div>
                </section>
                <section className="space-y-3 border-t border-cyan-500/18 pt-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-50"><HelpCircle className="h-4 w-4 text-cyan-300/70" />V2 设计方式</div>
                  <div className="space-y-2 text-xs leading-5 text-cyan-100/62">
                    <p>Stage 是一个阶段目标，可在内部多轮追问。</p>
                    <p>Slot 是这个阶段需要收集的信息。</p>
                    <p>Outcome 是阶段完成后的命名结果，例如 dine_in。</p>
                  </div>
                  {validationPreview.length ? <div className="rounded-md border border-yellow-400/28 bg-yellow-400/[0.08] p-3 text-xs leading-5 text-yellow-100">{validationPreview[0]}</div> : <div className="rounded-md border border-emerald-400/24 bg-emerald-400/[0.08] p-3 text-xs text-emerald-100">当前场景满足发布前置条件。</div>}
                </section>
                <section className="space-y-2 border-t border-cyan-500/18 pt-5">
                  <button type="button" onClick={() => void saveScenario()} disabled={busy} className={`${buttonClass} w-full bg-cyan-400/[0.12]`}><Save className="h-3.5 w-3.5" />{busy ? 'WORKING...' : 'SAVE DRAFT'}</button>
                  <button type="button" onClick={() => void publishScenario(!scenario.isPublished)} disabled={busy} className={`${buttonClass} w-full bg-emerald-400/[0.1]`}><CheckCircle2 className="h-3.5 w-3.5" />{scenario.isPublished ? 'UNPUBLISH' : 'PUBLISH'}</button>
                  <button type="button" onClick={() => void deleteScenario()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200 disabled:opacity-40"><Trash2 className="h-4 w-4" />DELETE SCENE</button>
                </section>
              </div>
            ) : <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/58">选择或创建场景后，可在这里编辑场景级信息。</div>}
          </aside>
        </div>
      </div>

      {activeStage ? (
        <ModalShell eyebrow="STAGE RULES" title={`设置阶段：${activeStage.data.stage.title || activeStage.id}`} onClose={() => setStageModalId(null)}>
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <section className={panelClass}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50"><Settings2 className="h-4 w-4 text-cyan-300/70" />阶段基础规则</div>
                <div className="grid gap-3">
                  <input value={activeStage.data.stage.title} onChange={(event) => updateStageById(activeStage.id, 'title', event.target.value)} className={fieldClass} placeholder="阶段名称，例如：确定午餐方案" />
                  <textarea value={activeStage.data.stage.openingLineEn} onChange={(event) => updateStageById(activeStage.id, 'openingLineEn', event.target.value)} rows={3} className={fieldClass} placeholder="AI 在阶段开始时说什么？" />
                  <textarea value={activeStage.data.stage.openingLineZh || ''} onChange={(event) => updateStageById(activeStage.id, 'openingLineZh', event.target.value)} rows={2} className={fieldClass} placeholder="中文辅助说明，可选" />
                  <textarea value={activeStage.data.stage.objective} onChange={(event) => updateStageById(activeStage.id, 'objective', event.target.value)} rows={3} className={fieldClass} placeholder="这个阶段要帮助用户完成什么目标？" />
                </div>
              </section>

              <section className={panelClass}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-cyan-50">信息槽 Slots</div>
                    <p className="mt-1 text-xs text-cyan-100/58">required slot 满足后，AI 才会考虑完成阶段。</p>
                  </div>
                  <button type="button" className={buttonClass} onClick={() => updateStageJson(activeStage.id, 'slotsJson', [...activeSlots, { key: '', label: '', required: true, description: '' }])}><Plus className="h-3.5 w-3.5" />ADD</button>
                </div>
                <div className="space-y-3">
                  {(activeSlots.length ? activeSlots : [{ key: '', label: '', required: true, description: '' }]).map((slot, index) => (
                    <div key={`slot_${index}`} className="rounded-md border border-cyan-500/14 bg-black/24 p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input value={slot.key} onChange={(event) => {
                          const next = [...(activeSlots.length ? activeSlots : [slot])]
                          next[index] = { ...slot, key: event.target.value }
                          updateStageJson(activeStage.id, 'slotsJson', next)
                        }} className={compactFieldClass} placeholder="key: meal_mode" />
                        <input value={slot.label} onChange={(event) => {
                          const next = [...(activeSlots.length ? activeSlots : [slot])]
                          next[index] = { ...slot, label: event.target.value }
                          updateStageJson(activeStage.id, 'slotsJson', next)
                        }} className={compactFieldClass} placeholder="名称：用餐方式" />
                        <label className="flex items-center gap-2 text-xs text-cyan-100/72"><input type="checkbox" checked={slot.required} onChange={(event) => {
                          const next = [...(activeSlots.length ? activeSlots : [slot])]
                          next[index] = { ...slot, required: event.target.checked }
                          updateStageJson(activeStage.id, 'slotsJson', next)
                        }} /> required</label>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input value={slot.description} onChange={(event) => {
                          const next = [...(activeSlots.length ? activeSlots : [slot])]
                          next[index] = { ...slot, description: event.target.value }
                          updateStageJson(activeStage.id, 'slotsJson', next)
                        }} className={compactFieldClass} placeholder="描述这个槽位要收集什么信息" />
                        <button type="button" className="rounded-md border border-red-400/28 px-3 py-2 text-xs text-red-200" onClick={() => updateStageJson(activeStage.id, 'slotsJson', activeSlots.filter((_, entryIndex) => entryIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={panelClass}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-cyan-50">阶段结果 Outcomes</div>
                    <p className="mt-1 text-xs text-cyan-100/58">阶段完成后，AI 会输出一个 outcomeKey 来选择分支。</p>
                  </div>
                  <button type="button" className={buttonClass} onClick={() => updateStageJson(activeStage.id, 'outcomesJson', [...activeOutcomes, { key: '', label: '', description: '' }])}><Plus className="h-3.5 w-3.5" />ADD</button>
                </div>
                <div className="space-y-3">
                  {(activeOutcomes.length ? activeOutcomes : [{ key: '', label: '', description: '' }]).map((outcome, index) => (
                    <div key={`outcome_${index}`} className="grid gap-2 rounded-md border border-cyan-500/14 bg-black/24 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <input value={outcome.key} onChange={(event) => {
                        const next = [...(activeOutcomes.length ? activeOutcomes : [outcome])]
                        next[index] = { ...outcome, key: event.target.value }
                        updateStageJson(activeStage.id, 'outcomesJson', next)
                      }} className={compactFieldClass} placeholder="dine_in" />
                      <input value={outcome.label} onChange={(event) => {
                        const next = [...(activeOutcomes.length ? activeOutcomes : [outcome])]
                        next[index] = { ...outcome, label: event.target.value }
                        updateStageJson(activeStage.id, 'outcomesJson', next)
                      }} className={compactFieldClass} placeholder="去餐厅" />
                      <input value={outcome.description} onChange={(event) => {
                        const next = [...(activeOutcomes.length ? activeOutcomes : [outcome])]
                        next[index] = { ...outcome, description: event.target.value }
                        updateStageJson(activeStage.id, 'outcomesJson', next)
                      }} className={compactFieldClass} placeholder="用户选择堂食" />
                      <button type="button" className="rounded-md border border-red-400/28 px-3 py-2 text-xs text-red-200" onClick={() => updateStageJson(activeStage.id, 'outcomesJson', activeOutcomes.filter((_, entryIndex) => entryIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </section>

              <LineListEditor label="评分重点" help="阶段完成时才给反馈，AI 会参考这些重点。" values={toStringArray(activeAssessment.scoringFocus)} placeholder="例如：是否自然说明自己的选择" onChange={(values) => updateStageJson(activeStage.id, 'assessmentJson', { ...activeAssessment, scoringFocus: cleanStringArray(values) })} />
              <LineListEditor label="常见错误" help="用于阶段完成反馈和画像沉淀。" values={toStringArray(activeAssessment.commonErrors)} placeholder="例如：只说 cuisine，没有说明堂食还是外卖" onChange={(values) => updateStageJson(activeStage.id, 'assessmentJson', { ...activeAssessment, commonErrors: cleanStringArray(values) })} />
              <LineListEditor label="提示语" help="用户请求 hint 时使用，不推进阶段。" values={toStringArray(activeHints.hints)} placeholder="例如：先确定中餐还是西餐。" onChange={(values) => updateStageJson(activeStage.id, 'hintsJson', { ...activeHints, hints: cleanStringArray(values) })} />

              <section className={panelClass}>
                <label className="block">
                  <span className="mb-1 block text-xs text-cyan-100/58">推荐表达 sampleAnswer</span>
                  <input value={String(activeHints.sampleAnswer || '')} onChange={(event) => updateStageJson(activeStage.id, 'hintsJson', { ...activeHints, sampleAnswer: event.target.value })} className={fieldClass} placeholder="I think I would like to eat out today." />
                </label>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-cyan-100/58">完成规则</span>
                  <textarea value={String(activeCompletion.rule || '')} onChange={(event) => updateStageJson(activeStage.id, 'completionJson', { ...activeCompletion, rule: event.target.value })} rows={2} className={fieldClass} placeholder="Required slots are collected and objective is achieved." />
                </label>
              </section>

              <section className={panelClass}>
                <button type="button" onClick={() => setShowStageJson((value) => !value)} className={buttonClass}><Settings2 className="h-3.5 w-3.5" />{showStageJson ? '隐藏高级 JSON' : '显示高级 JSON'}</button>
                {showStageJson ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {(['slotsJson', 'outcomesJson', 'completionJson', 'assessmentJson', 'hintsJson'] as const).map((key) => (
                      <label key={key}>
                        <span className="mb-1 block text-xs text-cyan-100/58">{key}</span>
                        <textarea value={activeStage.data.stage[key]} onChange={(event) => updateStageById(activeStage.id, key, event.target.value)} rows={8} className={`${fieldClass} font-mono text-xs`} />
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="space-y-3">
              <div className={panelClass}>
                <div className="text-sm font-semibold text-cyan-50">阶段行为</div>
                <label className="mt-3 flex items-center gap-2 text-xs text-cyan-100/72"><input type="checkbox" checked={scenario?.startStageId === activeStage.id} onChange={(event) => event.target.checked && updateScenario('startStageId', activeStage.id)} />设为起始阶段</label>
              </div>
              <div className={panelClass}>
                <div className="text-sm font-semibold text-cyan-50">填写建议</div>
                <div className="mt-2 space-y-2 text-xs leading-5 text-cyan-100/62">
                  <p>Stage 是阶段，不是一句台词。</p>
                  <p>Slot 用来定义这个阶段要收集的信息。</p>
                  <p>Outcome 要和 Transition 的 outcomeKey 对齐。</p>
                </div>
              </div>
              <button type="button" onClick={() => deleteStage(activeStage.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200"><Trash2 className="h-4 w-4" />删除阶段</button>
            </aside>
          </div>
        </ModalShell>
      ) : null}

      {activeTransition ? (
        <ModalShell eyebrow="TRANSITION RULES" title={`设置分支：${transitionLabel(activeTransition)}`} onClose={() => setTransitionModalId(null)}>
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <section className={panelClass}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50"><Link2 className="h-4 w-4 text-cyan-300/70" />分支基础规则</div>
                <div className="grid gap-3">
                  <input value={String(activeTransition.data?.outcomeKey || '')} onChange={(event) => updateTransitionById(activeTransition.id, { outcomeKey: event.target.value })} className={fieldClass} placeholder="outcomeKey: dine_in" />
                  <input value={transitionLabel(activeTransition)} onChange={(event) => updateTransitionById(activeTransition.id, { label: event.target.value })} className={fieldClass} placeholder="分支名称：去餐厅" />
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input type="number" value={transitionPriority(activeTransition.data?.priority)} onChange={(event) => updateTransitionById(activeTransition.id, { priority: transitionPriority(event.target.value) })} className={fieldClass} placeholder="优先级" />
                    <label className="flex items-center gap-2 text-xs text-cyan-100/72"><input checked={Boolean(activeTransition.data?.isFallback)} onChange={(event) => updateTransitionById(activeTransition.id, { isFallback: event.target.checked })} type="checkbox" />fallback</label>
                  </div>
                </div>
              </section>

              <section className={panelClass}>
                <div className="mb-3 text-sm font-semibold text-cyan-50">语义条件</div>
                <input value={String(activeTransitionCondition.intent || '')} onChange={(event) => updateTransitionCondition(activeTransition.id, 'intent', event.target.value)} className={fieldClass} placeholder="例如：用户选择去餐厅堂食" />
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <LineListEditor label="关键词" help="用户可能说出的词。" values={toStringArray(activeTransitionCondition.keywords)} placeholder="restaurant / eat out" onChange={(values) => updateTransitionCondition(activeTransition.id, 'keywords', values)} />
                  <LineListEditor label="示例回答" help="可进入这个分支的自然回答。" values={toStringArray(activeTransitionCondition.examples)} placeholder="I want to eat out." onChange={(values) => updateTransitionCondition(activeTransition.id, 'examples', values)} />
                </div>
              </section>

              <section className={panelClass}>
                <button type="button" onClick={() => setShowTransitionJson((value) => !value)} className={buttonClass}><Settings2 className="h-3.5 w-3.5" />{showTransitionJson ? '隐藏高级 JSON' : '显示高级 JSON'}</button>
                {showTransitionJson ? <textarea value={transitionConditionJson(activeTransition.data?.conditionJson)} onChange={(event) => updateTransitionById(activeTransition.id, { conditionJson: event.target.value })} rows={8} className={`${fieldClass} mt-3 font-mono text-xs`} /> : null}
              </section>
            </div>
            <aside className="space-y-3">
              <div className={panelClass}>
                <div className="text-sm font-semibold text-cyan-50">连接关系</div>
                <div className="mt-3 space-y-2 text-xs leading-5 text-cyan-100/62">
                  <p>From: {stages.find((stage) => stage.id === activeTransition.source)?.data.stage.title || activeTransition.source}</p>
                  <p>To: {stages.find((stage) => stage.id === activeTransition.target)?.data.stage.title || activeTransition.target}</p>
                </div>
              </div>
              <div className={panelClass}>
                <div className="text-sm font-semibold text-cyan-50">填写建议</div>
                <p className="mt-2 text-xs leading-5 text-cyan-100/62">Transition 的 outcomeKey 必须对应来源 Stage 的某个 Outcome key。</p>
              </div>
              <button type="button" onClick={() => deleteTransition(activeTransition.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200"><Trash2 className="h-4 w-4" />删除分支</button>
            </aside>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
