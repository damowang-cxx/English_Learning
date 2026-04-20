'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { damp, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachState } from './mechaCoach.types'

interface ArmorPlateProps {
  state: MechaCoachState
  side: 'left' | 'right' | 'top' | 'bottom'
  base: [number, number, number]
  openOffset: [number, number, number]
  baseRotation: [number, number, number]
  openRotation: [number, number, number]
  size: [number, number, number]
}

function ArmorPlate({
  state,
  side,
  base,
  openOffset,
  baseRotation,
  openRotation,
  size,
}: ArmorPlateProps) {
  const groupRef = useRef<Group>(null)
  const profile = getStateProfile(state)

  useFrame(({ clock }, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }

    const selfCheck = state === 'thinking' ? Math.sin(clock.elapsedTime * 13 + side.length) * 0.025 : 0
    const open = profile.armorOpen
    const targetX = base[0] + openOffset[0] * open
    const targetY = base[1] + openOffset[1] * open + selfCheck
    const targetZ = base[2] + openOffset[2] * open

    group.position.set(
      damp(group.position.x, targetX, 8, delta),
      damp(group.position.y, targetY, 8, delta),
      damp(group.position.z, targetZ, 8, delta)
    )

    group.rotation.set(
      damp(group.rotation.x, baseRotation[0] + openRotation[0] * open, 8, delta),
      damp(group.rotation.y, baseRotation[1] + openRotation[1] * open, 8, delta),
      damp(group.rotation.z, baseRotation[2] + openRotation[2] * open + selfCheck * 1.4, 8, delta)
    )
  })

  return (
    <group ref={groupRef} position={base} rotation={baseRotation}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color="#0a1824"
          emissive={profile.primary}
          emissiveIntensity={0.22 + profile.glowStrength * 0.22}
          metalness={0.86}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, size[2] * 0.58]}>
        <boxGeometry args={[size[0] * 0.76, size[1] * 0.08, size[2] * 0.35]} />
        <meshBasicMaterial color={profile.secondary} transparent opacity={0.72} />
      </mesh>
    </group>
  )
}

export default function MechaCoachArmor({ state }: { state: MechaCoachState }) {
  return (
    <>
      <ArmorPlate
        state={state}
        side="left"
        base={[-0.64, 0, 0.08]}
        openOffset={[-0.36, 0.03, -0.04]}
        baseRotation={[0, 0.34, -0.08]}
        openRotation={[0.06, -0.42, -0.18]}
        size={[0.28, 0.92, 0.1]}
      />
      <ArmorPlate
        state={state}
        side="right"
        base={[0.64, 0, 0.08]}
        openOffset={[0.36, 0.03, -0.04]}
        baseRotation={[0, -0.34, 0.08]}
        openRotation={[0.06, 0.42, 0.18]}
        size={[0.28, 0.92, 0.1]}
      />
      <ArmorPlate
        state={state}
        side="top"
        base={[0, 0.68, 0.02]}
        openOffset={[0, 0.28, -0.02]}
        baseRotation={[0.2, 0, 0]}
        openRotation={[-0.38, 0, 0]}
        size={[0.88, 0.22, 0.1]}
      />
      <ArmorPlate
        state={state}
        side="bottom"
        base={[0, -0.66, 0.02]}
        openOffset={[0, -0.18, 0.02]}
        baseRotation={[-0.16, 0, 0]}
        openRotation={[0.26, 0, 0]}
        size={[0.74, 0.18, 0.1]}
      />
    </>
  )
}
