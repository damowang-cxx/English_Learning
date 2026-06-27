'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/lib/base-path'

export type RealtimeVoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface RealtimeCommittedTurn {
  conversationSessionId: string
  turnId: string
  userTranscript: string
  assistantTranscript: string
}

export interface UseRealtimeVoiceAdapterOptions {
  conversationSessionId: string | null
  disabled?: boolean
  onConversationSessionId?: (sessionId: string) => void
  onTurnCommitted?: (turn: RealtimeCommittedTurn) => void
  onStatusMessage?: (message: string | null) => void
}

interface RealtimeTokenPayload {
  conversationSessionId?: string
  ephemeralKey?: string
  model?: string
  voice?: string
  expiresAt?: number
  realtimeSessionId?: string | null
  error?: string
}

type RealtimeServerEvent = Record<string, unknown> & {
  type?: string
  event_id?: string
}

interface RealtimeTurnDraft {
  id: string
  startedAt: string
  endedAt: string | null
  userTranscript: string
  assistantTranscript: string
  responseDone: boolean
  commitStarted: boolean
  committed: boolean
  metadata: Record<string, unknown>
}

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

function isRealtimeActiveStatus(status: RealtimeVoiceStatus) {
  return status === 'connecting' || status === 'connected' || status === 'listening' || status === 'speaking'
}

function createTurnDraft(): RealtimeTurnDraft {
  return {
    id: `rt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    userTranscript: '',
    assistantTranscript: '',
    responseDone: false,
    commitStarted: false,
    committed: false,
    metadata: {},
  }
}

function appendDelta(current: string, delta: unknown) {
  const next = typeof delta === 'string' ? delta : ''
  return `${current}${next}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function extractAssistantTranscriptFromResponseDone(event: RealtimeServerEvent) {
  const response = asRecord(event.response)
  const output = Array.isArray(response?.output) ? response.output : []

  for (const outputItem of output) {
    const item = asRecord(outputItem)
    const content = Array.isArray(item?.content) ? item.content : []

    for (const contentItem of content) {
      const part = asRecord(contentItem)
      if (typeof part?.transcript === 'string' && part.transcript.trim()) {
        return part.transcript.trim()
      }
    }
  }

  return ''
}

function buildErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function buildRealtimeStartErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return '实时语音连接失败。'
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '浏览器没有麦克风权限。请在地址栏权限设置中允许麦克风，然后重新开始实时交流。'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '没有检测到可用麦克风。请连接麦克风后再试。'
    case 'NotReadableError':
    case 'TrackStartError':
      return '麦克风当前被其他应用占用，关闭占用麦克风的软件后再试。'
    case 'OverconstrainedError':
      return '当前麦克风不满足浏览器音频约束，请换一个输入设备后再试。'
    default:
      return error.message || '实时语音连接失败。'
  }
}

export function useRealtimeVoiceAdapter({
  conversationSessionId,
  disabled = false,
  onConversationSessionId,
  onTurnCommitted,
  onStatusMessage,
}: UseRealtimeVoiceAdapterOptions) {
  const [status, setStatus] = useState<RealtimeVoiceStatus>('idle')
  const [liveUserTranscript, setLiveUserTranscript] = useState('')
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('')
  const [model, setModel] = useState<string | null>(null)
  const [voice, setVoice] = useState<string | null>(null)
  const [lastSavedTurnId, setLastSavedTurnId] = useState<string | null>(null)
  const [lastSaveError, setLastSaveError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const conversationSessionIdRef = useRef<string | null>(conversationSessionId)
  const currentDraftRef = useRef<RealtimeTurnDraft>(createTurnDraft())
  const callbacksRef = useRef({
    onConversationSessionId,
    onTurnCommitted,
    onStatusMessage,
  })

  useEffect(() => {
    conversationSessionIdRef.current = conversationSessionId
  }, [conversationSessionId])

  useEffect(() => {
    callbacksRef.current = {
      onConversationSessionId,
      onTurnCommitted,
      onStatusMessage,
    }
  }, [onConversationSessionId, onTurnCommitted, onStatusMessage])

  const cleanupConnection = useCallback(() => {
    dataChannelRef.current?.close()
    dataChannelRef.current = null

    peerConnectionRef.current?.getSenders().forEach((sender) => {
      sender.track?.stop()
    })
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause()
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current.remove()
      remoteAudioRef.current = null
    }
  }, [])

  const commitCurrentTurn = useCallback(async (draft: RealtimeTurnDraft) => {
    const activeSessionId = conversationSessionIdRef.current

    if (!activeSessionId || draft.commitStarted || draft.committed) {
      return
    }

    const userTranscript = draft.userTranscript.trim()
    const assistantTranscript = draft.assistantTranscript.trim()

    if (!userTranscript || !assistantTranscript || !draft.responseDone) {
      return
    }

    draft.commitStarted = true

    try {
      const response = await fetch(withBasePath('/api/dialogue/realtime/turns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationSessionId: activeSessionId,
          userTranscript,
          assistantTranscript,
          startedAt: draft.startedAt,
          endedAt: draft.endedAt || new Date().toISOString(),
          realtimeMetadata: draft.metadata,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || `实时对话保存失败：${response.status}`)
      }

      draft.committed = true
      setLastSaveError(null)
      setLastSavedTurnId(payload.turnId || null)
      callbacksRef.current.onStatusMessage?.(null)
      callbacksRef.current.onTurnCommitted?.({
        conversationSessionId: payload.conversationSessionId || activeSessionId,
        turnId: payload.turnId,
        userTranscript,
        assistantTranscript,
      })
      if (currentDraftRef.current === draft) {
        currentDraftRef.current = createTurnDraft()
      }
    } catch (error) {
      const message = buildErrorMessage(error, '实时对话保存失败。')
      draft.commitStarted = false
      setLastSaveError(message)
      setErrorMessage(message)
      setStatus((current) => (isRealtimeActiveStatus(current) ? current : 'connected'))
      callbacksRef.current.onStatusMessage?.(`本轮对话已完成，但记录保存失败：${message}。实时连接仍可继续。`)
    }
  }, [])

  const maybeCommitCurrentTurn = useCallback(() => {
    void commitCurrentTurn(currentDraftRef.current)
  }, [commitCurrentTurn])

  const resetDraftForUserSpeech = useCallback(() => {
    const draft = currentDraftRef.current

    if (!draft.committed && !draft.commitStarted && (draft.userTranscript || draft.assistantTranscript)) {
      callbacksRef.current.onStatusMessage?.(
        draft.responseDone ? '上一轮实时对话未能保存，已继续下一轮。' : '上一轮实时字幕不完整，已跳过保存。'
      )
    }

    currentDraftRef.current = createTurnDraft()
    setLiveUserTranscript('')
    setLiveAssistantTranscript('')
  }, [])

  const handleRealtimeEvent = useCallback(
    (event: RealtimeServerEvent) => {
      const draft = currentDraftRef.current

      switch (event.type) {
        case 'input_audio_buffer.speech_started': {
          resetDraftForUserSpeech()
          const nextDraft = currentDraftRef.current
          nextDraft.metadata = {
            ...nextDraft.metadata,
            userItemId: typeof event.item_id === 'string' ? event.item_id : undefined,
            speechStartedEventId: event.event_id,
          }
          setStatus('listening')
          setErrorMessage(null)
          callbacksRef.current.onStatusMessage?.('正在听你说...')
          break
        }

        case 'input_audio_buffer.speech_stopped': {
          draft.metadata = {
            ...draft.metadata,
            speechStoppedEventId: event.event_id,
          }
          setStatus('connected')
          callbacksRef.current.onStatusMessage?.('收到语音，正在生成回应...')
          break
        }

        case 'conversation.item.input_audio_transcription.delta': {
          draft.userTranscript = appendDelta(draft.userTranscript, event.delta)
          setLiveUserTranscript(draft.userTranscript.trim())
          break
        }

        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
          if (transcript) {
            draft.userTranscript = transcript
            setLiveUserTranscript(transcript)
          }
          draft.metadata = {
            ...draft.metadata,
            inputTranscriptionEventId: event.event_id,
            inputItemId: typeof event.item_id === 'string' ? event.item_id : draft.metadata.inputItemId,
          }
          maybeCommitCurrentTurn()
          break
        }

        case 'conversation.item.input_audio_transcription.failed': {
          callbacksRef.current.onStatusMessage?.('本轮用户语音没有可用字幕，完成后不会写入记录。')
          break
        }

        case 'response.created': {
          setStatus('speaking')
          draft.metadata = {
            ...draft.metadata,
            responseCreatedEventId: event.event_id,
          }
          break
        }

        case 'response.output_audio_transcript.delta': {
          draft.assistantTranscript = appendDelta(draft.assistantTranscript, event.delta)
          setLiveAssistantTranscript(draft.assistantTranscript.trim())
          setStatus('speaking')
          break
        }

        case 'response.output_audio_transcript.done': {
          const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
          if (transcript) {
            draft.assistantTranscript = transcript
            setLiveAssistantTranscript(transcript)
          }
          draft.metadata = {
            ...draft.metadata,
            assistantTranscriptDoneEventId: event.event_id,
          }
          maybeCommitCurrentTurn()
          break
        }

        case 'response.done': {
          const transcript = extractAssistantTranscriptFromResponseDone(event)
          if (transcript && !draft.assistantTranscript.trim()) {
            draft.assistantTranscript = transcript
            setLiveAssistantTranscript(transcript)
          }
          draft.responseDone = true
          draft.endedAt = new Date().toISOString()
          draft.metadata = {
            ...draft.metadata,
            responseDoneEventId: event.event_id,
            response: event.response,
          }
          setStatus('connected')
          callbacksRef.current.onStatusMessage?.(null)
          maybeCommitCurrentTurn()
          break
        }

        case 'error': {
          const message =
            typeof asRecord(event.error)?.message === 'string'
              ? String(asRecord(event.error)?.message)
              : 'Realtime 连接返回错误。'
          setStatus('error')
          setErrorMessage(message)
          callbacksRef.current.onStatusMessage?.(message)
          break
        }

        default:
          break
      }
    },
    [maybeCommitCurrentTurn, resetDraftForUserSpeech]
  )

  const start = useCallback(async () => {
    if (disabled || isRealtimeActiveStatus(status)) {
      return
    }

    if (
      typeof window === 'undefined' ||
      typeof RTCPeerConnection === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      const message = '当前浏览器不支持实时语音连接，请先使用文字或录音转写模式。'
      setStatus('error')
      setErrorMessage(message)
      callbacksRef.current.onStatusMessage?.(message)
      return
    }

    setStatus('connecting')
    setErrorMessage(null)
    setLastSaveError(null)
    setLiveUserTranscript('')
    setLiveAssistantTranscript('')
    callbacksRef.current.onStatusMessage?.('正在请求麦克风权限...')
    cleanupConnection()
    currentDraftRef.current = createTurnDraft()

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = mediaStream
      callbacksRef.current.onStatusMessage?.('正在连接实时语音教练...')

      const tokenResponse = await fetch(withBasePath('/api/dialogue/realtime/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationSessionId: conversationSessionIdRef.current,
        }),
      })
      const tokenPayload = (await tokenResponse.json()) as RealtimeTokenPayload

      if (!tokenResponse.ok || !tokenPayload.ephemeralKey || !tokenPayload.conversationSessionId) {
        throw new Error(tokenPayload.error || `实时语音会话创建失败：${tokenResponse.status}`)
      }

      conversationSessionIdRef.current = tokenPayload.conversationSessionId
      callbacksRef.current.onConversationSessionId?.(tokenPayload.conversationSessionId)
      setModel(tokenPayload.model || null)
      setVoice(tokenPayload.voice || null)

      const peerConnection = new RTCPeerConnection()
      peerConnectionRef.current = peerConnection

      const remoteAudio = document.createElement('audio')
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudioRef.current = remoteAudio
      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0]
      }

      mediaStream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, mediaStream)
      })

      const dataChannel = peerConnection.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel
      dataChannel.addEventListener('open', () => {
        setStatus('connected')
        callbacksRef.current.onStatusMessage?.('实时语音已连接，可以直接开口。')
      })
      dataChannel.addEventListener('message', (messageEvent) => {
        try {
          handleRealtimeEvent(JSON.parse(messageEvent.data) as RealtimeServerEvent)
        } catch {
          callbacksRef.current.onStatusMessage?.('收到无法解析的实时事件。')
        }
      })
      dataChannel.addEventListener('error', () => {
        const message = 'Realtime data channel 发生错误。'
        setStatus('error')
        setErrorMessage(message)
        callbacksRef.current.onStatusMessage?.(message)
      })
      dataChannel.addEventListener('close', () => {
        setStatus((current) => (current === 'error' ? current : 'disconnected'))
      })

      peerConnection.addEventListener('connectionstatechange', () => {
        if (peerConnection.connectionState === 'connected') {
          setStatus((current) => (current === 'listening' || current === 'speaking' ? current : 'connected'))
        }

        if (peerConnection.connectionState === 'failed') {
          const message = '实时语音连接失败。'
          setStatus('error')
          setErrorMessage(message)
          callbacksRef.current.onStatusMessage?.(message)
        }

        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'closed') {
          setStatus((current) => (current === 'error' ? current : 'disconnected'))
        }
      })

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      if (!offer.sdp) {
        throw new Error('浏览器没有生成可用的 WebRTC offer。')
      }

      const sdpResponse = await fetch(REALTIME_CALLS_URL, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenPayload.ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      })

      if (!sdpResponse.ok) {
        throw new Error((await sdpResponse.text()) || `Realtime SDP 交换失败：${sdpResponse.status}`)
      }

      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      })
    } catch (error) {
      const message = buildRealtimeStartErrorMessage(error)
      cleanupConnection()
      setStatus('error')
      setErrorMessage(message)
      callbacksRef.current.onStatusMessage?.(message)
    }
  }, [cleanupConnection, disabled, handleRealtimeEvent, status])

  const stop = useCallback(() => {
    const draft = currentDraftRef.current

    if (!draft.committed && !draft.commitStarted && (draft.userTranscript || draft.assistantTranscript)) {
      callbacksRef.current.onStatusMessage?.('实时语音已结束，本轮未完成的字幕不会写入记录。')
    } else {
      callbacksRef.current.onStatusMessage?.('实时语音已结束。')
    }

    cleanupConnection()
    if (!draft.commitStarted) {
      currentDraftRef.current = createTurnDraft()
    }
    setLiveUserTranscript('')
    setLiveAssistantTranscript('')
    setStatus('disconnected')
  }, [cleanupConnection])

  useEffect(() => {
    return () => {
      cleanupConnection()
    }
  }, [cleanupConnection])

  const isActive = isRealtimeActiveStatus(status)

  return {
    status,
    isActive,
    liveUserTranscript,
    liveAssistantTranscript,
    model,
    voice,
    lastSavedTurnId,
    lastSaveError,
    errorMessage,
    start,
    stop,
  }
}
