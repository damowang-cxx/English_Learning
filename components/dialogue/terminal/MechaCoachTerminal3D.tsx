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
        <color attach="background" args={['#020617']} />
        <MechaCoachScene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.95 + props.amplitude * 0.82 + props.listeningLevel * 0.22} luminanceThreshold={0.16} luminanceSmoothing={0.42} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
