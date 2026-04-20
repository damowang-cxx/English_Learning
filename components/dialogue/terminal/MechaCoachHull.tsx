'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { damp, getReactiveLevel, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

function SensorArray(props: MechaCoachTerminalProps) {
  const scanRef = useRef<Mesh>(null)
  const scanMaterialRef = useRef<MeshBasicMaterial>(null)
  const profile = getStateProfile(props.state)

  useFrame((_, delta) => {
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const scanOpen = props.state === 'listening' ? 1 : props.state === 'thinking' ? 0.42 : 0.08

    if (scanRef.current) {
      scanRef.current.rotation.z += delta * (0.7 + reactive * 3)
      scanRef.current.scale.setScalar(damp(scanRef.current.scale.x, scanOpen + reactive * 0.35, 8, delta))
    }

    if (scanMaterialRef.current) {
      scanMaterialRef.current.opacity = damp(
        scanMaterialRef.current.opacity,
        props.state === 'listening' ? 0.28 + reactive * 0.36 : 0.04,
        10,
        delta
      )
      scanMaterialRef.current.color.set(props.state === 'thinking' ? profile.secondary : profile.primary)
    }
  })

  return (
    <group position={[0, 0.58, 0.06]}>
      <mesh>
        <boxGeometry args={[0.58, 0.1, 0.24]} />
        <meshStandardMaterial color="#071521" emissive={profile.primary} emissiveIntensity={0.26} metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.02]}>
        <cylinderGeometry args={[0.015, 0.022, 0.34, 8]} />
        <meshStandardMaterial color="#0a1824" emissive={profile.primary} emissiveIntensity={0.75} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.2, 0.2, 0.02]}>
        <cylinderGeometry args={[0.015, 0.022, 0.34, 8]} />
        <meshStandardMaterial color="#0a1824" emissive={profile.secondary} emissiveIntensity={0.75} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.2, 0.4, 0.02]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshBasicMaterial color={profile.primary} />
      </mesh>
      <mesh position={[0.2, 0.4, 0.02]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshBasicMaterial color={profile.secondary} />
      </mesh>
      <mesh ref={scanRef} position={[0, 0.12, 0.2]} rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.32, 0.36, 4]} />
        <meshBasicMaterial ref={scanMaterialRef} color={profile.primary} transparent opacity={0.04} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function MechaCoachHull(props: MechaCoachTerminalProps) {
  const hullRef = useRef<Group>(null)
  const visorMaterialRef = useRef<MeshStandardMaterial>(null)
  const coreMaterialRef = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }, delta) => {
    const profile = getStateProfile(props.state)
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const combatPulse = props.state === 'speaking' || props.state === 'thinking'
      ? Math.sin(clock.elapsedTime * 18) * 0.045
      : 0

    if (hullRef.current) {
      hullRef.current.rotation.x = damp(hullRef.current.rotation.x, combatPulse, 7, delta)
      hullRef.current.scale.setScalar(damp(hullRef.current.scale.x, profile.coreScale + reactive * 0.04, 7, delta))
    }

    if (visorMaterialRef.current) {
      visorMaterialRef.current.emissive.set(profile.primary)
      visorMaterialRef.current.emissiveIntensity = 0.8 + profile.glowStrength * 0.7 + reactive * 1.2
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.color.set(profile.primary)
      coreMaterialRef.current.emissive.set(profile.primary)
      coreMaterialRef.current.emissiveIntensity = 1.2 + profile.glowStrength * 1.2 + reactive * 1.6
    }
  })

  const profile = getStateProfile(props.state)

  return (
    <group ref={hullRef}>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.72, 0.92, 0.36, 6, 1, false]} />
        <meshStandardMaterial color="#06111c" emissive="#0b2332" emissiveIntensity={0.28} metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[1.32, 0.56, 0.1]} />
        <meshStandardMaterial color="#081421" emissive={profile.secondary} emissiveIntensity={0.2} metalness={0.9} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.03, 0.29]}>
        <boxGeometry args={[1.06, 0.28, 0.06]} />
        <meshStandardMaterial
          ref={visorMaterialRef}
          color="#020b12"
          emissive={profile.primary}
          emissiveIntensity={1.1}
          metalness={0.62}
          roughness={0.12}
        />
      </mesh>
      <mesh position={[0, -0.34, 0.24]}>
        <boxGeometry args={[0.66, 0.08, 0.08]} />
        <meshBasicMaterial color={props.state === 'thinking' ? profile.warning : profile.secondary} />
      </mesh>
      <mesh position={[-0.52, -0.2, 0.3]}>
        <boxGeometry args={[0.16, 0.08, 0.06]} />
        <meshBasicMaterial color={profile.warning} transparent opacity={props.state === 'idle' ? 0.34 : 0.9} />
      </mesh>
      <mesh position={[0.52, -0.2, 0.3]}>
        <boxGeometry args={[0.16, 0.08, 0.06]} />
        <meshBasicMaterial color={profile.warning} transparent opacity={props.state === 'idle' ? 0.34 : 0.9} />
      </mesh>
      <mesh position={[0, -0.06, 0.35]}>
        <octahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial ref={coreMaterialRef} color={profile.primary} emissive={profile.primary} emissiveIntensity={1.6} metalness={0.5} roughness={0.08} />
      </mesh>
      <mesh position={[0, -0.06, 0.36]}>
        <ringGeometry args={[0.24, 0.27, 6]} />
        <meshBasicMaterial color={profile.secondary} transparent opacity={0.54} depthWrite={false} />
      </mesh>
      <SensorArray {...props} />
    </group>
  )
}
