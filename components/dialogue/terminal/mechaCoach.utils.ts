import { MECHA_STATE_PROFILES } from './mechaCoach.constants'
import type { MechaCoachState } from './mechaCoach.types'

export function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export function getStateProfile(state: MechaCoachState) {
  return MECHA_STATE_PROFILES[state] || MECHA_STATE_PROFILES.idle
}

export function damp(current: number, target: number, smoothing: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-smoothing * delta))
}

export function isSpeakingState(state: MechaCoachState) {
  return state === 'speaking' || state === 'coach_mode'
}

export function getReactiveLevel(state: MechaCoachState, amplitude: number, listeningLevel: number) {
  return state === 'listening' ? clamp01(listeningLevel) : isSpeakingState(state) ? clamp01(amplitude) : 0
}
