'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { BufferAttribute, PointsMaterial } from 'three'
import { MECHA_PARTICLE_COUNTS } from './mechaCoach.constants'
import { getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function createNoisePositions(count: number) {
  const positions = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    positions[index * 3] = Math.cos(angle) * 1.1
    positions[index * 3 + 1] = Math.sin(angle * 1.7) * 0.52
    positions[index * 3 + 2] = Math.sin(angle) * 0.2 + 0.18
  }

  return positions
}

export default function MechaCoachNoiseField({ state, listeningLevel }: MechaCoachTerminalProps) {
  const positions = useMemo(() => createNoisePositions(MECHA_PARTICLE_COUNTS.noise), [])
  const basePositions = useMemo(() => new Float32Array(positions), [positions])
  const attributeRef = useRef<BufferAttribute>(null)
  const materialRef = useRef<PointsMaterial>(null)

  useFrame(({ clock }) => {
    const attribute = attributeRef.current
    const material = materialRef.current
    const activeLevel = state === 'listening' ? Math.max(0.12, listeningLevel) : 0
    const profile = getStateProfile(state)

    if (attribute) {
      for (let index = 0; index < MECHA_PARTICLE_COUNTS.noise; index += 1) {
        const offset = index * 3
        const wave = Math.sin(clock.elapsedTime * 10 + index * 1.7)
        const jitter = wave * activeLevel * 0.12
        attribute.array[offset] = basePositions[offset] + jitter
        attribute.array[offset + 1] = basePositions[offset + 1] + Math.cos(clock.elapsedTime * 12 + index) * activeLevel * 0.08
        attribute.array[offset + 2] = basePositions[offset + 2] + jitter * 0.4
      }
      attribute.needsUpdate = true
    }

    if (material) {
      material.color.set(profile.primary)
      material.opacity = state === 'listening' ? 0.2 + activeLevel * 0.54 : 0.03
      material.size = 0.02 + activeLevel * 0.024
    }
  })

  return (
    <points position={[0, 0, 0.58]}>
      <bufferGeometry>
        <bufferAttribute ref={attributeRef} attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={materialRef} color={getStateProfile(state).primary} transparent opacity={0.03} size={0.02} sizeAttenuation depthWrite={false} />
    </points>
  )
}
