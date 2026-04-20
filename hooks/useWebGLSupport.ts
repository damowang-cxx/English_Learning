'use client'

import { useEffect, useState } from 'react'

export function useWebGLSupport() {
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setSupported(false)
      return
    }

    let canvas: HTMLCanvasElement | null = null

    try {
      canvas = document.createElement('canvas')
      const context =
        canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })

      setSupported(Boolean(context))

      if (context && 'getExtension' in context) {
        const loseContext = context.getExtension('WEBGL_lose_context')
        loseContext?.loseContext()
      }
    } catch {
      setSupported(false)
    } finally {
      canvas = null
    }
  }, [])

  return supported
}
