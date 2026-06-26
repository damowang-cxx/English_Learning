'use client'

import { getReactiveLevel, getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

interface EyeProfile {
  leftX: number
  rightX: number
  leftY: number
  rightY: number
  leftWidth: number
  rightWidth: number
  height: number
  leftBrow: number
  rightBrow: number
}

function getEyeProfile(expression: MechaCoachTerminalProps['expression']): EyeProfile {
  switch (expression) {
    case 'encouraging':
      return {
        leftX: 116,
        rightX: 196,
        leftY: 151,
        rightY: 151,
        leftWidth: 52,
        rightWidth: 52,
        height: 10,
        leftBrow: 8,
        rightBrow: -8,
      }
    case 'confused':
      return {
        leftX: 124,
        rightX: 192,
        leftY: 157,
        rightY: 146,
        leftWidth: 40,
        rightWidth: 60,
        height: 13,
        leftBrow: 14,
        rightBrow: 10,
      }
    case 'corrective':
      return {
        leftX: 116,
        rightX: 196,
        leftY: 154,
        rightY: 154,
        leftWidth: 54,
        rightWidth: 54,
        height: 8,
        leftBrow: -12,
        rightBrow: 12,
      }
    case 'normal':
    default:
      return {
        leftX: 116,
        rightX: 196,
        leftY: 151,
        rightY: 151,
        leftWidth: 52,
        rightWidth: 52,
        height: 14,
        leftBrow: -4,
        rightBrow: 4,
      }
  }
}

function getMouthBars(props: MechaCoachTerminalProps, signalLevel: number) {
  const level = isSpeakingState(props.state) ? Math.max(0.18, signalLevel) : 0.16

  if (isSpeakingState(props.state)) {
    return [
      10 + level * 16,
      17 + level * 24,
      12 + level * 18,
      22 + level * 28,
      13 + level * 18,
      18 + level * 22,
      11 + level * 16,
    ]
  }

  if (props.expression === 'encouraging') {
    return [8, 11, 15, 18, 15, 11, 8]
  }

  if (props.expression === 'confused') {
    return [16, 8, 13, 9, 15, 8, 17]
  }

  if (props.expression === 'corrective') {
    return [7, 7, 7, 7, 7, 7, 7]
  }

  return [9, 9, 9, 9, 9, 9, 9]
}

export default function CyberCoachAvatar2D(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)
  const reactiveLevel = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
  const signalLevel = props.state === 'listening' ? props.listeningLevel : props.amplitude
  const faceColor = props.expression === 'corrective' ? profile.warning : profile.primary
  const eyeProfile = getEyeProfile(props.expression)
  const mouthBars = getMouthBars(props, signalLevel)
  const glowLevel = Math.max(0.08, reactiveLevel, props.state === 'thinking' ? 0.28 : 0)

  return (
    <div
      className={`cyber-coach-2d cyber-coach-2d--${props.state} cyber-coach-2d--${props.expression}`}
      style={{
        ['--coach2d-primary' as string]: profile.primary,
        ['--coach2d-secondary' as string]: profile.secondary,
        ['--coach2d-face' as string]: faceColor,
        ['--coach2d-level' as string]: String(glowLevel),
        ['--coach2d-signal' as string]: String(Math.max(0.12, signalLevel)),
      }}
      aria-hidden="true"
    >
      <div className="cyber-coach-2d__ambient cyber-coach-2d__ambient--outer" />
      <div className="cyber-coach-2d__ambient cyber-coach-2d__ambient--inner" />

      <svg className="cyber-coach-2d__svg" viewBox="0 0 360 360" role="img">
        <defs>
          <linearGradient id="cyberCoachShell" x1="76" y1="56" x2="286" y2="294" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3a4950" />
            <stop offset="0.44" stopColor="#18232a" />
            <stop offset="1" stopColor="#071014" />
          </linearGradient>
          <linearGradient id="cyberCoachBevel" x1="96" y1="82" x2="264" y2="258" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6e8189" />
            <stop offset="0.35" stopColor="#26343a" />
            <stop offset="1" stopColor="#0b151a" />
          </linearGradient>
          <radialGradient id="cyberCoachVisorGlow" cx="50%" cy="46%" r="70%">
            <stop offset="0" stopColor={faceColor} stopOpacity="0.22" />
            <stop offset="0.42" stopColor={faceColor} stopOpacity="0.08" />
            <stop offset="1" stopColor="#02070a" stopOpacity="0.98" />
          </radialGradient>
          <filter id="cyberCoachGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="cyberCoachVisorClip">
            <rect x="70" y="112" width="220" height="128" rx="34" />
          </clipPath>
        </defs>

        <g className="cyber-coach-2d__shadow">
          <ellipse cx="180" cy="286" rx="104" ry="18" />
        </g>

        <g className="cyber-coach-2d__waves">
          <path d="M69 147 C45 162 45 190 69 205" />
          <path d="M291 147 C315 162 315 190 291 205" />
          <path d="M56 135 C20 158 20 197 56 219" />
          <path d="M304 135 C340 158 340 197 304 219" />
        </g>

        <g className="cyber-coach-2d__head">
          <path
            className="cyber-coach-2d__shell"
            d="M82 111 C82 75 108 56 149 52 L211 52 C252 56 278 75 278 111 L302 146 L302 204 L276 252 C252 279 220 292 180 292 C140 292 108 279 84 252 L58 204 L58 146 Z"
          />
          <path
            className="cyber-coach-2d__shell-bevel"
            d="M95 118 C95 88 118 73 153 70 L207 70 C242 73 265 88 265 118 L284 150 L284 202 L264 238 C244 260 216 271 180 271 C144 271 116 260 96 238 L76 202 L76 150 Z"
          />
          <path
            className="cyber-coach-2d__lower-lip"
            d="M104 247 C128 265 154 273 180 273 C206 273 232 265 256 247"
          />
          <rect className="cyber-coach-2d__top-sensor" x="134" y="76" width="92" height="8" rx="4" />

          <g className="cyber-coach-2d__side-lights">
            <rect x="61" y="143" width="5" height="78" rx="2.5" />
            <rect x="294" y="143" width="5" height="78" rx="2.5" />
            <rect x="72" y="154" width="3" height="52" rx="1.5" />
            <rect x="285" y="154" width="3" height="52" rx="1.5" />
          </g>

          <g className="cyber-coach-2d__visor">
            <rect className="cyber-coach-2d__visor-frame" x="62" y="104" width="236" height="144" rx="42" />
            <rect className="cyber-coach-2d__visor-glass" x="70" y="112" width="220" height="128" rx="34" />
            <g clipPath="url(#cyberCoachVisorClip)">
              <g className="cyber-coach-2d__grid">
                {Array.from({ length: 11 }).map((_, index) => (
                  <line key={`h-${index}`} x1="78" y1={122 + index * 11} x2="282" y2={122 + index * 11} />
                ))}
                {Array.from({ length: 9 }).map((_, index) => (
                  <line key={`v-${index}`} x1={88 + index * 23} y1="120" x2={88 + index * 23} y2="232" />
                ))}
              </g>
              <rect className="cyber-coach-2d__scan" x="-80" y="112" width="92" height="128" />
              <path className="cyber-coach-2d__reflection" d="M88 124 C130 118 218 118 272 126" />

              <g className="cyber-coach-2d__brows">
                <rect
                  x={eyeProfile.leftX}
                  y={eyeProfile.leftY - 34}
                  width={eyeProfile.leftWidth}
                  height="5"
                  rx="2.5"
                  transform={`rotate(${eyeProfile.leftBrow} ${eyeProfile.leftX + eyeProfile.leftWidth / 2} ${eyeProfile.leftY - 31})`}
                />
                <rect
                  x={eyeProfile.rightX}
                  y={eyeProfile.rightY - 34}
                  width={eyeProfile.rightWidth}
                  height="5"
                  rx="2.5"
                  transform={`rotate(${eyeProfile.rightBrow} ${eyeProfile.rightX + eyeProfile.rightWidth / 2} ${eyeProfile.rightY - 31})`}
                />
              </g>

              <g className="cyber-coach-2d__eyes" filter="url(#cyberCoachGlow)">
                <rect
                  className="cyber-coach-2d__eye cyber-coach-2d__eye--left"
                  x={eyeProfile.leftX}
                  y={eyeProfile.leftY}
                  width={eyeProfile.leftWidth}
                  height={eyeProfile.height}
                  rx={eyeProfile.height / 2}
                />
                <rect
                  className="cyber-coach-2d__eye cyber-coach-2d__eye--right"
                  x={eyeProfile.rightX}
                  y={eyeProfile.rightY}
                  width={eyeProfile.rightWidth}
                  height={eyeProfile.height}
                  rx={eyeProfile.height / 2}
                />
              </g>

              <g className="cyber-coach-2d__listening-marks">
                <path d="M92 172 C84 178 84 188 92 194" />
                <path d="M268 172 C276 178 276 188 268 194" />
                <path d="M100 176 C95 180 95 186 100 190" />
                <path d="M260 176 C265 180 265 186 260 190" />
              </g>

              <g className="cyber-coach-2d__mouth" filter="url(#cyberCoachGlow)">
                {mouthBars.map((height, index) => {
                  const x = 144 + index * 12
                  const y = 214 - height

                  return (
                    <rect
                      key={index}
                      className="cyber-coach-2d__mouth-bar"
                      x={x}
                      y={y}
                      width="6"
                      height={height}
                      rx="3"
                      style={{ ['--bar-index' as string]: String(index) }}
                    />
                  )
                })}
              </g>
              <rect className="cyber-coach-2d__pulse" x="151" y="224" width="58" height="5" rx="2.5" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
