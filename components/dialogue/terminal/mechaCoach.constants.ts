import type { MechaCoachExpression, MechaCoachState, MechaCoachStateProfile } from './mechaCoach.types'

export const MECHA_COACH_COLORS = {
  void: '#04090d',
  metal: '#26343d',
  metalEdge: '#6f858f',
  cyan: '#86edf2',
  cyanHot: '#26e8d1',
  white: '#f5fbff',
  violet: '#a8c7ff',
  magenta: '#9debdc',
  emerald: '#82f7cd',
  amber: '#f4c96f',
  red: '#ff9f7a',
} as const

export const MECHA_STATE_PROFILES: Record<MechaCoachState, MechaCoachStateProfile> = {
  idle: {
    armorOpen: 0.2,
    ringSpeed: 0.08,
    particleSpeed: 0.08,
    noiseStrength: 0.02,
    thrusterStrength: 0.01,
    glowStrength: 0.42,
    coreScale: 0.98,
    primary: MECHA_COACH_COLORS.cyan,
    secondary: MECHA_COACH_COLORS.metalEdge,
    warning: MECHA_COACH_COLORS.amber,
  },
  listening: {
    armorOpen: 0.58,
    ringSpeed: 0.18,
    particleSpeed: 0.22,
    noiseStrength: 0.12,
    thrusterStrength: 0.04,
    glowStrength: 0.76,
    coreScale: 1.03,
    primary: MECHA_COACH_COLORS.emerald,
    secondary: MECHA_COACH_COLORS.cyanHot,
    warning: MECHA_COACH_COLORS.amber,
  },
  thinking: {
    armorOpen: 0.5,
    ringSpeed: 0.24,
    particleSpeed: 0.24,
    noiseStrength: 0.08,
    thrusterStrength: 0.04,
    glowStrength: 0.7,
    coreScale: 1.04,
    primary: MECHA_COACH_COLORS.violet,
    secondary: MECHA_COACH_COLORS.cyan,
    warning: MECHA_COACH_COLORS.amber,
  },
  speaking: {
    armorOpen: 0.72,
    ringSpeed: 0.36,
    particleSpeed: 0.36,
    noiseStrength: 0.06,
    thrusterStrength: 0.1,
    glowStrength: 0.86,
    coreScale: 1.1,
    primary: MECHA_COACH_COLORS.cyanHot,
    secondary: MECHA_COACH_COLORS.emerald,
    warning: MECHA_COACH_COLORS.amber,
  },
  coach_mode: {
    armorOpen: 0.68,
    ringSpeed: 0.26,
    particleSpeed: 0.3,
    noiseStrength: 0.05,
    thrusterStrength: 0.08,
    glowStrength: 0.84,
    coreScale: 1.06,
    primary: MECHA_COACH_COLORS.emerald,
    secondary: MECHA_COACH_COLORS.emerald,
    warning: MECHA_COACH_COLORS.amber,
  },
}

export const MECHA_EXPRESSION_SYMBOLS: Record<MechaCoachExpression, string> = {
  normal: '..',
  encouraging: '^ ^',
  confused: '? ?',
  corrective: '> <',
}

export const MECHA_STATUS_LABELS: Record<MechaCoachState, string> = {
  idle: 'READY',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
  coach_mode: 'COACH MODE',
}

export const MECHA_PARTICLE_COUNTS = {
  orbit: 62,
  stars: 86,
  noise: 90,
} as const
