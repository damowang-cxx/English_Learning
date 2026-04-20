'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode, useState } from 'react'
import { MECHA_STATUS_LABELS } from '@/components/dialogue/terminal/mechaCoach.constants'
import MechaCoachTerminalFallback from '@/components/dialogue/terminal/MechaCoachTerminalFallback'
import type {
  MechaCoachExpression,
  MechaCoachState,
  MechaCoachTerminalProps,
} from '@/components/dialogue/terminal/mechaCoach.types'
import { clamp01 } from '@/components/dialogue/terminal/mechaCoach.utils'
import { useAudioAmplitude } from '@/hooks/useAudioAmplitude'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useWebGLSupport } from '@/hooks/useWebGLSupport'

export type DialogueAvatarState = MechaCoachState
export type DialogueAvatarExpression = MechaCoachExpression

interface DialogueCoachAvatarProps {
  state: DialogueAvatarState
  expression?: DialogueAvatarExpression
  amplitude?: number
  listeningLevel?: number
}

interface TerminalErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
  onError: () => void
}

interface TerminalErrorBoundaryState {
  failed: boolean
}

class TerminalErrorBoundary extends Component<TerminalErrorBoundaryProps, TerminalErrorBoundaryState> {
  state: TerminalErrorBoundaryState = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback
    }

    return this.props.children
  }
}

const MechaCoachTerminal3D = dynamic(
  () => import('@/components/dialogue/terminal/MechaCoachTerminal3D'),
  {
    ssr: false,
    loading: () => (
      <MechaCoachTerminalFallback
        state="thinking"
        expression="normal"
        amplitude={0.2}
        listeningLevel={0}
      />
    ),
  }
)

export default function DialogueCoachAvatar({
  state,
  expression = 'normal',
  amplitude = 0,
  listeningLevel = 0,
}: DialogueCoachAvatarProps) {
  const reducedMotion = useReducedMotion()
  const webglSupported = useWebGLSupport()
  const [renderFailed, setRenderFailed] = useState(false)
  const smoothedAmplitude = useAudioAmplitude(clamp01(amplitude), 0.2)
  const smoothedListeningLevel = useAudioAmplitude(clamp01(listeningLevel), 0.24)

  const terminalProps: MechaCoachTerminalProps = {
    state,
    expression,
    amplitude: smoothedAmplitude,
    listeningLevel: smoothedListeningLevel,
  }
  const shouldFallback = reducedMotion || renderFailed || webglSupported !== true
  const fallback = <MechaCoachTerminalFallback {...terminalProps} />

  return (
    <div
      className={`dialogue-avatar dialogue-avatar--mecha dialogue-avatar--${state} dialogue-avatar--${expression}`}
      aria-label="Cyber AI dialogue coach terminal"
    >
      {shouldFallback ? (
        fallback
      ) : (
        <TerminalErrorBoundary fallback={fallback} onError={() => setRenderFailed(true)}>
          <MechaCoachTerminal3D {...terminalProps} />
        </TerminalErrorBoundary>
      )}
      <div className="dialogue-avatar__status dialogue-avatar__status--mecha">
        {MECHA_STATUS_LABELS[state]}
      </div>
    </div>
  )
}
