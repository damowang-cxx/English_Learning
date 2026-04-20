'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, MeshBasicMaterial } from 'three'
import { damp, getReactiveLevel, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

interface ThrusterFlameProps {
  x: number
  props: MechaCoachTerminalProps
}

function ThrusterFlame({ x, props }: ThrusterFlameProps) {
  const flameRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    const profile = getStateProfile(props.state)
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const target = profile.thrusterStrength + reactive * 0.58
    const flicker = 0.78 + Math.sin(clock.elapsedTime * 32 + x * 4) * 0.22

    if (flameRef.current) {
      const scale = Math.max(0.02, target * flicker)
      flameRef.current.scale.set(
        damp(flameRef.current.scale.x, 0.58 + scale * 1.45, 10, delta),
        damp(flameRef.current.scale.y, 1.05 + scale * 3.4, 10, delta),
        damp(flameRef.current.scale.z, 0.58 + scale * 1.45, 10, delta)
      )
    }

    if (materialRef.current) {
      materialRef.current.opacity = damp(materialRef.current.opacity, Math.min(0.92, target * 1.55), 10, delta)
    }
  })

  return (
    <group position={[x, -0.76, 0.04]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 0.2, 6]} />
        <meshStandardMaterial color="#071018" emissive={props.state === 'coach_mode' ? '#67e8f9' : '#ff2bd6'} emissiveIntensity={0.72} metalness={0.88} roughness={0.14} />
      </mesh>
      <mesh ref={flameRef} position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.17, 0.64, 28, 1, true]} />
        <meshBasicMaterial ref={materialRef} color={props.state === 'thinking' ? '#ff2bd6' : '#ff3d00'} transparent opacity={0.02} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function MechaCoachThrusters(props: MechaCoachTerminalProps) {
  return (
    <>
      <ThrusterFlame x={-0.36} props={props} />
      <ThrusterFlame x={0.36} props={props} />
      <ThrusterFlame x={0} props={props} />
    </>
  )
}
