'use client'

import { useEffect, useRef, useState } from 'react'

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export function useAudioAmplitude(value = 0, smoothing = 0.18) {
  const initialValue = clamp01(value)
  const targetRef = useRef(initialValue)
  const frameRef = useRef<number | null>(null)
  const [smoothed, setSmoothed] = useState(initialValue)

  useEffect(() => {
    targetRef.current = clamp01(value)
  }, [value])

  useEffect(() => {
    const tick = () => {
      setSmoothed((current) => current + (targetRef.current - current) * smoothing)
      frameRef.current = window.requestAnimationFrame(tick)
    }

    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [smoothing])

  return smoothed
}
