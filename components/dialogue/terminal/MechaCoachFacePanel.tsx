'use client'

import { Html } from '@react-three/drei'
import { MECHA_EXPRESSION_SYMBOLS } from './mechaCoach.constants'
import { getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachFacePanel({
  state,
  expression,
  amplitude,
  listeningLevel,
}: MechaCoachTerminalProps) {
  const profile = getStateProfile(state)
  const displaySymbol = state === 'thinking' ? '...' : MECHA_EXPRESSION_SYMBOLS[expression]
  const signalLevel = state === 'listening' ? listeningLevel : amplitude

  return (
    <group position={[0, 0.08, 0.62]} rotation={[-0.03, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.58, 0.52, 0.06]} />
        <meshStandardMaterial
          color="#06131d"
          emissive={profile.primary}
          emissiveIntensity={0.34 + signalLevel * 0.72}
          metalness={0.84}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[1.36, 0.34]} />
        <meshBasicMaterial color="#031019" transparent opacity={0.9} />
      </mesh>
      <mesh position={[-0.72, 0, 0.05]}>
        <boxGeometry args={[0.08, 0.42, 0.04]} />
        <meshBasicMaterial color={profile.warning} transparent opacity={state === 'idle' ? 0.36 : 0.9} />
      </mesh>
      <mesh position={[0.72, 0, 0.05]}>
        <boxGeometry args={[0.08, 0.42, 0.04]} />
        <meshBasicMaterial color={profile.secondary} transparent opacity={state === 'idle' ? 0.36 : 0.9} />
      </mesh>
      <Html transform center position={[0, 0.003, 0.086]} distanceFactor={1.34}>
        <div
          className={`mecha-face-panel mecha-face-panel--${state} mecha-face-panel--${expression}`}
          style={{
            ['--mecha-face-color' as string]: profile.primary,
            ['--mecha-face-level' as string]: String(Math.max(0.12, signalLevel)),
            ['--mecha-face-glow' as string]: `${12 + Math.max(0.12, signalLevel) * 18}px`,
          }}
        >
          <span>{displaySymbol}</span>
        </div>
      </Html>
    </group>
  )
}
