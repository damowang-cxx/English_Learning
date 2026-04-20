'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachRings({ state, amplitude, listeningLevel }: MechaCoachTerminalProps) {
  const innerRef = useRef<Group>(null)
  const outerRef = useRef<Group>(null)
  const profile = getStateProfile(state)

  useFrame(({ clock }, delta) => {
    const pulse = state === 'listening' ? listeningLevel : amplitude
    const irregular = state === 'thinking' ? Math.sin(clock.elapsedTime * 7.4) * 0.16 : 0
    const speed = profile.ringSpeed + pulse * 0.55 + irregular

    if (innerRef.current) {
      innerRef.current.rotation.z += delta * speed
      innerRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.8) * 0.08
    }

    if (outerRef.current) {
      outerRef.current.rotation.z -= delta * (speed * 0.62 + 0.08)
      outerRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.56) * 0.12
    }
  })

  return (
    <>
      <group ref={innerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.05, 0.018, 8, 96]} />
          <meshStandardMaterial color="#0f2330" emissive={profile.primary} emissiveIntensity={0.82} metalness={0.84} roughness={0.18} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.82, 0.011, 8, 80]} />
          <meshStandardMaterial color="#101525" emissive={profile.secondary} emissiveIntensity={0.54} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>

      <group ref={outerRef} rotation={[0.2, 0.08, 0.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.36, 0.011, 8, 112]} />
          <meshStandardMaterial color="#07121c" emissive={profile.secondary} emissiveIntensity={0.62} metalness={0.9} roughness={0.16} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52, 0.005, 6, 128]} />
          <meshBasicMaterial color={profile.primary} transparent opacity={0.5} />
        </mesh>
      </group>
    </>
  )
}
