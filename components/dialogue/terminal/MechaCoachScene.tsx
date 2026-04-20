'use client'

import { PerspectiveCamera } from '@react-three/drei'
import MechaCoachModel from './MechaCoachModel'
import { getStateProfile } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachScene(props: MechaCoachTerminalProps) {
  const profile = getStateProfile(props.state)

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.08, 5.2]} fov={42} />
      <ambientLight intensity={0.24} />
      <pointLight position={[0, 1.8, 2.5]} color={profile.primary} intensity={2.8 * profile.glowStrength} />
      <pointLight position={[-2.8, -0.65, 1.7]} color={profile.secondary} intensity={1.9} />
      <pointLight position={[2.4, -1.1, 1.2]} color={profile.warning} intensity={1.25} />
      <spotLight position={[0, 2.6, 3.2]} angle={0.42} penumbra={0.8} color={profile.primary} intensity={1.25} />
      <MechaCoachModel {...props} />
    </>
  )
}
