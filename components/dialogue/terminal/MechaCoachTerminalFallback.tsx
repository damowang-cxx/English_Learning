'use client'

import { MECHA_EXPRESSION_SYMBOLS } from './mechaCoach.constants'
import { getReactiveLevel, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachTerminalFallback(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)
  const reactiveLevel = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
  const symbol = props.state === 'thinking' ? '...' : MECHA_EXPRESSION_SYMBOLS[props.expression]
  const wingOpen = profile.armorOpen + reactiveLevel * 0.3

  return (
    <div
      className={`mecha-drone-fallback mecha-drone-fallback--${props.state} mecha-drone-fallback--${props.expression}`}
      style={{
        ['--mecha-primary' as string]: profile.primary,
        ['--mecha-secondary' as string]: profile.secondary,
        ['--mecha-warning' as string]: profile.warning,
        ['--mecha-level' as string]: String(Math.max(0.08, reactiveLevel)),
        ['--mecha-wing-open' as string]: `${wingOpen * 2.1}rem`,
        ['--mecha-wing-tilt' as string]: `${wingOpen * 16}deg`,
        ['--mecha-wing-tilt-negative' as string]: `${wingOpen * -16}deg`,
        ['--mecha-core-glow' as string]: `${24 + reactiveLevel * 26}px`,
        ['--mecha-noise-opacity' as string]: String(props.state === 'listening' ? 0.28 + reactiveLevel * 0.62 : 0.04),
        ['--mecha-wave-opacity' as string]: String(0.34 + reactiveLevel * 0.36),
        ['--mecha-thruster-height' as string]: `${1.2 + profile.thrusterStrength * 2.8 + reactiveLevel * 2}rem`,
        ['--mecha-thruster-opacity' as string]: String(Math.min(0.92, 0.18 + profile.thrusterStrength + reactiveLevel * 0.44)),
      }}
      aria-hidden="true"
    >
      <div className="mecha-drone-fallback__grid" />
      <div className="mecha-drone-fallback__scan" />
      <div className="mecha-drone-fallback__wing mecha-drone-fallback__wing--left">
        <div className="mecha-drone-fallback__arm" />
        <div className="mecha-drone-fallback__blade" />
        <div className="mecha-drone-fallback__rotor" />
      </div>
      <div className="mecha-drone-fallback__wing mecha-drone-fallback__wing--right">
        <div className="mecha-drone-fallback__arm" />
        <div className="mecha-drone-fallback__blade" />
        <div className="mecha-drone-fallback__rotor" />
      </div>
      <div className="mecha-drone-fallback__antenna mecha-drone-fallback__antenna--left" />
      <div className="mecha-drone-fallback__antenna mecha-drone-fallback__antenna--right" />
      <div className="mecha-drone-fallback__body">
        <div className="mecha-drone-fallback__visor">
          <span>{symbol}</span>
        </div>
        <div className="mecha-drone-fallback__core" />
        <div className="mecha-drone-fallback__alert mecha-drone-fallback__alert--left" />
        <div className="mecha-drone-fallback__alert mecha-drone-fallback__alert--right" />
      </div>
      <div className="mecha-drone-fallback__wave mecha-drone-fallback__wave--one" />
      <div className="mecha-drone-fallback__wave mecha-drone-fallback__wave--two" />
      <div className="mecha-drone-fallback__noise" />
      <div className="mecha-drone-fallback__thruster mecha-drone-fallback__thruster--left" />
      <div className="mecha-drone-fallback__thruster mecha-drone-fallback__thruster--center" />
      <div className="mecha-drone-fallback__thruster mecha-drone-fallback__thruster--right" />
    </div>
  )
}
