'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, PointsMaterial } from 'three'
import { MECHA_PARTICLE_COUNTS } from './mechaCoach.constants'
import { getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function createOrbitPositions(count: number) {
  const positions = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    const radius = 1.2 + Math.sin(index * 3.13) * 0.16
    positions[index * 3] = Math.cos(angle) * radius
    positions[index * 3 + 1] = Math.sin(angle * 2.4) * 0.26
    positions[index * 3 + 2] = Math.sin(angle) * radius
  }

  return positions
}

function createStarPositions(count: number) {
  const positions = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const distance = 2.0 + Math.random() * 2.4
    positions[index * 3] = Math.cos(angle) * distance
    positions[index * 3 + 1] = (Math.random() - 0.5) * 2.8
    positions[index * 3 + 2] = Math.sin(angle) * distance - 0.8
  }

  return positions
}

export function ParticlesOrbit({ state, amplitude, listeningLevel }: MechaCoachTerminalProps) {
  const groupRef = useRef<Group>(null)
  const materialRef = useRef<PointsMaterial>(null)
  const positions = useMemo(() => createOrbitPositions(MECHA_PARTICLE_COUNTS.orbit), [])

  useFrame((_, delta) => {
    const profile = getStateProfile(state)
    const reactive = state === 'listening' ? listeningLevel : amplitude
    const direction = state === 'thinking' ? -1 : 1

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * profile.particleSpeed * direction
      groupRef.current.rotation.z += delta * profile.particleSpeed * 0.28
      const targetScale = state === 'thinking' ? 0.88 : isSpeakingState(state) ? 1.06 + reactive * 0.14 : 1
      const nextScale = groupRef.current.scale.x + (targetScale - groupRef.current.scale.x) * 0.06
      groupRef.current.scale.setScalar(nextScale)
    }

    if (materialRef.current) {
      materialRef.current.opacity = 0.42 + reactive * 0.28
      materialRef.current.size = 0.022 + reactive * 0.012
    }
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={materialRef} color={getStateProfile(state).primary} transparent opacity={0.5} size={0.024} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  )
}

export function ParticlesStars({ state }: Pick<MechaCoachTerminalProps, 'state'>) {
  const groupRef = useRef<Group>(null)
  const positions = useMemo(() => createStarPositions(MECHA_PARTICLE_COUNTS.stars), [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.018
      groupRef.current.rotation.x += delta * 0.004
    }
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={getStateProfile(state).secondary} transparent opacity={0.24} size={0.016} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  )
}
