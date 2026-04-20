'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import MechaCoachFacePanel from './MechaCoachFacePanel'
import MechaCoachHull from './MechaCoachHull'
import MechaCoachNoiseField from './MechaCoachNoiseField'
import { ParticlesOrbit, ParticlesStars } from './MechaCoachParticles'
import MechaCoachRings from './MechaCoachRings'
import MechaCoachThrusters from './MechaCoachThrusters'
import MechaCoachWaveEmitter from './MechaCoachWaveEmitter'
import MechaCoachWings from './MechaCoachWings'
import { damp, getReactiveLevel, getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachModel(props: MechaCoachTerminalProps) {
  const rootRef = useRef<Group>(null)
  const droneRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    const profile = getStateProfile(props.state)
    const reactive = getReactiveLevel(props.state, props.amplitude, props.listeningLevel)
    const hover = Math.sin(clock.elapsedTime * 1.35) * 0.055
    const combatJitter = props.state === 'thinking'
      ? Math.sin(clock.elapsedTime * 15) * 0.02
      : props.state === 'speaking'
        ? Math.sin(clock.elapsedTime * 22) * 0.012 * reactive
        : 0

    if (rootRef.current) {
      rootRef.current.position.y = damp(rootRef.current.position.y, hover + reactive * 0.03, 4, delta)
      rootRef.current.rotation.y = damp(rootRef.current.rotation.y, Math.sin(clock.elapsedTime * 0.34) * 0.16, 3, delta)
      rootRef.current.rotation.z = damp(rootRef.current.rotation.z, combatJitter, 10, delta)
    }

    if (droneRef.current) {
      droneRef.current.scale.setScalar(damp(droneRef.current.scale.x, 0.98 + profile.armorOpen * 0.05 + reactive * 0.03, 7, delta))
    }
  })

  return (
    <group ref={rootRef}>
      <ParticlesStars state={props.state} />
      <group position={[0, 0, -0.18]} scale={[0.88, 0.88, 0.88]}>
        <MechaCoachRings {...props} />
      </group>
      <group ref={droneRef}>
        <MechaCoachWings {...props} />
        <MechaCoachHull {...props} />
        <MechaCoachFacePanel {...props} />
        <MechaCoachThrusters {...props} />
      </group>
      <MechaCoachWaveEmitter {...props} />
      <MechaCoachNoiseField {...props} />
      <ParticlesOrbit {...props} />
    </group>
  )
}
