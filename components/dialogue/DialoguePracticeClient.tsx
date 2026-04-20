'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import DialogueCoachAvatar, {
  type DialogueAvatarExpression,
  type DialogueAvatarState,
} from '@/components/dialogue/DialogueCoachAvatar'
import { withBasePath } from '@/lib/base-path'
import { useMicrophoneLevel } from '@/hooks/useMicrophoneLevel'

interface DialogueNodeView {
  id: string
  order: number
  title: string
  roleLineEn: string
  roleLineZh: string | null
  goal: string
  sampleAnswer: string
  retryLimit: number
}

interface DialoguePracticePayload {
  session: {
    id: string
    status: string
    averageScore: number
    completedNodeCount: number
  }
  scenario: {
    id: string
    title: string
    description: string
    difficulty: string
    userRole: string
    aiRole: string
    tags: string[]
    roleVoice: string
    coachVoice: string
  }
  currentNode: DialogueNodeView | null
  attempts: Array<{
    id: string
    nodeId: string | null
    userText: string
    routerIntent: string
    coachReplyZh: string | null
    betterAnswerEn: string | null
    passed: boolean | null
    score: number | null
    nextAction: string
  }>
  evaluator?: {
    passed: boolean
    score: number
    coach_feedback_zh: string
    better_answer_en: string
    missing_points: string[]
    covered_points: string[]
  } | null
  coach?: {
    coach_reply_zh: string
    vocab_notes: string[]
    grammar_notes: string[]
    better_answer_en: string | null
  } | null
  roleReplyEn?: string | null
  coachReplyZh?: string | null
  transcriptText?: string | null
  nextAction?: string
}

interface DialoguePracticeClientProps {
  scenarioId: string
}

interface DialogueMessage {
  id: string
  speaker: 'role' | 'user' | 'coach' | 'system'
  text: string
  meta?: string
}

function createMessage(speaker: DialogueMessage['speaker'], text: string, meta?: string): DialogueMessage {
  return {
    id: `${speaker}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    speaker,
    text,
    meta,
  }
}

export default function DialoguePracticeClient({ scenarioId }: DialoguePracticeClientProps) {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [practice, setPractice] = useState<DialoguePracticePayload | null>(null)
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [answerText, setAnswerText] = useState('')
  const [coachQuestion, setCoachQuestion] = useState('')
  const [statusText, setStatusText] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [avatarState, setAvatarState] = useState<DialogueAvatarState>('idle')
  const [expression, setExpression] = useState<DialogueAvatarExpression>('normal')
  const [amplitude, setAmplitude] = useState(0)
  const { level: listeningLevel, start: startMicrophoneLevel, stop: stopMicrophoneLevel } = useMicrophoneLevel()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }

    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/dialogue/${scenarioId}`)}`)
      return
    }

    if (initializedRef.current) {
      return
    }

    initializedRef.current = true

    const createSession = async () => {
      setStatusText('Creating dialogue session...')

      try {
        const response = await fetch(withBasePath('/api/dialogue/sessions'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioId }),
        })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || `Create session failed: ${response.status}`)
        }

        setPractice(payload)
        setMessages(
          payload.currentNode
            ? [createMessage('role', payload.currentNode.roleLineEn, payload.currentNode.roleLineZh || undefined)]
            : [createMessage('system', 'This scene has no available starting line.')]
        )
        setStatusText(null)
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : 'Failed to create dialogue session.')
      }
    }

    void createSession()
  }, [authStatus, router, scenarioId, session?.user?.id])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current)
      }

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      audioRef.current?.pause()
      audioContextRef.current?.close().catch(() => undefined)
      stopMicrophoneLevel()
    }
  }, [stopMicrophoneLevel])

  const playAudio = useCallback(async (audioUrl: string, mode: 'role' | 'coach') => {
    audioRef.current?.pause()

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const audio = new Audio(withBasePath(audioUrl))
    audioRef.current = audio
    setAvatarState(mode === 'coach' ? 'coach_mode' : 'speaking')

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext is unavailable.')
      }
      const context = audioContextRef.current || new AudioContextClass()
      audioContextRef.current = context
      const source = context.createMediaElementSource(audio)
      const analyser = context.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyser.connect(context.destination)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const average = data.reduce((sum, value) => sum + value, 0) / Math.max(data.length, 1)
        setAmplitude(Math.min(1, average / 128))
        animationFrameRef.current = window.requestAnimationFrame(tick)
      }

      tick()
    } catch {
      setAmplitude(0.45)
    }

    audio.onended = () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      setAmplitude(0)
      setAvatarState('idle')
    }

    try {
      await audio.play()
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : 'Audio playback failed.')
    }
  }, [])

  const speak = useCallback(async (kind: 'current_role' | 'last_coach' | 'last_better_answer') => {
    if (!practice) {
      return
    }

    setStatusText(null)

    try {
      const response = await fetch(withBasePath(`/api/dialogue/sessions/${practice.session.id}/speak`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Speech request failed: ${response.status}`)
      }

      await playAudio(payload.audioUrl, kind === 'last_coach' ? 'coach' : 'role')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Speech request failed.')
    }
  }, [playAudio, practice])

  const applyResponsePayload = (payload: DialoguePracticePayload) => {
    setPractice(payload)
    setExpression(payload.evaluator?.passed ? 'encouraging' : payload.evaluator ? 'corrective' : payload.coach ? 'encouraging' : 'normal')

    setMessages((prev) => {
      const next = [...prev]

      if (payload.transcriptText) {
        next.push(createMessage('system', `语音转写：${payload.transcriptText}`))
      }

      if (payload.coachReplyZh) {
        next.push(createMessage('coach', payload.coachReplyZh))
      }

      if (payload.evaluator?.missing_points?.length) {
        next.push(createMessage('system', `还缺：${payload.evaluator.missing_points.join(' / ')}`))
      }

      if (payload.roleReplyEn) {
        next.push(createMessage('role', payload.roleReplyEn, payload.currentNode?.roleLineZh || undefined))
      }

      if (payload.session.status === 'completed') {
        next.push(createMessage('system', 'Scene completed. You can reset this session or return to the scenario list.'))
      }

      return next
    })
  }

  const submitText = async () => {
    if (!practice || !answerText.trim() || isSubmitting) {
      return
    }

    const submittedText = answerText.trim()
    setMessages((prev) => [...prev, createMessage('user', submittedText)])
    setAnswerText('')
    setIsSubmitting(true)
    setStatusText(null)
    setAvatarState('thinking')

    try {
      const response = await fetch(withBasePath(`/api/dialogue/sessions/${practice.session.id}/respond-text`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: submittedText }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Submit failed: ${response.status}`)
      }

      applyResponsePayload(payload)
      setAvatarState('idle')
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : 'Submit failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startRecording = async () => {
    if (isRecording || isSubmitting) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      void startMicrophoneLevel(stream).catch(() => undefined)
      setIsRecording(true)
      setRecordingSeconds(0)
      setAvatarState('listening')
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1)
      }, 1000)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Microphone permission failed.')
    }
  }

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    recordedChunksRef.current = []
    stopMicrophoneLevel()
    setIsRecording(false)
    setRecordingSeconds(0)
    setAvatarState('idle')

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const submitRecording = async () => {
    if (!practice || !mediaRecorderRef.current || isSubmitting) {
      return
    }

    const recorder = mediaRecorderRef.current
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true })
    })
    recorder.stop()
    mediaRecorderRef.current = null
    await stopped
    stopMicrophoneLevel()

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
    recordedChunksRef.current = []
    setIsRecording(false)
    setRecordingSeconds(0)

    if (audioBlob.size === 0) {
      setStatusText('Recording is empty.')
      setAvatarState('idle')
      return
    }

    setMessages((prev) => [...prev, createMessage('user', '[ voice response ]')])
    setIsSubmitting(true)
    setAvatarState('thinking')
    setStatusText(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'dialogue-response.webm')
      const response = await fetch(withBasePath(`/api/dialogue/sessions/${practice.session.id}/respond-audio`), {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Audio submit failed: ${response.status}`)
      }

      applyResponsePayload(payload)
      setAvatarState('idle')
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : 'Audio submit failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const postCoachAction = async (path: string, body?: Record<string, unknown>) => {
    if (!practice || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setAvatarState('thinking')
    setStatusText(null)

    try {
      const response = await fetch(withBasePath(`/api/dialogue/sessions/${practice.session.id}/${path}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Coach request failed: ${response.status}`)
      }

      applyResponsePayload(payload)
      setAvatarState('idle')
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : 'Coach request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetSession = async () => {
    if (!practice || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setStatusText(null)

    try {
      const response = await fetch(withBasePath(`/api/dialogue/sessions/${practice.session.id}/reset`), {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `Reset failed: ${response.status}`)
      }

      setPractice(payload)
      setMessages(
        payload.currentNode
          ? [createMessage('role', payload.currentNode.roleLineEn, payload.currentNode.roleLineZh || undefined)]
          : [createMessage('system', 'This scene has no available starting line.')]
      )
      setAvatarState('idle')
      setExpression('normal')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Reset failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentNode = practice?.currentNode || null
  const completed = practice?.session.status === 'completed'

  return (
    <div className="dialogue-practice min-h-screen px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-lg border border-cyan-500/25 bg-black/45 p-4 shadow-[0_0_28px_rgba(34,211,238,0.1)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/65">DIALOGUE SCENE</div>
            <h1 className="mt-2 text-2xl font-semibold text-cyan-50">{practice?.scenario.title || 'Loading dialogue...'}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/65">
              {practice?.scenario.description || 'Practice a real-life English scenario with your AI coach.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-cyan-100/75">
            <span className="rounded border border-cyan-500/22 bg-black/28 px-3 py-2">ROLE: {practice?.scenario.userRole || 'Learner'}</span>
            <span className="rounded border border-cyan-500/22 bg-black/28 px-3 py-2">AI: {practice?.scenario.aiRole || 'Coach'}</span>
            <span className="rounded border border-cyan-500/22 bg-black/28 px-3 py-2">AVG: {practice?.session.averageScore || 0}</span>
          </div>
        </div>

        <div className="grid min-h-[70vh] gap-5 lg:grid-cols-[320px_1fr_320px]">
          <aside className="space-y-4 rounded-lg border border-cyan-500/22 bg-black/42 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            <DialogueCoachAvatar
              state={avatarState}
              expression={expression}
              amplitude={amplitude}
              listeningLevel={avatarState === 'listening' ? listeningLevel : 0}
            />

            <div className="rounded-lg border border-cyan-500/16 bg-black/30 p-4">
              <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/60">CURRENT TASK</div>
              <div className="mt-3 text-sm leading-6 text-cyan-50">
                {currentNode?.goal || 'Create a session to load the first task.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-200/70">
                <span>Node #{currentNode ? currentNode.order + 1 : '-'}</span>
                <span>Retry limit {currentNode?.retryLimit ?? '-'}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void speak('current_role')}
                disabled={!practice || !currentNode}
                className="rounded-md border border-cyan-500/35 bg-cyan-500/[0.1] px-3 py-2 text-xs text-cyan-100 transition-colors hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                PLAY ROLE LINE
              </button>
              <button
                type="button"
                onClick={() => void speak('last_coach')}
                disabled={!practice}
                className="rounded-md border border-cyan-500/24 px-3 py-2 text-xs text-cyan-200/80 transition-colors hover:border-cyan-300/55 disabled:cursor-not-allowed disabled:opacity-40"
              >
                PLAY COACH FEEDBACK
              </button>
              <button
                type="button"
                onClick={() => void speak('last_better_answer')}
                disabled={!practice}
                className="rounded-md border border-cyan-500/24 px-3 py-2 text-xs text-cyan-200/80 transition-colors hover:border-cyan-300/55 disabled:cursor-not-allowed disabled:opacity-40"
              >
                PLAY BETTER ANSWER
              </button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-col rounded-lg border border-cyan-500/22 bg-black/36 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            <div className="flex items-center justify-between border-b border-cyan-500/18 px-4 py-3">
              <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/70">CONVERSATION</div>
              <button
                type="button"
                onClick={resetSession}
                disabled={!practice || isSubmitting}
                className="rounded border border-cyan-500/24 px-2 py-1 text-[10px] text-cyan-200/75 transition-colors hover:border-cyan-300/55 disabled:opacity-40"
              >
                RESET
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-lg border px-4 py-3 ${
                    message.speaker === 'user'
                      ? 'ml-auto border-emerald-400/24 bg-emerald-400/[0.08] text-emerald-50'
                      : message.speaker === 'coach'
                        ? 'border-fuchsia-300/22 bg-fuchsia-300/[0.08] text-fuchsia-50'
                        : message.speaker === 'system'
                          ? 'mx-auto border-yellow-300/22 bg-yellow-300/[0.08] text-yellow-50'
                          : 'border-cyan-300/24 bg-cyan-300/[0.09] text-cyan-50'
                  }`}
                >
                  <div className="mb-1 font-mono text-[10px] tracking-[0.18em] opacity-60">
                    {message.speaker.toUpperCase()}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7">{message.text}</div>
                  {message.meta ? <div className="mt-2 text-xs leading-5 opacity-65">{message.meta}</div> : null}
                </div>
              ))}
              {statusText ? (
                <div className="rounded-md border border-yellow-400/30 bg-yellow-400/[0.08] px-4 py-3 text-sm text-yellow-100">
                  {statusText}
                </div>
              ) : null}
            </div>

            <div className="border-t border-cyan-500/18 p-4">
              <textarea
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                rows={3}
                disabled={isSubmitting || completed}
                className="w-full resize-none rounded-md border border-cyan-500/24 bg-black/45 px-4 py-3 text-sm leading-6 text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={completed ? 'Scene completed.' : 'Type your answer or ask the coach in Chinese...'}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submitText()}
                  disabled={!answerText.trim() || isSubmitting || completed}
                  className="rounded-md border border-cyan-300/50 bg-cyan-400/[0.16] px-4 py-2 text-sm text-cyan-50 transition-colors hover:bg-cyan-400/[0.24] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? 'SUBMITTING...' : 'SUBMIT TEXT'}
                </button>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={isSubmitting || completed}
                    className="rounded-md border border-emerald-300/42 bg-emerald-400/[0.12] px-4 py-2 text-sm text-emerald-50 transition-colors hover:bg-emerald-400/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    HOLD RECORD
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void submitRecording()}
                      className="rounded-md border border-emerald-300/50 bg-emerald-400/[0.18] px-4 py-2 text-sm text-emerald-50"
                    >
                      SUBMIT VOICE {recordingSeconds}s
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="rounded-md border border-red-400/40 px-4 py-2 text-sm text-red-200"
                    >
                      CANCEL
                    </button>
                  </>
                )}
              </div>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col gap-4 rounded-lg border border-cyan-500/22 bg-black/42 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            <div>
              <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/60">COACH PANEL</div>
              <p className="mt-2 text-sm leading-6 text-cyan-100/65">
                Ask for a hint, translation, grammar explanation, or a better answer. Coach mode never advances the scene by itself.
              </p>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void postCoachAction('request-hint')}
                disabled={!practice || isSubmitting || completed}
                className="rounded-md border border-cyan-500/26 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/55 disabled:opacity-40"
              >
                REQUEST HINT
              </button>
              <button
                type="button"
                onClick={() => void postCoachAction('reveal-answer')}
                disabled={!practice || isSubmitting || completed}
                className="rounded-md border border-cyan-500/26 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/55 disabled:opacity-40"
              >
                REVEAL ANSWER
              </button>
            </div>

            <div className="space-y-2">
              <textarea
                value={coachQuestion}
                onChange={(event) => setCoachQuestion(event.target.value)}
                rows={4}
                disabled={isSubmitting || completed}
                className="w-full resize-none rounded-md border border-cyan-500/22 bg-black/42 px-3 py-2 text-sm leading-6 text-cyan-50 outline-none placeholder:text-cyan-200/35 focus:border-cyan-300/55 disabled:opacity-50"
                placeholder="例如：reservation 在这里怎么用？刚刚我哪里不自然？"
              />
              <button
                type="button"
                onClick={() => {
                  const question = coachQuestion.trim()
                  if (!question) {
                    return
                  }
                  setMessages((prev) => [...prev, createMessage('user', question, 'Coach question')])
                  setCoachQuestion('')
                  void postCoachAction('ask-coach', { question })
                }}
                disabled={!coachQuestion.trim() || isSubmitting || completed}
                className="w-full rounded-md border border-fuchsia-300/38 bg-fuchsia-300/[0.1] px-3 py-2 text-xs text-fuchsia-50 transition-colors hover:bg-fuchsia-300/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ASK COACH
              </button>
            </div>

            <div className="mt-auto rounded-md border border-cyan-500/14 bg-black/26 p-3 text-xs leading-5 text-cyan-100/58">
              AI voice is synthetic. Your recorded audio is transcribed for this turn and is not stored.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
