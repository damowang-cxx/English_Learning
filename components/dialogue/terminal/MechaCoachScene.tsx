'use client'

import { PerspectiveCamera } from '@react-three/drei'
import MechaCoachModel from './MechaCoachModel'
import { getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachScene(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.05, 5.0]} fov={37} />
      <ambientLight intensity={0.62} />
      <pointLight position={[0, 2.35, 2.9]} color="#f7fbff" intensity={1.7} />
      <pointLight position={[-2.75, 0.25, 1.9]} color={profile.primary} intensity={0.9 * profile.glowStrength} />
      <pointLight position={[2.55, -0.4, 1.8]} color="#a8bec8" intensity={0.82} />
      <spotLight position={[0, 2.85, 3.35]} angle={0.35} penumbra={0.88} color="#ffffff" intensity={0.62} />
      <spotLight position={[0, -1.4, 2.45]} angle={0.5} penumbra={0.92} color={profile.primary} intensity={0.36 * profile.glowStrength} />
      <MechaCoachModel {...props} />
    </>
  )
}
