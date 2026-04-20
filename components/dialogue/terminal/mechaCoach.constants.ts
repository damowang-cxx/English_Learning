import type { MechaCoachExpression, MechaCoachState, MechaCoachStateProfile } from './mechaCoach.types'

export const MECHA_COACH_COLORS = {
  void: '#020617',
  metal: '#06111c',
  metalEdge: '#13283a',
  cyan: '#67e8f9',
  cyanHot: '#00e5ff',
  white: '#e6fbff',
  violet: '#8b5cf6',
  magenta: '#ff2bd6',
  emerald: '#6ee7b7',
  amber: '#ff9d00',
  red: '#ff3d00',
} as const

export const MECHA_STATE_PROFILES: Record<MechaCoachState, MechaCoachStateProfile> = {
  idle: {
    armorOpen: 0.16,
    ringSpeed: 0.14,
    particleSpeed: 0.16,
    noiseStrength: 0.08,
    thrusterStrength: 0.04,
    glowStrength: 0.62,
    coreScale: 0.98,
    primary: MECHA_COACH_COLORS.cyan,
    secondary: MECHA_COACH_COLORS.violet,
    warning: MECHA_COACH_COLORS.amber,
  },
  listening: {
    armorOpen: 0.72,
    ringSpeed: 0.1,
    particleSpeed: 0.34,
    noiseStrength: 0.9,
    thrusterStrength: 0.12,
    glowStrength: 0.9,
    coreScale: 1.04,
    primary: MECHA_COACH_COLORS.emerald,
    secondary: MECHA_COACH_COLORS.cyanHot,
    warning: MECHA_COACH_COLORS.amber,
  },
  thinking: {
    armorOpen: 0.62,
    ringSpeed: 0.56,
    particleSpeed: 0.58,
    noiseStrength: 0.46,
    thrusterStrength: 0.46,
    glowStrength: 1.08,
    coreScale: 1.1,
    primary: MECHA_COACH_COLORS.violet,
    secondary: MECHA_COACH_COLORS.magenta,
    warning: MECHA_COACH_COLORS.red,
  },
  speaking: {
    armorOpen: 0.96,
    ringSpeed: 0.72,
    particleSpeed: 0.62,
    noiseStrength: 0.16,
    thrusterStrength: 0.72,
    glowStrength: 1.22,
    coreScale: 1.14,
    primary: MECHA_COACH_COLORS.cyanHot,
    secondary: MECHA_COACH_COLORS.magenta,
    warning: MECHA_COACH_COLORS.red,
  },
  coach_mode: {
    armorOpen: 0.84,
    ringSpeed: 0.42,
    particleSpeed: 0.42,
    noiseStrength: 0.12,
    thrusterStrength: 0.52,
    glowStrength: 1.04,
    coreScale: 1.08,
    primary: MECHA_COACH_COLORS.cyan,
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
  orbit: 220,
  stars: 320,
  noise: 140,
} as const
