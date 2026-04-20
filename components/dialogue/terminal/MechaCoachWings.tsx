'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshBasicMaterial } from 'three'
import { damp, getReactiveLevel, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function DroneWing({ side, props }: { side: -1 | 1; props: MechaCoachTerminalProps }) {
  const wingRef = useRef<Group>(null)
  const rotorRef = useRef<Group>(null)
  const stripRef = useRef<MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    const profile = getStateProfile(props.state)
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const open = profile.armorOpen + reactive * 0.18
    const selfCheck = props.state === 'thinking' ? Math.sin(clock.elapsedTime * 16 + side) * 0.035 : 0

    if (wingRef.current) {
      wingRef.current.position.x = damp(wingRef.current.position.x, side * (0.72 + open * 0.34), 8, delta)
      wingRef.current.position.y = damp(wingRef.current.position.y, 0.02 + open * 0.1 + selfCheck, 8, delta)
      wingRef.current.position.z = damp(wingRef.current.position.z, 0.04 - open * 0.08, 8, delta)
      wingRef.current.rotation.z = damp(wingRef.current.rotation.z, side * (-0.08 - open * 0.36), 8, delta)
      wingRef.current.rotation.y = damp(wingRef.current.rotation.y, side * (0.14 + open * 0.22), 8, delta)
    }

    if (rotorRef.current) {
      rotorRef.current.rotation.z += delta * (4 + profile.ringSpeed * 10 + reactive * 8)
    }

    if (stripRef.current) {
      stripRef.current.color.set(props.state === 'thinking' ? profile.warning : profile.primary)
      stripRef.current.opacity = 0.46 + profile.glowStrength * 0.18 + reactive * 0.26
    }
  })

  const profile = getStateProfile(props.state)

  return (
    <group ref={wingRef}>
      <mesh position={[side * 0.24, 0, 0]}>
        <boxGeometry args={[0.58, 0.12, 0.16]} />
        <meshStandardMaterial color="#07131f" emissive={profile.primary} emissiveIntensity={0.26} metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[side * 0.62, 0.12, 0.02]} rotation={[0, 0, side * -0.08]}>
        <boxGeometry args={[0.68, 0.22, 0.1]} />
        <meshStandardMaterial color="#081827" emissive="#1a0b2d" emissiveIntensity={0.3} metalness={0.9} roughness={0.17} />
      </mesh>
      <mesh position={[side * 0.62, 0.16, 0.09]} rotation={[0, 0, side * -0.08]}>
        <boxGeometry args={[0.5, 0.035, 0.035]} />
        <meshBasicMaterial ref={stripRef} color={profile.primary} transparent opacity={0.68} />
      </mesh>
      <mesh position={[side * 0.98, -0.02, 0]}>
        <boxGeometry args={[0.2, 0.36, 0.12]} />
        <meshStandardMaterial color="#050b12" emissive={profile.secondary} emissiveIntensity={0.38} metalness={0.88} roughness={0.16} />
      </mesh>
      <group ref={rotorRef} position={[side * 1.08, -0.04, 0.05]}>
        <mesh>
          <torusGeometry args={[0.22, 0.012, 6, 48]} />
          <meshStandardMaterial color="#06111c" emissive={profile.primary} emissiveIntensity={0.7} metalness={0.82} roughness={0.18} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.38, 0.025, 0.025]} />
          <meshBasicMaterial color={profile.warning} transparent opacity={0.58} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.38, 0.025, 0.025]} />
          <meshBasicMaterial color={profile.primary} transparent opacity={0.58} />
        </mesh>
      </group>
      <mesh position={[side * 1.26, 0.16, 0.03]} rotation={[0, 0, side * -0.46]}>
        <boxGeometry args={[0.28, 0.08, 0.08]} />
        <meshBasicMaterial color={profile.secondary} transparent opacity={0.78} />
      </mesh>
    </group>
  )
}

export default function MechaCoachWings(props: MechaCoachTerminalProps) {
  return (
    <>
      <DroneWing side={-1} props={props} />
      <DroneWing side={1} props={props} />
    </>
  )
}
