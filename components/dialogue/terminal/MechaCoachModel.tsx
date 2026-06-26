'use client'

import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import MechaCoachFacePanel from './MechaCoachFacePanel'
import { ParticlesOrbit, ParticlesStars } from './MechaCoachParticles'
import MechaCoachRings from './MechaCoachRings'
import { damp, getReactiveLevel, getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function HelmetEdgeLights(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)
  const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
  const listeningGlow = props.state === 'listening' ? Math.max(0.28, props.listeningLevel) : reactive
  const sideOpacity = props.state === 'listening'
    ? 0.45 + listeningGlow * 0.4
    : isSpeakingState(props.state)
      ? 0.28 + props.amplitude * 0.24
      : 0.16

  return (
    <>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 1.18, -0.02, 0.43]}>
          <RoundedBox args={[0.035, 0.76, 0.035]} radius={0.018} smoothness={3}>
            <meshBasicMaterial color={profile.primary} transparent opacity={sideOpacity} depthWrite={false} />
          </RoundedBox>
          <mesh position={[side * 0.02, 0, -0.02]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.27 + listeningGlow * 0.025, 0.004, 8, 72]} />
            <meshBasicMaterial color={profile.primary} transparent opacity={props.state === 'listening' ? 0.1 + listeningGlow * 0.12 : 0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function CoachHelmetHead(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)
  const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
  const thinkingGlow = props.state === 'thinking' ? 0.22 : 0
  const visorGlow = 0.06 + reactive * 0.16 + thinkingGlow
  const warmCoachGlow = props.state === 'coach_mode' ? 0.16 : 0

  return (
    <group position={[0, 0.08, 0]}>
      <RoundedBox args={[2.62, 1.68, 0.72]} radius={0.34} smoothness={10}>
        <meshStandardMaterial
          color="#162026"
          emissive={profile.secondary}
          emissiveIntensity={0.025 + reactive * 0.04 + warmCoachGlow * 0.12}
          metalness={0.82}
          roughness={0.22}
        />
      </RoundedBox>

      <RoundedBox position={[0, 0.05, 0.08]} args={[2.42, 1.48, 0.58]} radius={0.28} smoothness={10}>
        <meshStandardMaterial
          color="#233039"
          emissive={profile.primary}
          emissiveIntensity={0.018 + reactive * 0.035}
          metalness={0.78}
          roughness={0.18}
        />
      </RoundedBox>

      <RoundedBox position={[0, 0.11, 0.22]} args={[2.22, 1.2, 0.32]} radius={0.24} smoothness={9}>
        <meshStandardMaterial
          color="#3b4a52"
          emissive={profile.primary}
          emissiveIntensity={0.035 + visorGlow * 0.22}
          metalness={0.9}
          roughness={0.14}
        />
      </RoundedBox>

      <RoundedBox position={[0, 0.06, 0.34]} args={[1.94, 0.94, 0.16]} radius={0.18} smoothness={8}>
        <meshStandardMaterial
          color="#02090d"
          emissive={profile.primary}
          emissiveIntensity={0.12 + visorGlow * 0.38}
          metalness={0.46}
          roughness={0.08}
          transparent
          opacity={0.92}
        />
      </RoundedBox>

      <MechaCoachFacePanel {...props} />

      <RoundedBox position={[0, 0.06, 0.54]} args={[2.0, 0.99, 0.035]} radius={0.18} smoothness={8}>
        <meshStandardMaterial
          color="#a8dce6"
          emissive={profile.primary}
          emissiveIntensity={0.035 + visorGlow * 0.12}
          metalness={0.18}
          roughness={0.02}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </RoundedBox>

      <RoundedBox position={[0, 0.92, 0.12]} args={[0.86, 0.08, 0.08]} radius={0.035} smoothness={4}>
        <meshStandardMaterial
          color="#62737b"
          emissive={props.state === 'thinking' ? profile.secondary : profile.primary}
          emissiveIntensity={props.state === 'thinking' ? 0.48 : 0.08 + reactive * 0.16}
          metalness={0.88}
          roughness={0.16}
        />
      </RoundedBox>

      <RoundedBox position={[0, -0.72, 0.08]} args={[1.36, 0.14, 0.12]} radius={0.07} smoothness={4}>
        <meshStandardMaterial
          color="#10191f"
          emissive={profile.primary}
          emissiveIntensity={0.025 + reactive * 0.08}
          metalness={0.86}
          roughness={0.2}
        />
      </RoundedBox>

      <HelmetEdgeLights {...props} />

      <mesh position={[0, -0.88, -0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[2.25, 0.58, 1]}>
        <circleGeometry args={[0.42, 72]} />
        <meshBasicMaterial color={profile.primary} transparent opacity={0.04 + reactive * 0.08} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function MechaCoachModel(props: MechaCoachTerminalProps) {
  const rootRef = useRef<Group>(null)
  const helmetRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    const profile = getStateProfile(props.state)
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const hover = Math.sin(clock.elapsedTime * 1.02) * 0.045
    const thinkingTilt = props.state === 'thinking' ? Math.sin(clock.elapsedTime * 1.45) * 0.014 : 0
    const speakingLift = isSpeakingState(props.state) ? reactive * 0.025 : 0

    if (rootRef.current) {
      rootRef.current.position.y = damp(rootRef.current.position.y, hover + reactive * 0.02 + speakingLift, 4.4, delta)
      rootRef.current.rotation.y = damp(rootRef.current.rotation.y, Math.sin(clock.elapsedTime * 0.26) * 0.04, 3.8, delta)
      rootRef.current.rotation.z = damp(rootRef.current.rotation.z, thinkingTilt, 4.6, delta)
    }

    if (helmetRef.current) {
      helmetRef.current.scale.setScalar(damp(helmetRef.current.scale.x, 0.98 + profile.coreScale * 0.018 + reactive * 0.02, 6, delta))
    }
  })

  return (
    <group ref={rootRef}>
      <ParticlesStars state={props.state} />
      <group position={[0, 0, -0.58]} scale={[0.64, 0.64, 0.64]}>
        <MechaCoachRings {...props} />
      </group>
      <group ref={helmetRef}>
        <CoachHelmetHead {...props} />
      </group>
      <ParticlesOrbit {...props} />
    </group>
  )
}
