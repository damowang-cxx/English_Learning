'use client'

import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import MechaCoachScene from './MechaCoachScene'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

export default function MechaCoachTerminal3D(props: MechaCoachTerminalProps) {
  return (
    <div className="mecha-coach-3d" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.1, 5.2], fov: 42, near: 0.1, far: 100 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#04090d']} />
        <MechaCoachScene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.24 + props.amplitude * 0.28 + props.listeningLevel * 0.16} luminanceThreshold={0.36} luminanceSmoothing={0.56} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
