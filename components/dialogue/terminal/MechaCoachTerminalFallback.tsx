'use client'

import { getReactiveLevel, getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function getMouthBars(props: MechaCoachTerminalProps, signalLevel: number) {
  const mouthLevel = isSpeakingState(props.state) ? Math.max(0.18, signalLevel) : 0.16

  if (isSpeakingState(props.state)) {
    return [
      0.34 + mouthLevel * 0.54,
      0.52 + mouthLevel * 0.68,
      0.38 + mouthLevel * 0.46,
      0.68 + mouthLevel * 0.72,
      0.4 + mouthLevel * 0.48,
      0.58 + mouthLevel * 0.62,
      0.36 + mouthLevel * 0.5,
    ]
  }

  if (props.expression === 'encouraging') {
    return [0.18, 0.24, 0.3, 0.34, 0.3, 0.24, 0.18]
  }

  if (props.expression === 'confused') {
    return [0.32, 0.18, 0.28, 0.2, 0.3, 0.18, 0.34]
  }

  if (props.expression === 'corrective') {
    return [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18]
  }

  return [0.24, 0.24, 0.24, 0.24, 0.24, 0.24, 0.24]
}

export default function MechaCoachTerminalFallback(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)
  const reactiveLevel = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
  const signalLevel = props.state === 'listening' ? props.listeningLevel : props.amplitude
  const faceColor = props.expression === 'corrective' ? profile.warning : profile.primary
  const mouthBars = getMouthBars(props, signalLevel)

  return (
    <div
      className={`coach-device-fallback coach-device-fallback--${props.state} coach-device-fallback--${props.expression}`}
      style={{
        ['--device-primary' as string]: profile.primary,
        ['--device-secondary' as string]: profile.secondary,
        ['--device-warning' as string]: profile.warning,
        ['--device-level' as string]: String(Math.max(0.08, reactiveLevel)),
        ['--device-face-color' as string]: faceColor,
        ['--device-face-secondary' as string]: profile.secondary,
        ['--device-face-level' as string]: String(Math.max(0.12, signalLevel)),
        ['--device-face-glow' as string]: `${14 + Math.max(0.12, signalLevel) * 18}px`,
        ['--device-core-glow' as string]: `${18 + reactiveLevel * 34}px`,
        ['--device-ear-glow' as string]: String(props.state === 'listening' ? 0.38 + reactiveLevel * 0.5 : 0.2 + reactiveLevel * 0.32),
        ['--device-wave-opacity' as string]: String(0.18 + reactiveLevel * 0.38),
      }}
      aria-hidden="true"
    >
      <div className="coach-device-fallback__grid" />
      <div className="coach-device-fallback__halo coach-device-fallback__halo--outer" />
      <div className="coach-device-fallback__halo coach-device-fallback__halo--inner" />
      <div className="coach-device-fallback__wave coach-device-fallback__wave--one" />
      <div className="coach-device-fallback__wave coach-device-fallback__wave--two" />

      <div className="coach-device-fallback__shell">
        <div className="coach-device-fallback__audio coach-device-fallback__audio--left">
          <span />
          <span />
          <span />
        </div>
        <div className="coach-device-fallback__audio coach-device-fallback__audio--right">
          <span />
          <span />
          <span />
        </div>

        <div className="coach-device-fallback__body">
          <div className="coach-device-fallback__sensor" />
          <div className={`coach-device-face coach-device-face--${props.state} coach-device-face--${props.expression}`}>
            <span className="coach-device-face__scan" />
            <span className="coach-device-face__brow coach-device-face__brow--left" />
            <span className="coach-device-face__brow coach-device-face__brow--right" />
            <span className="coach-device-face__eye coach-device-face__eye--left" />
            <span className="coach-device-face__eye coach-device-face__eye--right" />
            <span className="coach-device-face__mouth" aria-hidden="true">
              {mouthBars.map((height, index) => (
                <span
                  key={index}
                  style={{ ['--device-mouth-height' as string]: `${height}rem` }}
                />
              ))}
            </span>
            <span className="coach-device-face__pulse" />
          </div>
        </div>

        <div className="coach-device-fallback__neck" />
        <div className="coach-device-fallback__core" />
      </div>
      <div className="coach-device-fallback__shadow" />
    </div>
  )
}
