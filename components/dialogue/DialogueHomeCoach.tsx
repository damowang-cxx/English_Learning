'use client'

import Link from 'next/link'
import { Mic, MicOff, Radio } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DialogueCoachAvatar, {
  type DialogueAvatarExpression,
  type DialogueAvatarState,
} from '@/components/dialogue/DialogueCoachAvatar'
import type { HomeDialogueScenarioCardItem } from '@/components/dialogue/HomeDialogueScenarioGrid'
import { useRealtimeVoiceAdapter, type RealtimeVoiceStatus } from '@/hooks/useRealtimeVoiceAdapter'
import { withBasePath } from '@/lib/base-path'

type HomeCoachMessageRole = 'user' | 'coach' | 'system'

interface HomeCoachMessage {
  id: string
  role: HomeCoachMessageRole
  text: string
  speechToken?: string
  suggestedScenarioIds?: string[]
  studyTips?: string[]
}

interface DialogueHomeCoachProps {
  scenarios: HomeDialogueScenarioCardItem[]
  isAuthenticated: boolean
}

function createMessage(
  role: HomeCoachMessageRole,
  text: string,
  extra?: Partial<HomeCoachMessage>
): HomeCoachMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role,
    text,
    ...extra,
  }
}

const realtimeStatusLabels: Record<RealtimeVoiceStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  listening: '正在听',
  speaking: '教练回应',
  connected: '已连接',
  disconnected: '已结束',
  error: '连接异常',
}

export default function DialogueHomeCoach({ scenarios, isAuthenticated }: DialogueHomeCoachProps) {
  const [messages, setMessages] = useState<HomeCoachMessage[]>([
    createMessage(
      'coach',
      '可以问我今天练哪个场景、怎么准备某类对话，或直接问英语表达。我也可以听你说完后给学习建议。'
    ),
  ])
  const [input, setInput] = useState('')
  const [statusText, setStatusText] = useState<string | null>(null)
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [avatarState, setAvatarState] = useState<DialogueAvatarState>('idle')
  const [expression, setExpression] = useState<DialogueAvatarExpression>('encouraging')
  const [amplitude, setAmplitude] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const scenarioById = useMemo(
    () => new Map(scenarios.map((scenario) => [scenario.id, scenario])),
    [scenarios]
  )

  const recentMessages = useMemo(
    () =>
      messages
        .filter((message) => message.role === 'user' || message.role === 'coach')
        .slice(-8)
        .map((message) => ({
          role: message.role === 'coach' ? 'coach' : 'user',
          text: message.text,
        })),
    [messages]
  )

  const handleRealtimeTurnCommitted = useCallback(
    (turn: { conversationSessionId: string; turnId: string; userTranscript: string; assistantTranscript: string }) => {
      setConversationSessionId(turn.conversationSessionId)
      setMessages((current) => [
        ...current,
        createMessage('user', turn.userTranscript),
        createMessage('coach', turn.assistantTranscript),
      ])
      setExpression('encouraging')
      setStatusText(null)
    },
    []
  )

  const realtime = useRealtimeVoiceAdapter({
    conversationSessionId,
    disabled: !isAuthenticated,
    onConversationSessionId: setConversationSessionId,
    onTurnCommitted: handleRealtimeTurnCommitted,
    onStatusMessage: setStatusText,
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      audioRef.current?.pause()
      audioContextRef.current?.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!realtime.isActive) {
      if (!isRecording && !isSubmitting) {
        setAvatarState('idle')
        setAmplitude(0)
      }
      return
    }

    if (realtime.status === 'connecting') {
      setAvatarState('thinking')
      setAmplitude(0.18)
      return
    }

    if (realtime.status === 'listening') {
      setAvatarState('listening')
      setAmplitude(0.3)
      return
    }

    if (realtime.status === 'speaking') {
      setAvatarState('coach_mode')
      setAmplitude(0.58)
      setExpression('encouraging')
      return
    }

    setAvatarState('idle')
    setAmplitude(0.08)
  }, [isRecording, isSubmitting, realtime.isActive, realtime.status])

  const playAudio = useCallback(async (audioUrl: string) => {
    audioRef.current?.pause()

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const audio = new Audio(withBasePath(audioUrl))
    audioRef.current = audio
    setAvatarState('coach_mode')
    setExpression('encouraging')

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
      setStatusText(error instanceof Error ? error.message : '语音播放失败。')
    }
  }, [])

  const applyCoachPayload = (payload: {
    replyZh: string
    speechToken?: string
    suggestedScenarioIds?: string[]
    studyTips?: string[]
    transcriptText?: string
    conversationSessionId?: string
    turnId?: string
  }) => {
    if (payload.conversationSessionId) {
      setConversationSessionId(payload.conversationSessionId)
    }

    setMessages((current) => {
      const next = [...current]

      if (payload.transcriptText) {
        next.push(createMessage('system', `语音转写：${payload.transcriptText}`))
      }

      next.push(createMessage('coach', payload.replyZh, {
        speechToken: payload.speechToken,
        suggestedScenarioIds: payload.suggestedScenarioIds || [],
        studyTips: payload.studyTips || [],
      }))

      return next
    })
    setExpression(payload.suggestedScenarioIds?.length ? 'encouraging' : 'normal')
  }

  const submitMessage = async (message: string) => {
    const trimmed = message.trim()

    if (!trimmed || isSubmitting || realtime.isActive || !isAuthenticated) {
      return
    }

    setMessages((current) => [...current, createMessage('user', trimmed)])
    setInput('')
    setIsSubmitting(true)
    setAvatarState('thinking')
    setStatusText(null)

    try {
      const response = await fetch(withBasePath('/api/dialogue/home-coach/respond-text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          recentMessages,
          conversationSessionId,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `教练响应失败：${response.status}`)
      }

      applyCoachPayload(payload)
      setAvatarState('idle')
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : '教练响应失败。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startRecording = async () => {
    if (isRecording || isSubmitting || realtime.isActive || !isAuthenticated) {
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
      setIsRecording(true)
      setRecordingSeconds(0)
      setAvatarState('listening')
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => value + 1)
      }, 1000)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '无法访问麦克风。')
    }
  }

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    recordedChunksRef.current = []
    setIsRecording(false)
    setRecordingSeconds(0)
    setAvatarState('idle')

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const submitRecording = async () => {
    if (!mediaRecorderRef.current || isSubmitting || realtime.isActive || !isAuthenticated) {
      return
    }

    const recorder = mediaRecorderRef.current
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true })
    })
    recorder.stop()
    mediaRecorderRef.current = null
    await stopped

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
    recordedChunksRef.current = []
    setIsRecording(false)
    setRecordingSeconds(0)

    if (audioBlob.size === 0) {
      setStatusText('录音为空，请重新录制。')
      setAvatarState('idle')
      return
    }

    setMessages((current) => [...current, createMessage('user', '[语音消息]')])
    setIsSubmitting(true)
    setAvatarState('thinking')
    setStatusText(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'dialogue-home-coach.webm')
      formData.append('recentMessages', JSON.stringify(recentMessages))
      if (conversationSessionId) {
        formData.append('conversationSessionId', conversationSessionId)
      }
      const response = await fetch(withBasePath('/api/dialogue/home-coach/respond-audio'), {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `语音提交失败：${response.status}`)
      }

      applyCoachPayload(payload)
      setAvatarState('idle')
    } catch (error) {
      setAvatarState('idle')
      setStatusText(error instanceof Error ? error.message : '语音提交失败。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const speakMessage = async (speechToken: string | undefined) => {
    if (!speechToken || isSubmitting || !isAuthenticated) {
      return
    }

    setStatusText(null)

    try {
      const response = await fetch(withBasePath('/api/dialogue/home-coach/speak'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speechToken }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `语音生成失败：${response.status}`)
      }

      await playAudio(payload.audioUrl)
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '语音生成失败。')
    }
  }

  return (
    <section className="dialogue-home-coach">
      <div className="dialogue-home-coach__avatar">
        <DialogueCoachAvatar state={avatarState} expression={expression} amplitude={amplitude} />
      </div>

      <div className="dialogue-home-coach__panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/65">AI DIALOGUE COACH</div>
            <h2 className="mt-2 text-2xl font-semibold text-cyan-50">先聊目标，再选场景。</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-100/68">
              你可以直接问英语表达、面试准备、旅行点餐，或者让我根据目标推荐今天该练的 dialogue 场景。
            </p>
          </div>
          <div className="rounded-md border border-cyan-500/18 bg-black/28 px-3 py-2 font-mono text-[11px] text-cyan-100/65">
            {scenarios.length} PUBLISHED SCENES
          </div>
        </div>

        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => {
            const suggestedScenarios = (message.suggestedScenarioIds || [])
              .map((id) => scenarioById.get(id))
              .filter((scenario): scenario is HomeDialogueScenarioCardItem => Boolean(scenario))

            return (
              <div
                key={message.id}
                className={`rounded-lg border px-4 py-3 ${
                  message.role === 'user'
                    ? 'ml-auto max-w-[82%] border-emerald-400/24 bg-emerald-400/[0.08] text-emerald-50'
                    : message.role === 'system'
                      ? 'mx-auto max-w-[90%] border-yellow-300/22 bg-yellow-300/[0.08] text-yellow-50'
                      : 'max-w-[92%] border-cyan-300/22 bg-cyan-300/[0.08] text-cyan-50'
                }`}
              >
                <div className="mb-1 font-mono text-[10px] tracking-[0.18em] opacity-60">
                  {message.role === 'coach' ? 'COACH' : message.role.toUpperCase()}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7">{message.text}</div>

                {message.studyTips?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.studyTips.map((tip, index) => (
                      <span key={`${message.id}_tip_${index}`} className="rounded border border-cyan-500/18 bg-black/24 px-2 py-1 text-xs text-cyan-100/72">
                        {tip}
                      </span>
                    ))}
                  </div>
                ) : null}

                {suggestedScenarios.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {suggestedScenarios.map((scenario) => (
                      <Link
                        key={scenario.id}
                        href={`/dialogue/${scenario.id}`}
                        className="rounded-md border border-cyan-500/22 bg-black/26 px-3 py-2 transition-colors hover:border-cyan-300/58"
                      >
                        <div className="truncate text-sm font-semibold text-cyan-50">{scenario.title}</div>
                        <div className="mt-1 text-xs text-cyan-100/56">{scenario.difficulty} / {scenario.nodesCount} nodes</div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {message.speechToken ? (
                  <button
                    type="button"
                    onClick={() => void speakMessage(message.speechToken)}
                    className="mt-3 rounded-md border border-cyan-500/24 px-2.5 py-1.5 text-[11px] text-cyan-200/80 transition-colors hover:border-cyan-300/55"
                  >
                    播放教练回答
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        {statusText ? (
          <div className="mt-3 rounded-md border border-yellow-400/30 bg-yellow-400/[0.08] px-4 py-3 text-sm text-yellow-100">
            {statusText}
          </div>
        ) : null}

        {!isAuthenticated ? (
          <div className="mt-4 rounded-lg border border-cyan-500/22 bg-black/30 p-4 text-sm leading-6 text-cyan-100/72">
            登录后可以和首页教练自由聊天、录音提问并获取场景推荐。
            <Link href="/login?callbackUrl=/dialogue" className="ml-2 text-cyan-200 underline underline-offset-4">
              去登录
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-300/24 bg-emerald-300/[0.06] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-emerald-200/75">
                    <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                    REALTIME VOICE
                  </div>
                  <div className="mt-1 text-sm text-cyan-50">中英双语实时教练</div>
                  <div className="mt-1 truncate text-xs text-cyan-100/52">
                    {realtime.model ? `${realtime.model} / ${realtime.voice || 'voice'}` : 'WebRTC live session'}
                  </div>
                  {realtime.lastSavedTurnId || realtime.lastSaveError ? (
                    <div className="mt-1 text-xs text-cyan-100/48">
                      {realtime.lastSaveError ? '上一轮记录保存失败，可继续实时交流' : '上一轮实时对话已保存'}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-emerald-300/20 bg-black/24 px-2.5 py-1.5 font-mono text-[11px] text-emerald-100/75">
                    {realtimeStatusLabels[realtime.status]}
                  </span>
                  {!realtime.isActive ? (
                    <button
                      type="button"
                      onClick={() => void realtime.start()}
                      disabled={isSubmitting || isRecording}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-300/45 bg-emerald-400/[0.14] px-3 py-2 text-sm text-emerald-50 transition-colors hover:bg-emerald-400/[0.22] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Mic className="h-4 w-4" aria-hidden="true" />
                      开始实时交流
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={realtime.stop}
                      className="inline-flex items-center gap-2 rounded-md border border-red-300/40 bg-red-400/[0.1] px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-400/[0.16]"
                    >
                      <MicOff className="h-4 w-4" aria-hidden="true" />
                      结束实时交流
                    </button>
                  )}
                </div>
              </div>

              {realtime.liveUserTranscript || realtime.liveAssistantTranscript ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-cyan-300/16 bg-black/24 px-3 py-2">
                    <div className="font-mono text-[10px] tracking-[0.16em] text-cyan-100/45">YOU</div>
                    <div className="mt-1 line-clamp-3 text-xs leading-5 text-cyan-50/82">
                      {realtime.liveUserTranscript || '...'}
                    </div>
                  </div>
                  <div className="rounded-md border border-emerald-300/16 bg-black/24 px-3 py-2">
                    <div className="font-mono text-[10px] tracking-[0.16em] text-emerald-100/45">COACH</div>
                    <div className="mt-1 line-clamp-3 text-xs leading-5 text-emerald-50/82">
                      {realtime.liveAssistantTranscript || '...'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              disabled={isSubmitting || realtime.isActive}
              className="w-full resize-none rounded-md border border-cyan-500/24 bg-black/45 px-4 py-3 text-sm leading-6 text-cyan-50 outline-none transition-colors placeholder:text-cyan-200/35 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="例如：我想练面试英语，应该从哪个场景开始？或者问：reservation 和 booking 有什么区别？"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void submitMessage(input)}
                disabled={!input.trim() || isSubmitting || realtime.isActive}
                className="rounded-md border border-cyan-300/50 bg-cyan-400/[0.16] px-4 py-2 text-sm text-cyan-50 transition-colors hover:bg-cyan-400/[0.24] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? '思考中...' : '发送给教练'}
              </button>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={isSubmitting || realtime.isActive}
                  className="rounded-md border border-emerald-300/42 bg-emerald-400/[0.12] px-4 py-2 text-sm text-emerald-50 transition-colors hover:bg-emerald-400/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  录音提问
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void submitRecording()}
                    className="rounded-md border border-emerald-300/50 bg-emerald-400/[0.18] px-4 py-2 text-sm text-emerald-50"
                  >
                    提交语音 {recordingSeconds}s
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="rounded-md border border-red-400/40 px-4 py-2 text-sm text-red-200"
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
