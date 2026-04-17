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
import { isAdminRole } from '@/lib/auth-types'
import { withBasePath } from '@/lib/base-path'
import { DIALOGUE_EDGE_RESULTS, DIALOGUE_VOICES, type DialogueEdgeResult } from '@/lib/dialogue'

type Status = { type: 'success' | 'error' | 'info'; message: string }
type Summary = { id: string; title: string; isPublished: boolean; nodesCount: number; updatedAt: string }
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
  edges: Array<{ id: string; fromNodeId: string; onResult: DialogueEdgeResult; toNodeId: string | null }>
}
type NodeData = Record<string, unknown> & { label: string; dialogue: DNode }
type EdgeData = Record<string, unknown> & { onResult: DialogueEdgeResult }
type FlowNode = Node<NodeData>
type FlowEdge = Edge<EdgeData>

const fieldClass = 'w-full rounded-md border border-cyan-500/24 bg-black/45 px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-300/60'
const buttonClass = 'rounded-md border border-cyan-500/30 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40'

function localNodeId() {
  return `dlg_node_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function localEdgeId() {
  return `dlg_edge_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function labelFor(node: DNode) {
  return `${node.title || `Node ${node.order + 1}`}\n${node.goal || 'No learner goal'}`
}

function toFlowNode(node: DNode): FlowNode {
  return {
    id: node.id,
    position: { x: node.positionX, y: node.positionY },
    data: { label: labelFor(node), dialogue: node },
  }
}

function toFlowEdge(edge: Detail['edges'][number]): FlowEdge {
  return {
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId || '',
    label: edge.onResult,
    animated: edge.onResult === 'pass',
    data: { onResult: edge.onResult },
  }
}

function emptyNode(order: number): DNode {
  return {
    id: localNodeId(),
    order,
    title: `Node ${order + 1}`,
    roleLineEn: 'Hello. What would you like to say?',
    roleLineZh: '',
    goal: 'Respond naturally to the role line.',
    rubricJson: '{\n  "requiredMeaning": []\n}',
    hintJson: '{\n  "hints": []\n}',
    sampleAnswer: '',
    retryLimit: 2,
    allowDynamicFollowup: false,
    positionX: 140 + order * 180,
    positionY: 140,
  }
}

function edgeResult(value: unknown): DialogueEdgeResult {
  return DIALOGUE_EDGE_RESULTS.includes(value as DialogueEdgeResult) ? value as DialogueEdgeResult : 'pass'
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
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId])

  useEffect(() => {
    if (authStatus === 'loading') return
    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/dialogue/upload')}`)
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
      setNodes(detail.nodes.map(toFlowNode))
      setEdges(detail.edges.filter((edge) => edge.toNodeId).map(toFlowEdge))
      setSelectedNodeId(detail.startNodeId || detail.nodes[0]?.id || null)
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Load scenario failed.' })
    } finally {
      setBusy(false)
    }
  }, [setEdges, setNodes])

  useEffect(() => {
    if (authStatus !== 'authenticated' || !isAdmin) return
    void loadSummaries().catch((error) => setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Load scenarios failed.' }))
  }, [authStatus, isAdmin, loadSummaries])

  const updateScenario = <K extends keyof Detail>(key: K, value: Detail[K]) => {
    setScenario((current) => current ? { ...current, [key]: value } : current)
  }

  const updateNode = <K extends keyof DNode>(key: K, value: DNode[K]) => {
    if (!selectedNodeId) return
    setNodes((items) => items.map((node) => {
      if (node.id !== selectedNodeId) return node
      const dialogue = { ...node.data.dialogue, [key]: value }
      return { ...node, data: { ...node.data, dialogue, label: labelFor(dialogue) } }
    }))
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    const used = new Set(edges.filter((edge) => edge.source === connection.source).map((edge) => edge.data?.onResult))
    const result = DIALOGUE_EDGE_RESULTS.find((item) => !used.has(item)) || 'pass'
    setEdges((items) => addEdge({
      id: localEdgeId(),
      source: connection.source || '',
      target: connection.target || '',
      label: result,
      animated: result === 'pass',
      data: { onResult: result },
    }, items))
  }, [edges, setEdges])

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
      setStatus({ type: 'success', message: 'Scenario created.' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Create scenario failed.' })
    } finally {
      setBusy(false)
    }
  }

  const addNode = () => {
    const node = emptyNode(nodes.length)
    setNodes((items) => [...items, toFlowNode(node)])
    setSelectedNodeId(node.id)
    if (!scenario?.startNodeId) updateScenario('startNodeId', node.id)
  }

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return
    setNodes((items) => items.filter((node) => node.id !== selectedNodeId))
    setEdges((items) => items.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
    setScenario((current) => current?.startNodeId === selectedNodeId ? { ...current, startNodeId: null } : current)
    setSelectedNodeId(null)
  }

  const saveScenario = async () => {
    if (!scenario) return
    setBusy(true)
    setStatus(null)
    try {
      const payload = {
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
        })),
      }
      const response = await fetch(withBasePath(`/api/dialogue/admin/scenarios/${scenario.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || `Save failed: ${response.status}`)
      setScenario(data)
      setNodes((data.nodes || []).map(toFlowNode))
      setEdges((data.edges || []).filter((edge: Detail['edges'][number]) => edge.toNodeId).map(toFlowEdge))
      await loadSummaries()
      setStatus({ type: 'success', message: 'Scenario saved.' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Save scenario failed.' })
    } finally {
      setBusy(false)
    }
  }

  const publishScenario = async (isPublished: boolean) => {
    if (!scenario) return
    await saveScenario()
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
      setStatus({ type: 'success', message: payload.isPublished ? 'Scenario published.' : 'Scenario unpublished.' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Publish update failed.' })
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
      setNodes([])
      setEdges([])
      setSelectedNodeId(null)
      await loadSummaries()
      setStatus({ type: 'success', message: 'Scenario deleted.' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Delete failed.' })
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
          text: language === 'zh' ? '你好，我会帮你把回答说得更自然。' : 'Hello, let us practice this scene together.',
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || `Preview failed: ${response.status}`)
      await new Audio(withBasePath(payload.audioUrl)).play()
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Voice preview failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (authStatus === 'loading' || !session?.user?.id || !isAdmin) {
    return <div className="relative z-50 flex min-h-screen items-center justify-center text-cyan-300">CHECKING ACCESS...</div>
  }

  return (
    <div className="dialogue-editor min-h-screen px-4 py-8 text-cyan-50 md:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-lg border border-cyan-500/28 bg-black/55 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/65">DIALOGUE GRAPH EDITOR</div>
            <h1 className="mt-2 text-2xl font-semibold">Scenario Authoring</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push('/dialogue')} className={buttonClass}>BACK</button>
            <button type="button" onClick={() => void createScenario()} disabled={busy} className={`${buttonClass} bg-cyan-400/[0.12]`}>NEW SCENARIO</button>
          </div>
        </header>

        {status ? <div className={`rounded-md border px-4 py-3 text-sm ${status.type === 'error' ? 'border-red-500/35 bg-red-500/[0.08] text-red-100' : 'border-cyan-400/35 bg-cyan-400/[0.08] text-cyan-100'}`}>{status.message}</div> : null}

        <div className="grid min-h-[75vh] gap-4 lg:grid-cols-[260px_1fr_360px]">
          <aside className="overflow-hidden rounded-lg border border-cyan-500/22 bg-black/45">
            <div className="border-b border-cyan-500/18 px-4 py-3 font-mono text-[11px] tracking-[0.2em] text-cyan-300/70">SCENARIOS</div>
            <div className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
              {summaries.map((item) => (
                <button key={item.id} type="button" onClick={() => void loadScenario(item.id)} className={`w-full rounded-md border px-3 py-3 text-left ${scenario?.id === item.id ? 'border-cyan-300/55 bg-cyan-400/[0.12]' : 'border-cyan-500/18 bg-black/24 hover:border-cyan-300/42'}`}>
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-cyan-200/58"><span>{item.nodesCount} NODES</span><span>{item.isPublished ? 'LIVE' : 'DRAFT'}</span></div>
                </button>
              ))}
              {summaries.length === 0 ? <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/60">No scenarios yet.</div> : null}
            </div>
          </aside>

          <main className="overflow-hidden rounded-lg border border-cyan-500/22 bg-black/34">
            {scenario ? (
              <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedNodeId(node.id)} fitView>
                <MiniMap pannable zoomable />
                <Background />
                <Controls />
              </ReactFlow>
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center text-center text-cyan-100/58">Create or select a dialogue scene.</div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto rounded-lg border border-cyan-500/22 bg-black/45 p-4">
            {scenario ? (
              <div className="space-y-5">
                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/68">SCENE META</h2><span className="rounded border border-cyan-500/20 px-2 py-1 text-[10px]">{scenario.isPublished ? 'LIVE' : 'DRAFT'}</span></div>
                  <input value={scenario.title} onChange={(e) => updateScenario('title', e.target.value)} className={fieldClass} placeholder="Title" />
                  <textarea value={scenario.description} onChange={(e) => updateScenario('description', e.target.value)} rows={3} className={fieldClass} placeholder="Description" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={scenario.difficulty} onChange={(e) => updateScenario('difficulty', e.target.value)} className={fieldClass} placeholder="Difficulty" />
                    <input value={scenario.tags.join(', ')} onChange={(e) => updateScenario('tags', e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean))} className={fieldClass} placeholder="Tags" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={scenario.userRole} onChange={(e) => updateScenario('userRole', e.target.value)} className={fieldClass} placeholder="User role" />
                    <input value={scenario.aiRole} onChange={(e) => updateScenario('aiRole', e.target.value)} className={fieldClass} placeholder="AI role" />
                  </div>
                  <input value={scenario.coverUrl || ''} onChange={(e) => updateScenario('coverUrl', e.target.value)} className={fieldClass} placeholder="Cover URL" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={scenario.roleVoice} onChange={(e) => updateScenario('roleVoice', e.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                    <select value={scenario.coachVoice} onChange={(e) => updateScenario('coachVoice', e.target.value)} className={fieldClass}>{DIALOGUE_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select>
                  </div>
                  <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void previewVoice('en')} className={`${buttonClass} flex-1`}>PREVIEW ROLE</button><button type="button" disabled={busy} onClick={() => void previewVoice('zh')} className={`${buttonClass} flex-1`}>PREVIEW COACH</button></div>
                </section>

                <section className="space-y-3 border-t border-cyan-500/18 pt-5">
                  <div className="flex items-center justify-between"><h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/68">NODE</h2><button type="button" onClick={addNode} className={buttonClass}>ADD NODE</button></div>
                  {selectedNode ? (
                    <>
                      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={scenario.startNodeId === selectedNode.id} onChange={(e) => e.target.checked && updateScenario('startNodeId', selectedNode.id)} /> Start node</label>
                      <input value={selectedNode.data.dialogue.title} onChange={(e) => updateNode('title', e.target.value)} className={fieldClass} placeholder="Node title" />
                      <textarea value={selectedNode.data.dialogue.roleLineEn} onChange={(e) => updateNode('roleLineEn', e.target.value)} rows={3} className={fieldClass} placeholder="Role line English" />
                      <textarea value={selectedNode.data.dialogue.roleLineZh || ''} onChange={(e) => updateNode('roleLineZh', e.target.value)} rows={2} className={fieldClass} placeholder="Role line Chinese" />
                      <textarea value={selectedNode.data.dialogue.goal} onChange={(e) => updateNode('goal', e.target.value)} rows={3} className={fieldClass} placeholder="Learner goal" />
                      <textarea value={selectedNode.data.dialogue.sampleAnswer} onChange={(e) => updateNode('sampleAnswer', e.target.value)} rows={2} className={fieldClass} placeholder="Sample answer" />
                      <div className="grid gap-2 sm:grid-cols-2"><input type="number" min={0} max={5} value={selectedNode.data.dialogue.retryLimit} onChange={(e) => updateNode('retryLimit', Number(e.target.value))} className={fieldClass} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedNode.data.dialogue.allowDynamicFollowup} onChange={(e) => updateNode('allowDynamicFollowup', e.target.checked)} /> Dynamic followup</label></div>
                      <textarea value={selectedNode.data.dialogue.rubricJson} onChange={(e) => updateNode('rubricJson', e.target.value)} rows={4} className={`${fieldClass} font-mono text-xs`} placeholder="Rubric JSON" />
                      <textarea value={selectedNode.data.dialogue.hintJson} onChange={(e) => updateNode('hintJson', e.target.value)} rows={4} className={`${fieldClass} font-mono text-xs`} placeholder="Hint JSON" />
                      <button type="button" onClick={deleteSelectedNode} className="w-full rounded-md border border-red-400/35 px-3 py-2 text-xs text-red-200">DELETE NODE</button>
                    </>
                  ) : <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/58">Select a node on the graph.</div>}
                </section>

                <section className="space-y-3 border-t border-cyan-500/18 pt-5">
                  <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/68">EDGES</h2>
                  {edges.map((edge) => (
                    <div key={edge.id} className="rounded-md border border-cyan-500/18 bg-black/28 p-3">
                      <div className="mb-2 truncate text-xs text-cyan-100/58">{edge.source} -&gt; {edge.target}</div>
                      <div className="flex gap-2"><select value={edgeResult(edge.data?.onResult)} onChange={(e) => setEdges((items) => items.map((item) => item.id === edge.id ? { ...item, label: e.target.value, animated: e.target.value === 'pass', data: { onResult: e.target.value as DialogueEdgeResult } } : item))} className={fieldClass}>{DIALOGUE_EDGE_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}</select><button type="button" onClick={() => setEdges((items) => items.filter((item) => item.id !== edge.id))} className={buttonClass}>DEL</button></div>
                    </div>
                  ))}
                  {edges.length === 0 ? <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-3 text-sm text-cyan-100/58">Drag from one node handle to another.</div> : null}
                </section>

                <section className="space-y-2 border-t border-cyan-500/18 pt-5">
                  <button type="button" onClick={() => void saveScenario()} disabled={busy} className={`${buttonClass} w-full bg-cyan-400/[0.12]`}>{busy ? 'WORKING...' : 'SAVE SCENARIO'}</button>
                  <button type="button" onClick={() => void publishScenario(!scenario.isPublished)} disabled={busy} className={`${buttonClass} w-full bg-emerald-400/[0.1]`}>{scenario.isPublished ? 'UNPUBLISH' : 'PUBLISH'}</button>
                  <button type="button" onClick={() => void deleteScenario()} disabled={busy} className="w-full rounded-md border border-red-400/38 px-4 py-3 text-sm text-red-200 disabled:opacity-40">DELETE SCENARIO</button>
                </section>
              </div>
            ) : <div className="rounded-md border border-cyan-500/16 bg-black/28 px-3 py-4 text-sm text-cyan-100/58">Select or create a scenario to edit.</div>}
          </aside>
        </div>
      </div>
    </div>
  )
}
