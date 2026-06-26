'use client'

import CyberCoachAvatar2D from '@/components/dialogue/terminal/CyberCoachAvatar2D'
import { MECHA_STATUS_LABELS } from '@/components/dialogue/terminal/mechaCoach.constants'
import type {
  MechaCoachExpression,
  MechaCoachState,
  MechaCoachTerminalProps,
} from '@/components/dialogue/terminal/mechaCoach.types'
import { clamp01 } from '@/components/dialogue/terminal/mechaCoach.utils'
import { useAudioAmplitude } from '@/hooks/useAudioAmplitude'

export type DialogueAvatarState = MechaCoachState
export type DialogueAvatarExpression = MechaCoachExpression

interface DialogueCoachAvatarProps {
  state: DialogueAvatarState
  expression?: DialogueAvatarExpression
  amplitude?: number
  listeningLevel?: number
}

export default function DialogueCoachAvatar({
  state,
  expression = 'normal',
  amplitude = 0,
  listeningLevel = 0,
}: DialogueCoachAvatarProps) {
  const smoothedAmplitude = useAudioAmplitude(clamp01(amplitude), 0.2)
  const smoothedListeningLevel = useAudioAmplitude(clamp01(listeningLevel), 0.24)

  const terminalProps: MechaCoachTerminalProps = {
    state,
    expression,
    amplitude: smoothedAmplitude,
    listeningLevel: smoothedListeningLevel,
  }

  return (
    <div
      className={`dialogue-avatar dialogue-avatar--mecha dialogue-avatar--2d dialogue-avatar--${state} dialogue-avatar--${expression}`}
      aria-label="Cyber AI dialogue coach"
    >
      <CyberCoachAvatar2D {...terminalProps} />
      <div className="dialogue-avatar__status dialogue-avatar__status--mecha">
        {MECHA_STATUS_LABELS[state]}
      </div>
    </div>
  )
}
