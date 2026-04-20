export type MechaCoachState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'coach_mode'
export type MechaCoachExpression = 'normal' | 'encouraging' | 'confused' | 'corrective'

export interface MechaCoachTerminalProps {
  state: MechaCoachState
  expression: MechaCoachExpression
  amplitude: number
  listeningLevel: number
}

export interface MechaCoachStateProfile {
  armorOpen: number
  ringSpeed: number
  particleSpeed: number
  noiseStrength: number
  thrusterStrength: number
  glowStrength: number
  coreScale: number
  primary: string
  secondary: string
  warning: string
}
