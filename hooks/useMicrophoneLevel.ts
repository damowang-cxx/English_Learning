'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type BrowserAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

export function useMicrophoneLevel() {
  const [level, setLevel] = useState(0)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const frameRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    sourceRef.current?.disconnect()
    analyserRef.current?.disconnect()
    sourceRef.current = null
    analyserRef.current = null

    const context = contextRef.current
    contextRef.current = null

    if (context && context.state !== 'closed') {
      context.close().catch(() => undefined)
    }

    setLevel(0)
  }, [])

  const start = useCallback(async (stream: MediaStream) => {
    stop()

    const AudioContextClass = window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext
    if (!AudioContextClass) {
      setLevel(0)
      return
    }

    const context = new AudioContextClass()
    const analyser = context.createAnalyser()
    const source = context.createMediaStreamSource(stream)
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.74

    source.connect(analyser)

    contextRef.current = context
    analyserRef.current = analyser
    sourceRef.current = source

    const data = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let index = 0; index < data.length; index += 1) {
        const sample = (data[index] - 128) / 128
        sum += sample * sample
      }

      const rms = Math.sqrt(sum / Math.max(data.length, 1))
      setLevel(Math.min(1, Math.max(0, (rms - 0.018) * 4.6)))
      frameRef.current = window.requestAnimationFrame(tick)
    }

    tick()
  }, [stop])

  useEffect(() => stop, [stop])

  return { level, start, stop }
}
