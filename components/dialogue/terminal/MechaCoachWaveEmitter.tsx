'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Mesh, MeshBasicMaterial } from 'three'
import { getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function WaveRing({ index, props }: { index: number; props: MechaCoachTerminalProps }) {
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)
  const offset = useMemo(() => index / 4, [index])

  useFrame(({ clock }, delta) => {
    const active = isSpeakingState(props.state)
    const profile = getStateProfile(props.state)
    const intensity = active ? Math.max(0.16, props.amplitude) : 0
    const phase = active ? (clock.elapsedTime * (0.55 + intensity * 0.5) + offset) % 1 : 0
    const radius = 0.24 + phase * (1.55 + intensity * 0.48)

    if (meshRef.current) {
      const targetScale = active ? radius : 0.05
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * Math.min(1, delta * 12)
      meshRef.current.scale.y = meshRef.current.scale.x
      meshRef.current.scale.z = meshRef.current.scale.x
    }

    if (materialRef.current) {
      materialRef.current.color.set(profile.primary)
      materialRef.current.opacity = active ? Math.max(0, (1 - phase) * (0.26 + intensity * 0.36)) : 0
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0.02, 1.02]}>
      <torusGeometry args={[0.38, 0.007, 6, 72]} />
      <meshBasicMaterial ref={materialRef} color={getStateProfile(props.state).primary} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

export default function MechaCoachWaveEmitter(props: MechaCoachTerminalProps) {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <WaveRing key={index} index={index} props={props} />
      ))}
    </>
  )
}
