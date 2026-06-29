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
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  Link2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { isAdminRole } from '@/lib/auth-types'
import { withBasePath } from '@/lib/base-path'
import { DIALOGUE_EDGE_RESULTS, DIALOGUE_VOICES, type DialogueEdgeResult } from '@/lib/dialogue'

type Status = { type: 'success' | 'error' | 'info'; message: string }
type Summary = { id: string; title: string; isPublished: boolean; nodesCount: number; updatedAt: string }
type JsonObject = Record<string, unknown>
type DNode = {
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
  startNodeId: string | null
  roleVoice: string
  coachVoice: string
  nodes: DNode[]
  edges: Array<{
    id: string
    fromNodeId: string
    onResult: DialogueEdgeResult
    label: string
    conditionJson: string
    priority: number
    isFallback: boolean
    toNodeId: string | null
  }>
}
type NodeData = Record<string, unknown> & { label: string; dialogue: DNode }
type EdgeData = Record<string, unknown> & {
  onResult: DialogueEdgeResult
  label: string
  conditionJson: string
  priority: number
  isFallback: boolean
}
type FlowNode = Node<NodeData>
type FlowEdge = Edge<EdgeData>

const fieldClass =
  'w-full rounded-md border border-cyan-500/24 bg-black/45 px-3 py-2 text-sm text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60'
const compactFieldClass =
  'w-full rounded-md border border-cyan-500/22 bg-black/45 px-3 py-2 text-xs text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60'
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-md border border-cyan-500/30 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40'
const subtlePanelClass = 'rounded-lg border border-cyan-500/18 bg-black/26 p-3'

function localNodeId() {
  return `dlg_node_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function localEdgeId() {
  return `dlg_edge_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function parseJsonObject(value: string | null | undefined, fallback: JsonObject = {}) {
  if (!value) {
    return fallback
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : fallback
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

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
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

function labelFor(node: DNode) {
  const title = node.title || `Node ${node.order + 1}`
  const goal = node.goal || '还未设置用户目标'
  return `${title}\n${goal}`
}

function toFlowNode(node: DNode): FlowNode {
  return {
    id: node.id,
    position: { x: node.positionX, y: node.positionY },
    data: { label: labelFor(node), dialogue: node },
  }
}

function edgeResult(value: unknown): DialogueEdgeResult {
  return DIALOGUE_EDGE_RESULTS.includes(value as DialogueEdgeResult) ? value as DialogueEdgeResult : 'pass'
}

function toFlowEdge(edge: Detail['edges'][number]): FlowEdge {
  return {
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId || '',
    label: edge.label || edge.onResult,
    animated: edge.onResult === 'pass',
    data: {
      onResult: edge.onResult,
      label: edge.label || edge.onResult,
      conditionJson: edge.conditionJson || '{}',
      priority: edge.priority || 0,
      isFallback: Boolean(edge.isFallback),
    },
  }
}

function emptyNode(order: number): DNode {
  return {
    id: localNodeId(),
    order,
    title: `节点 ${order + 1}`,
    roleLineEn: 'Hello. What would you like to do?',
    roleLineZh: '你好，你想做什么？',
    goal: '用户需要自然说明自己的需求。',
    rubricJson: prettyJson({
      requiredMeaning: ['说明自己的需求'],
      commonErrors: ['回答太短，没有说明目的'],
      scoringFocus: ['是否完成交际目的', '表达是否自然礼貌'],
    }),
    hintJson: prettyJson({
      hints: ['先说你想做什么，再补充必要信息。'],
    }),
    sampleAnswer: 'I would like to ask about your service.',
    retryLimit: 2,
    allowDynamicFollowup: false,
    positionX: 140 + order * 220,
    positionY: 140,
  }
}

function edgeLabel(edge: FlowEdge) {
  return typeof edge.label === 'string' && edge.label.trim()
    ? edge.label.trim()
    : edgeResult(edge.data?.onResult)
}

function edgePriority(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0
}

function edgeConditionJson(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : '{}'
}

function normalizeEdgeData(edge: FlowEdge): EdgeData {
  return {
    onResult: edgeResult(edge.data?.onResult),
    label: typeof edge.data?.label === 'string' && edge.data.label.trim()
      ? edge.data.label
      : edgeLabel(edge),
    conditionJson: edgeConditionJson(edge.data?.conditionJson),
    priority: edgePriority(edge.data?.priority),
    isFallback: Boolean(edge.data?.isFallback),
  }
}

function updateFlowEdgeData(edge: FlowEdge, patch: Partial<EdgeData>): FlowEdge {
  const data = {
    ...normalizeEdgeData(edge),
    ...patch,
  }

  return {
    ...edge,
    label: data.label || data.onResult,
    animated: data.onResult === 'pass',
    data,
  }
}

function nodeRubric(node: DNode) {
  return parseJsonObject(node.rubricJson, {})
}

function nodeHints(node: DNode) {
  const parsed = parseJsonObject(node.hintJson, {})
  const hints = toStringArray(parsed.hints)

  if (hints.length) {
    return hints
  }

  return [parsed.first, parsed.second, parsed.example]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
}

function edgeCondition(edge: FlowEdge) {
  return parseJsonObject(edgeConditionJson(edge.data?.conditionJson), {})
}

function hasMeaningfulCondition(edge: FlowEdge) {
  const condition = edgeCondition(edge)
  const intent = String(condition.intent || '').trim()
  const keywords = toStringArray(condition.keywords)
  const examples = toStringArray(condition.examples)
  return Boolean(intent || keywords.length || examples.length)
}

function friendlyError(message: string) {
  if (message.includes('Title is required')) {
    return '请先填写场景标题。'
  }
  if (message.includes('At least one valid dialogue node')) {
    return '至少需要保留一个有效节点。'
  }
  if (message.includes('Start node')) {
    return '请选择一个起始节点。'
  }
  if (message.includes('fallback')) {
    return '同一个节点、同一种触发结果只能设置一条兜底分支。'
  }
  if (message.includes('conditionJson')) {
    return '多条 pass 分支时，非兜底分支必须填写语义条件。'
  }
  if (message.includes('role line')) {
    return '每个节点发布前都需要填写角色英文台词。'
  }
  if (message.includes('learner goal')) {
    return '每个节点发布前都需要填写用户交际目标。'
  }
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
    <div className={subtlePanelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-cyan-50">{label}</div>
          <p className="mt-1 text-xs leading-5 text-cyan-100/58">{help}</p>
        </div>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange([...values, ''])}
        >
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

interface ModalShellProps {
  title: string
  eyebrow: string
  children: React.ReactNode
  onClose: () => void
}

function ModalShell({ title, eyebrow, children, onClose }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-cyan-300/28 bg-slate-950 p-5 shadow-[0_0_36px_rgba(34,211,238,0.16)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-cyan-500/18 pb-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em] text-cyan-300/65">{eyebrow}</div>
            <h2 className="mt-2 text-xl font-semibold text-cyan-50">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-cyan-500/24 p-2 text-cyan-200 transition-colors hover:border-cyan-300/60"
            aria-label="Close modal"
          >
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
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeModalId, setNodeModalId] = useState<string | null>(null)
  const [edgeModalId, setEdgeModalId] = useState<string | null>(null)
  const [showNodeJson, setShowNodeJson] = useState(false)
  const [showEdgeJson, setShowEdgeJson] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId])
  const activeNode = useMemo(() => nodes.find((node) => node.id === nodeModalId) || null, [nodeModalId, nodes])
  const activeEdge = useMemo(() => edges.find((edge) => edge.id === edgeModalId) || null, [edgeModalId, edges])
  const activeEdgeSource = useMemo(
    () => activeEdge ? nodes.find((node) => node.id === activeEdge.source) || null : null,
    [activeEdge, nodes]
  )
  const activeEdgeTarget = useMemo(
    () => activeEdge ? nodes.find((node) => node.id === activeEdge.target) || null : null,
    [activeEdge, nodes]
  )

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }
    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/dialogue/builder')}`)
      return
    }
    if (!isAdmin) {
      router.replace('/403')
    }
  }, [authStatus, isAdmin, router, session?.user?.id])

  const loadSummaries = useCallback(async () => {
    const response = await fetch(withBasePath('/api/dialogue/admin/scenarios'), { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error || `Load failed: ${response.status}`)
    }
    setSummaries(payload)
  }, [])

  const loadScenario = useCallback(async (id: string) => {
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${id}`), { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || `Load failed: ${response.status}`)
      }
      const detail = payload as Detail
      setScenario(detail)
      setNodes(detail.nodes.map(toFlowNode))
      setEdges(detail.edges.filter((edge) => edge.toNodeId).map(toFlowEdge))
      setSelectedNodeId(detail.startNodeId || detail.nodes[0]?.id || null)
      setNodeModalId(null)
      setEdgeModalId(null)
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '加载场景失败。' })
    } finally {
      setBusy(false)
    }
  }, [setEdges, setNodes])

  useEffect(() => {
    if (authStatus !== 'authenticated' || !isAdmin) {
      return
    }
    void loadSummaries().catch((error) => setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '加载场景列表失败。' }))
  }, [authStatus, isAdmin, loadSummaries])

  const updateScenario = <K extends keyof Detail>(key: K, value: Detail[K]) => {
    setScenario((current) => current ? { ...current, [key]: value } : current)
  }

  const updateNodeById = useCallback(<K extends keyof DNode>(nodeId: string, key: K, value: DNode[K]) => {
    setNodes((items) => items.map((node) => {
      if (node.id !== nodeId) {
        return node
      }
      const dialogue = { ...node.data.dialogue, [key]: value }
      return { ...node, data: { ...node.data, dialogue, label: labelFor(dialogue) } }
    }))
  }, [setNodes])

  const updateNodeRubricList = useCallback((nodeId: string, key: 'requiredMeaning' | 'commonErrors' | 'scoringFocus', values: string[]) => {
    setNodes((items) => items.map((node) => {
      if (node.id !== nodeId) {
        return node
      }
      const current = nodeRubric(node.data.dialogue)
      const dialogue = {
        ...node.data.dialogue,
        rubricJson: prettyJson({
          ...current,
          [key]: cleanStringArray(values),
        }),
      }
      return { ...node, data: { ...node.data, dialogue, label: labelFor(dialogue) } }
    }))
  }, [setNodes])

  const updateNodeHints = useCallback((nodeId: string, values: string[]) => {
    setNodes((items) => items.map((node) => {
      if (node.id !== nodeId) {
        return node
      }
      const current = parseJsonObject(node.data.dialogue.hintJson, {})
      const hints = cleanStringArray(values)
      const dialogue = {
        ...node.data.dialogue,
        hintJson: prettyJson({
          ...current,
          hints,
        }),
      }
      return { ...node, data: { ...node.data, dialogue, label: labelFor(dialogue) } }
    }))
  }, [setNodes])

  const updateEdgeById = useCallback((edgeId: string, patch: Partial<EdgeData>) => {
    setEdges((items) => items.map((edge) => edge.id === edgeId ? updateFlowEdgeData(edge, patch) : edge))
  }, [setEdges])

  const updateEdgeCondition = useCallback((edgeId: string, key: 'intent' | 'keywords' | 'examples', value: string | string[]) => {
    setEdges((items) => items.map((edge) => {
      if (edge.id !== edgeId) {
        return edge
      }
      const condition = edgeCondition(edge)
      return updateFlowEdgeData(edge, {
        conditionJson: prettyJson({
          ...condition,
          [key]: Array.isArray(value) ? cleanStringArray(value) : value,
        }),
      })
    }))
  }, [setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return
    }
    const sourceEdgeCount = edges.filter((edge) => edge.source === connection.source).length
    const edgeId = localEdgeId()
    setEdges((items) => addEdge({
      id: edgeId,
      source: connection.source || '',
      target: connection.target || '',
      label: '新分支',
      animated: true,
      data: {
        onResult: 'pass',
        label: '新分支',
        conditionJson: prettyJson({
          intent: '',
          examples: [],
          keywords: [],
        }),
        priority: sourceEdgeCount,
        isFallback: false,
      },
    }, items))
    setEdgeModalId(edgeId)
    setShowEdgeJson(false)
  }, [edges, setEdges])

  const addNode = () => {
    if (!scenario) {
      return
    }
    const node = emptyNode(nodes.length)
    const parentNode = selectedNodeId ? nodes.find((item) => item.id === selectedNodeId) : null
    if (parentNode) {
      const siblingCount = edges.filter((edge) => edge.source === parentNode.id).length
      node.positionX = parentNode.position.x + siblingCount * 260
      node.positionY = parentNode.position.y + 220
    }
    setNodes((items) => [...items, toFlowNode(node)])
    setSelectedNodeId(node.id)
    setNodeModalId(node.id)
    setShowNodeJson(false)
    if (!scenario.startNodeId) {
      updateScenario('startNodeId', node.id)
    }
  }

  const deleteNode = (nodeId: string) => {
    setNodes((items) => items.filter((node) => node.id !== nodeId))
    setEdges((items) => items.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setScenario((current) => current?.startNodeId === nodeId ? { ...current, startNodeId: null } : current)
    setSelectedNodeId((current) => current === nodeId ? null : current)
    setNodeModalId(null)
  }

  const deleteEdge = (edgeId: string) => {
    setEdges((items) => items.filter((edge) => edge.id !== edgeId))
    setEdgeModalId(null)
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
      if (!response.ok) {
        throw new Error(payload?.error || `Create failed: ${response.status}`)
      }
      await loadSummaries()
      await loadScenario(payload.id)
      setStatus({ type: 'success', message: '场景已创建。点击节点即可设置对话规则。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '创建场景失败。' })
    } finally {
      setBusy(false)
    }
  }

  const collectValidationErrors = (requirePublishReady: boolean) => {
    const errors: string[] = []
    const nodeIds = new Set(nodes.map((node) => node.id))

    if (!scenario) {
      return ['请选择或创建一个场景。']
    }
    if (!scenario.title.trim()) {
      errors.push('请先填写场景标题。')
    }
    if (nodes.length === 0) {
      errors.push('至少需要一个节点。')
    }
    if (scenario.startNodeId && !nodeIds.has(scenario.startNodeId)) {
      errors.push('起始节点不存在，请重新选择。')
    }
    if (requirePublishReady && !scenario.startNodeId) {
      errors.push('发布前必须选择起始节点。')
    }

    for (const node of nodes) {
      if (!isJsonObjectString(node.data.dialogue.rubricJson)) {
        errors.push(`${node.data.dialogue.title || node.id} 的评分规则 JSON 格式不正确。`)
      }
      if (!isJsonObjectString(node.data.dialogue.hintJson)) {
        errors.push(`${node.data.dialogue.title || node.id} 的提示 JSON 格式不正确。`)
      }
      if (requirePublishReady && !node.data.dialogue.roleLineEn.trim()) {
        errors.push(`${node.data.dialogue.title || node.id} 缺少角色英文台词。`)
      }
      if (requirePublishReady && !node.data.dialogue.goal.trim()) {
        errors.push(`${node.data.dialogue.title || node.id} 缺少用户交际目标。`)
      }
    }

    const fallbackKeys = new Set<string>()
    const passEdgesBySource = new Map<string, FlowEdge[]>()
    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push(`分支 ${edgeLabel(edge)} 引用了不存在的节点。`)
      }
      if (!isJsonObjectString(edgeConditionJson(edge.data?.conditionJson))) {
        errors.push(`分支 ${edgeLabel(edge)} 的语义条件 JSON 格式不正确。`)
      }
      const result = edgeResult(edge.data?.onResult)
      const key = `${edge.source}:${result}`
      if (edge.data?.isFallback && fallbackKeys.has(key)) {
        errors.push(`节点 ${edge.source} 的 ${result} 结果只能有一条 fallback 分支。`)
      }
      if (edge.data?.isFallback) {
        fallbackKeys.add(key)
      }
      if (result === 'pass') {
        passEdgesBySource.set(edge.source, [...(passEdgesBySource.get(edge.source) || []), edge])
      }
    }

    for (const [sourceId, sourceEdges] of passEdgesBySource) {
      if (sourceEdges.length <= 1) {
        continue
      }
      for (const edge of sourceEdges) {
        if (!edge.data?.isFallback && !hasMeaningfulCondition(edge)) {
          const sourceNode = nodes.find((node) => node.id === sourceId)
          errors.push(`${sourceNode?.data.dialogue.title || sourceId} 有多条 pass 分支，非 fallback 分支必须填写意图、关键词或示例回答。`)
        }
      }
    }

    return [...new Set(errors)]
  }

  const buildSavePayload = () => {
    if (!scenario) {
      return null
    }

    return {
      ...scenario,
      nodes: nodes.map((node, index) => ({
        ...node.data.dialogue,
        order: index,
        positionX: node.position.x,
        positionY: node.position.y,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        fromNodeId: edge.source,
        toNodeId: edge.target,
        onResult: edgeResult(edge.data?.onResult),
        label: edgeLabel(edge),
        conditionJson: edgeConditionJson(edge.data?.conditionJson),
        priority: edgePriority(edge.data?.priority),
        isFallback: Boolean(edge.data?.isFallback),
      })),
    }
  }

  const saveScenario = async ({ requirePublishReady = false, successMessage = '场景草稿已保存。' } = {}) => {
    if (!scenario) {
      return false
    }
    const validationErrors = collectValidationErrors(requirePublishReady)
    if (validationErrors.length > 0) {
      setStatus({ type: 'error', message: validationErrors[0] })
      return false
    }

    const payload = buildSavePayload()
    if (!payload) {
      return false
    }

    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || `Save failed: ${response.status}`)
      }
      setScenario(data)
      setNodes((data.nodes || []).map(toFlowNode))
      setEdges((data.edges || []).filter((edge: Detail['edges'][number]) => edge.toNodeId).map(toFlowEdge))
      await loadSummaries()
      if (successMessage) {
        setStatus({ type: 'success', message: successMessage })
      }
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '保存场景失败。' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const publishScenario = async (isPublished: boolean) => {
    if (!scenario) {
      return
    }

    const saved = await saveScenario({
      requirePublishReady: isPublished,
      successMessage: '',
    })
    if (!saved) {
      return
    }

    setBusy(true)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}/publish`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || `Publish failed: ${response.status}`)
      }
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
    if (!scenario || !window.confirm(`Delete dialogue scenario "${scenario.title}"?`)) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}`), { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || `Delete failed: ${response.status}`)
      }
      setScenario(null)
      setNodes([])
      setEdges([])
      setSelectedNodeId(null)
      setNodeModalId(null)
      setEdgeModalId(null)
      await loadSummaries()
      setStatus({ type: 'success', message: '场景已删除。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? friendlyError(error.message) : '删除场景失败。' })
    } finally {
      setBusy(false)
    }
  }

  const previewVoice = async (language: 'en' | 'zh') => {
    if (!scenario) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(withBasePath('/api/dialogue/admin/voice-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          voice: language === 'zh' ? scenario.coachVoice : scenario.roleVoice,
          text: language === 'zh' ? '你好，我会帮你把回答说得更自然。' : 'Hello, let us practice this scene together.',
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || `Preview failed: ${response.status}`)
      }
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

  const selectedNodeTitle = selectedNode?.data.dialogue.title || '未选择节点'
  const validationPreview = scenario ? collectValidationErrors(true).slice(0, 3) : []
  const activeNodeRubric = activeNode ? nodeRubric(activeNode.data.dialogue) : {}
  const activeNodeHints = activeNode ? nodeHints(activeNode.data.dialogue) : []
  const activeEdgeCondition = activeEdge ? edgeCondition(activeEdge) : {}

  return (
    <div className="dialogue-editor min-h-screen px-4 py-8 text-cyan-50 md:px-6">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-lg border border-cyan-500/28 bg-black/55 p-4 shadow-[0_0_28px_rgba(34,211,238,0.08)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/65">SCENARIO BUILDER</div>
            <h1 className="mt-2 text-2xl font-semibold">场景树画布编辑器</h1>
            <p className="mt-1 text-sm text-cyan-100/58">在画布中设计节点和分支，点击节点或连线设置对话规则。</p>
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void loadScenario(item.id)}
                  className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${scenario?.id === item.id ? 'border-cyan-300/55 bg-cyan-400/[0.12]' : 'border-cyan-500/18 bg-black/24 hover:border-cyan-300/42'}`}
                >
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-cyan-200/58">
                    <span>{item.nodesCount} NODES</span>
                    <span>{item.isPublished ? 'LIVE' : 'DRAFT'}</span>
                  </div>
                </button>
              ))}
              {summaries.length === 0 ? (
                <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/60">还没有场景，先创建一个新场景。</div>
              ) : null}
            </div>
          </aside>

          <main className="relative overflow-hidden rounded-lg border border-cyan-500/22 bg-black/34 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            {scenario ? (
              <>
                <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={addNode} className={`${buttonClass} bg-black/70 backdrop-blur`}>
                    <Plus className="h-3.5 w-3.5" />
                    添加节点
                  </button>
                  {selectedNode ? (
                    <button type="button" onClick={() => setNodeModalId(selectedNode.id)} className={`${buttonClass} bg-black/70 backdrop-blur`}>
                      <Pencil className="h-3.5 w-3.5" />
                      编辑：{selectedNodeTitle}
                    </button>
                  ) : null}
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => {
                    setSelectedNodeId(node.id)
                    setNodeModalId(node.id)
                    setShowNodeJson(false)
                  }}
                  onEdgeClick={(event, edge) => {
                    event.stopPropagation()
                    setEdgeModalId(edge.id)
                    setShowEdgeJson(false)
                  }}
                  onPaneClick={() => setSelectedNodeId(null)}
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
                  <p className="mt-2 max-w-md text-sm leading-6">场景树会显示在这里。管理员可以在画布中拖拽节点、连接分支，并通过弹窗配置每个节点的规则。</p>
                </div>
              </div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/22 bg-black/45 p-4">
            {scenario ? (
              <div className="space-y-5">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/68">SCENE SETTINGS</h2>
                    <span className="rounded border border-cyan-500/20 px-2 py-1 text-[10px]">{scenario.isPublished ? 'LIVE' : 'DRAFT'}</span>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">场景标题</span>
                    <input value={scenario.title} onChange={(event) => updateScenario('title', event.target.value)} className={fieldClass} placeholder="例如：吃饭选择" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">场景说明</span>
                    <textarea value={scenario.description} onChange={(event) => updateScenario('description', event.target.value)} rows={3} className={fieldClass} placeholder="说明这个场景训练什么口语能力。" />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">难度</span>
                      <input value={scenario.difficulty} onChange={(event) => updateScenario('difficulty', event.target.value)} className={fieldClass} placeholder="beginner" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">标签</span>
                      <input value={scenario.tags.join(', ')} onChange={(event) => updateScenario('tags', event.target.value.split(/[,，]/).map((entry) => entry.trim()).filter(Boolean))} className={fieldClass} placeholder="restaurant, daily" />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">用户角色</span>
                      <input value={scenario.userRole} onChange={(event) => updateScenario('userRole', event.target.value)} className={fieldClass} placeholder="Learner" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">AI 角色</span>
                      <input value={scenario.aiRole} onChange={(event) => updateScenario('aiRole', event.target.value)} className={fieldClass} placeholder="Coach" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">封面 URL</span>
                    <input value={scenario.coverUrl || ''} onChange={(event) => updateScenario('coverUrl', event.target.value)} className={fieldClass} placeholder="可选" />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={scenario.roleVoice} onChange={(event) => updateScenario('roleVoice', event.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                    <select value={scenario.coachVoice} onChange={(event) => updateScenario('coachVoice', event.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void previewVoice('en')} className={`${buttonClass} flex-1`}>
                      <Volume2 className="h-3.5 w-3.5" />
                      ROLE
                    </button>
                    <button type="button" disabled={busy} onClick={() => void previewVoice('zh')} className={`${buttonClass} flex-1`}>
                      <Volume2 className="h-3.5 w-3.5" />
                      COACH
                    </button>
                  </div>
                </section>

                <section className="space-y-3 border-t border-cyan-500/18 pt-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
                    <HelpCircle className="h-4 w-4 text-cyan-300/70" />
                    如何设计节点
                  </div>
                  <div className="space-y-2 text-xs leading-5 text-cyan-100/62">
                    <p>1. 节点代表一次角色发问和用户要完成的交际目标。</p>
                    <p>2. 点击节点填写台词、目标、评分要点和提示。</p>
                    <p>3. 从节点拖线到下一个节点，再点击连线设置分支条件。</p>
                  </div>
                  {validationPreview.length ? (
                    <div className="rounded-md border border-yellow-400/28 bg-yellow-400/[0.08] p-3 text-xs leading-5 text-yellow-100">
                      {validationPreview[0]}
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-400/24 bg-emerald-400/[0.08] p-3 text-xs text-emerald-100">当前场景满足发布前置条件。</div>
                  )}
                </section>

                <section className="space-y-2 border-t border-cyan-500/18 pt-5">
                  <button type="button" onClick={() => void saveScenario()} disabled={busy} className={`${buttonClass} w-full bg-cyan-400/[0.12]`}>
                    <Save className="h-3.5 w-3.5" />
                    {busy ? 'WORKING...' : 'SAVE DRAFT'}
                  </button>
                  <button type="button" onClick={() => void publishScenario(!scenario.isPublished)} disabled={busy} className={`${buttonClass} w-full bg-emerald-400/[0.1]`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {scenario.isPublished ? 'UNPUBLISH' : 'PUBLISH'}
                  </button>
                  <button type="button" onClick={() => void deleteScenario()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                    DELETE SCENE
                  </button>
                </section>
              </div>
            ) : (
              <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/58">选择或创建场景后，可在这里编辑场景级信息。</div>
            )}
          </aside>
        </div>
      </div>

      {activeNode ? (
        <ModalShell
          eyebrow="NODE RULES"
          title={`设置节点：${activeNode.data.dialogue.title || activeNode.id}`}
          onClose={() => setNodeModalId(null)}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <section className={subtlePanelClass}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <Settings2 className="h-4 w-4 text-cyan-300/70" />
                  基础对话规则
                </div>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">节点名称，方便你在画布里识别</span>
                    <input value={activeNode.data.dialogue.title} onChange={(event) => updateNodeById(activeNode.id, 'title', event.target.value)} className={fieldClass} placeholder="例如：询问吃饭方式" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">角色英文台词，用户会听到/看到这句话</span>
                    <textarea value={activeNode.data.dialogue.roleLineEn} onChange={(event) => updateNodeById(activeNode.id, 'roleLineEn', event.target.value)} rows={3} className={fieldClass} placeholder="What would you like for dinner?" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">中文辅助说明，可帮助作者检查语义</span>
                    <textarea value={activeNode.data.dialogue.roleLineZh || ''} onChange={(event) => updateNodeById(activeNode.id, 'roleLineZh', event.target.value)} rows={2} className={fieldClass} placeholder="你晚饭想吃什么？" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">用户交际目标，AI 会按这个目标判断是否通过</span>
                    <textarea value={activeNode.data.dialogue.goal} onChange={(event) => updateNodeById(activeNode.id, 'goal', event.target.value)} rows={3} className={fieldClass} placeholder="用户需要说明自己想在家做饭、点外卖或去餐厅。" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">推荐表达，用户点开答案或复盘时使用</span>
                    <textarea value={activeNode.data.dialogue.sampleAnswer} onChange={(event) => updateNodeById(activeNode.id, 'sampleAnswer', event.target.value)} rows={2} className={fieldClass} placeholder="I think I would like to eat out tonight." />
                  </label>
                </div>
              </section>

              <LineListEditor
                label="通过要点"
                help="用户回答里至少应该覆盖的意思。AI 评分时会参考这些点。"
                values={toStringArray(activeNodeRubric.requiredMeaning)}
                placeholder="例如：说明想去餐厅吃饭"
                onChange={(values) => updateNodeRubricList(activeNode.id, 'requiredMeaning', values)}
              />
              <LineListEditor
                label="常见错误"
                help="列出这个节点容易出现的问题，方便教练反馈。"
                values={toStringArray(activeNodeRubric.commonErrors)}
                placeholder="例如：只说 food，没有表达具体选择"
                onChange={(values) => updateNodeRubricList(activeNode.id, 'commonErrors', values)}
              />
              <LineListEditor
                label="评分重点"
                help="说明 AI 应该重点看什么，例如礼貌程度、语法、交际目的。"
                values={toStringArray(activeNodeRubric.scoringFocus)}
                placeholder="例如：表达是否自然礼貌"
                onChange={(values) => updateNodeRubricList(activeNode.id, 'scoringFocus', values)}
              />
              <LineListEditor
                label="提示语"
                help="用户请求 hint 时可以用这些提示，不会推进剧情。"
                values={activeNodeHints}
                placeholder="例如：先说 I would like to..."
                onChange={(values) => updateNodeHints(activeNode.id, values)}
              />

              <section className={subtlePanelClass}>
                <button type="button" onClick={() => setShowNodeJson((value) => !value)} className={buttonClass}>
                  <Settings2 className="h-3.5 w-3.5" />
                  {showNodeJson ? '隐藏高级 JSON' : '显示高级 JSON'}
                </button>
                {showNodeJson ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs text-cyan-100/58">rubricJson</span>
                      <textarea value={activeNode.data.dialogue.rubricJson} onChange={(event) => updateNodeById(activeNode.id, 'rubricJson', event.target.value)} rows={8} className={`${fieldClass} font-mono text-xs`} />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-cyan-100/58">hintJson</span>
                      <textarea value={activeNode.data.dialogue.hintJson} onChange={(event) => updateNodeById(activeNode.id, 'hintJson', event.target.value)} rows={8} className={`${fieldClass} font-mono text-xs`} />
                    </label>
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="space-y-3">
              <div className={subtlePanelClass}>
                <div className="text-sm font-semibold text-cyan-50">节点行为</div>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-xs text-cyan-100/72">
                    <input
                      type="checkbox"
                      checked={scenario?.startNodeId === activeNode.id}
                      onChange={(event) => event.target.checked && updateScenario('startNodeId', activeNode.id)}
                    />
                    设为起始节点
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">最多重试次数</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={activeNode.data.dialogue.retryLimit}
                      onChange={(event) => updateNodeById(activeNode.id, 'retryLimit', Number(event.target.value))}
                      className={compactFieldClass}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-cyan-100/72">
                    <input
                      type="checkbox"
                      checked={activeNode.data.dialogue.allowDynamicFollowup}
                      onChange={(event) => updateNodeById(activeNode.id, 'allowDynamicFollowup', event.target.checked)}
                    />
                    允许 AI 根据用户回答补一句过渡
                  </label>
                </div>
              </div>

              <div className={subtlePanelClass}>
                <div className="text-sm font-semibold text-cyan-50">填写建议</div>
                <div className="mt-2 space-y-2 text-xs leading-5 text-cyan-100/62">
                  <p>角色台词只写当前节点 AI 角色说的话。</p>
                  <p>用户目标写交际目的，不要写“回答正确”这种抽象描述。</p>
                  <p>通过要点越具体，评分和分支越稳定。</p>
                </div>
              </div>

              <button type="button" onClick={() => deleteNode(activeNode.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200">
                <Trash2 className="h-4 w-4" />
                删除节点
              </button>
            </aside>
          </div>
        </ModalShell>
      ) : null}

      {activeEdge ? (
        <ModalShell
          eyebrow="BRANCH RULES"
          title={`设置分支：${edgeLabel(activeEdge)}`}
          onClose={() => setEdgeModalId(null)}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <section className={subtlePanelClass}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <Link2 className="h-4 w-4 text-cyan-300/70" />
                  分支基础规则
                </div>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-cyan-100/58">分支名称，用户通过后 UI 会提示进入哪个分支</span>
                    <input value={edgeLabel(activeEdge)} onChange={(event) => updateEdgeById(activeEdge.id, { label: event.target.value })} className={fieldClass} placeholder="例如：去餐厅" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">触发结果</span>
                      <select value={edgeResult(activeEdge.data?.onResult)} onChange={(event) => updateEdgeById(activeEdge.id, { onResult: event.target.value as DialogueEdgeResult })} className={fieldClass}>
                        {DIALOGUE_EDGE_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-cyan-100/58">优先级，数字越小越先匹配</span>
                      <input type="number" value={edgePriority(activeEdge.data?.priority)} onChange={(event) => updateEdgeById(activeEdge.id, { priority: edgePriority(event.target.value) })} className={fieldClass} />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-cyan-100/72">
                    <input checked={Boolean(activeEdge.data?.isFallback)} onChange={(event) => updateEdgeById(activeEdge.id, { isFallback: event.target.checked })} type="checkbox" />
                    作为 fallback 分支：AI 无法确定具体语义时走这里
                  </label>
                </div>
              </section>

              <section className={subtlePanelClass}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50">
                  <GitBranch className="h-4 w-4 text-cyan-300/70" />
                  语义分支条件
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs text-cyan-100/58">目标意图，用一句话描述用户选择</span>
                  <input value={String(activeEdgeCondition.intent || '')} onChange={(event) => updateEdgeCondition(activeEdge.id, 'intent', event.target.value)} className={fieldClass} placeholder="例如：用户想去餐厅吃饭" />
                </label>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <LineListEditor
                    label="关键词"
                    help="写用户可能说出的核心词。"
                    values={toStringArray(activeEdgeCondition.keywords)}
                    placeholder="restaurant / eat out"
                    onChange={(values) => updateEdgeCondition(activeEdge.id, 'keywords', values)}
                  />
                  <LineListEditor
                    label="示例回答"
                    help="写 1-3 个能进入这个分支的自然回答。"
                    values={toStringArray(activeEdgeCondition.examples)}
                    placeholder="I want to eat out."
                    onChange={(values) => updateEdgeCondition(activeEdge.id, 'examples', values)}
                  />
                </div>
              </section>

              <section className={subtlePanelClass}>
                <button type="button" onClick={() => setShowEdgeJson((value) => !value)} className={buttonClass}>
                  <Settings2 className="h-3.5 w-3.5" />
                  {showEdgeJson ? '隐藏高级 JSON' : '显示高级 JSON'}
                </button>
                {showEdgeJson ? (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs text-cyan-100/58">conditionJson</span>
                    <textarea value={edgeConditionJson(activeEdge.data?.conditionJson)} onChange={(event) => updateEdgeById(activeEdge.id, { conditionJson: event.target.value })} rows={8} className={`${fieldClass} font-mono text-xs`} />
                  </label>
                ) : null}
              </section>
            </div>

            <aside className="space-y-3">
              <div className={subtlePanelClass}>
                <div className="text-sm font-semibold text-cyan-50">连接关系</div>
                <div className="mt-3 space-y-2 text-xs leading-5 text-cyan-100/62">
                  <p>From: {activeEdgeSource?.data.dialogue.title || activeEdge.source}</p>
                  <p>To: {activeEdgeTarget?.data.dialogue.title || activeEdge.target}</p>
                </div>
              </div>
              <div className={subtlePanelClass}>
                <div className="text-sm font-semibold text-cyan-50">填写建议</div>
                <div className="mt-2 space-y-2 text-xs leading-5 text-cyan-100/62">
                  <p>单条 pass 分支可以不填条件。</p>
                  <p>多条 pass 分支时，非 fallback 必须写意图、关键词或示例回答。</p>
                  <p>skip 分支不会评分，只用于用户说“跳过”。</p>
                </div>
              </div>
              <button type="button" onClick={() => deleteEdge(activeEdge.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200">
                <Trash2 className="h-4 w-4" />
                删除分支
              </button>
            </aside>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
