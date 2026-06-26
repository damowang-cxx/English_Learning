'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { getStateProfile, isSpeakingState } from './mechaCoach.utils'
import type { MechaCoachTerminalProps } from './mechaCoach.types'

const FACE_WIDTH = 832
const FACE_HEIGHT = 416

interface EyeProfile {
  leftWidth: number
  rightWidth: number
  leftHeight: number
  rightHeight: number
  leftY: number
  rightY: number
  leftBrow: number
  rightBrow: number
  smile: number
}

function getEyeProfile(expression: MechaCoachTerminalProps['expression']): EyeProfile {
  switch (expression) {
    case 'encouraging':
      return {
        leftWidth: 148,
        rightWidth: 148,
        leftHeight: 42,
        rightHeight: 42,
        leftY: 146,
        rightY: 146,
        leftBrow: 0.12,
        rightBrow: -0.12,
        smile: 1,
      }
    case 'confused':
      return {
        leftWidth: 96,
        rightWidth: 152,
        leftHeight: 54,
        rightHeight: 42,
        leftY: 152,
        rightY: 136,
        leftBrow: 0.26,
        rightBrow: 0.16,
        smile: -0.2,
      }
    case 'corrective':
      return {
        leftWidth: 132,
        rightWidth: 132,
        leftHeight: 30,
        rightHeight: 30,
        leftY: 150,
        rightY: 150,
        leftBrow: -0.22,
        rightBrow: 0.22,
        smile: -0.55,
      }
    case 'normal':
    default:
      return {
        leftWidth: 136,
        rightWidth: 136,
        leftHeight: 46,
        rightHeight: 46,
        leftY: 146,
        rightY: 146,
        leftBrow: -0.06,
        rightBrow: 0.06,
        smile: 0,
      }
  }
}

function toRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const parsed = Number.parseInt(value.length === 3
    ? value.split('').map((character) => character + character).join('')
    : value, 16)
  const red = (parsed >> 16) & 255
  const green = (parsed >> 8) & 255
  const blue = parsed & 255

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient
) {
  roundedRect(context, x, y, width, height, radius)
  context.fillStyle = fillStyle
  context.fill()
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth: number
) {
  roundedRect(context, x, y, width, height, radius)
  context.strokeStyle = strokeStyle
  context.lineWidth = lineWidth
  context.stroke()
}

function drawGlowBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  alpha: number
) {
  context.shadowColor = color
  context.shadowBlur = 22
  fillRoundedRect(context, x, y, width, height, radius, toRgba(color, alpha))
  context.shadowBlur = 0
}

function drawBrow(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angle: number,
  color: string
) {
  context.save()
  context.translate(centerX, centerY)
  context.rotate(angle)
  drawGlowBar(context, -66, -5, 132, 10, 8, color, 0.62)
  context.restore()
}

function drawStaticMouth(
  context: CanvasRenderingContext2D,
  expression: MechaCoachTerminalProps['expression'],
  profile: EyeProfile,
  color: string,
  time: number
) {
  context.save()
  context.strokeStyle = toRgba(color, 0.9)
  context.shadowColor = color
  context.shadowBlur = 18
  context.lineCap = 'round'
  context.lineWidth = 10

  if (expression === 'encouraging') {
    context.beginPath()
    context.moveTo(FACE_WIDTH / 2 - 102, 286)
    context.quadraticCurveTo(FACE_WIDTH / 2, 332 + Math.sin(time * 1.6) * 2, FACE_WIDTH / 2 + 102, 286)
    context.stroke()
  } else if (expression === 'confused') {
    context.beginPath()
    context.moveTo(FACE_WIDTH / 2 - 66, 302)
    context.quadraticCurveTo(FACE_WIDTH / 2 - 34, 282, FACE_WIDTH / 2, 300)
    context.quadraticCurveTo(FACE_WIDTH / 2 + 36, 318, FACE_WIDTH / 2 + 70, 294)
    context.stroke()
  } else {
    const width = expression === 'corrective' ? 150 : 168 + profile.smile * 8
    drawGlowBar(context, FACE_WIDTH / 2 - width / 2, 292, width, 13, 8, color, expression === 'corrective' ? 0.74 : 0.8)
  }

  context.restore()
}

function drawSpeakingMouth(
  context: CanvasRenderingContext2D,
  signalLevel: number,
  color: string,
  time: number
) {
  const bars = 9
  const gap = 17
  const barWidth = 12
  const startX = FACE_WIDTH / 2 - ((bars - 1) * gap + barWidth) / 2
  const baseY = 324
  const level = Math.max(0.18, signalLevel)

  for (let index = 0; index < bars; index += 1) {
    const wave = Math.sin(time * 8.2 + index * 0.86) * 0.5 + 0.5
    const centerWeight = 1 - Math.abs(index - 4) / 5
    const height = 22 + level * 72 * (0.38 + wave * 0.62) * (0.58 + centerWeight * 0.48)
    const x = startX + index * gap

    drawGlowBar(context, x, baseY - height, barWidth, height, 7, color, 0.58 + level * 0.35)
  }
}

function drawFaceTexture(
  canvas: HTMLCanvasElement,
  props: MechaCoachTerminalProps,
  time: number
) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  const profile = getStateProfile(props.state)
  const faceProfile = getEyeProfile(props.expression)
  const faceColor = props.expression === 'corrective' ? profile.warning : profile.primary
  const signalLevel = props.state === 'listening' ? props.listeningLevel : props.amplitude
  const speaking = isSpeakingState(props.state)
  const activity = Math.max(
    props.state === 'thinking' ? 0.36 : 0.12,
    speaking ? Math.max(0.22, props.amplitude) : 0,
    props.state === 'listening' ? Math.max(0.24, props.listeningLevel) : 0
  )

  context.clearRect(0, 0, FACE_WIDTH, FACE_HEIGHT)

  const screenGradient = context.createLinearGradient(0, 0, FACE_WIDTH, FACE_HEIGHT)
  screenGradient.addColorStop(0, '#102126')
  screenGradient.addColorStop(0.42, '#02080c')
  screenGradient.addColorStop(1, '#101b20')
  fillRoundedRect(context, 16, 16, FACE_WIDTH - 32, FACE_HEIGHT - 32, 62, screenGradient)

  context.globalCompositeOperation = 'screen'
  const centerX = FACE_WIDTH / 2
  const centerY = FACE_HEIGHT / 2
  const glow = context.createRadialGradient(centerX, centerY, 20, centerX, centerY, 390)
  glow.addColorStop(0, toRgba(faceColor, 0.18 + activity * 0.17))
  glow.addColorStop(0.45, toRgba(faceColor, 0.06 + activity * 0.07))
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  fillRoundedRect(context, 16, 16, FACE_WIDTH - 32, FACE_HEIGHT - 32, 62, glow)
  context.globalCompositeOperation = 'source-over'

  for (let y = 36; y < FACE_HEIGHT - 34; y += 18) {
    context.fillStyle = `rgba(126, 246, 200, ${0.018 + activity * 0.016})`
    context.fillRect(34, y, FACE_WIDTH - 68, 1)
  }

  if (props.state === 'thinking') {
    const scanX = ((time * 118) % (FACE_WIDTH + 220)) - 110
    const scanGradient = context.createLinearGradient(scanX - 60, 0, scanX + 120, 0)
    scanGradient.addColorStop(0, 'rgba(255,255,255,0)')
    scanGradient.addColorStop(0.5, toRgba(profile.secondary, 0.22))
    scanGradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = scanGradient
    context.fillRect(scanX - 70, 20, 180, FACE_HEIGHT - 40)
  }

  strokeRoundedRect(context, 42, 40, FACE_WIDTH - 84, FACE_HEIGHT - 80, 48, toRgba(faceColor, 0.16 + activity * 0.2), 3)
  drawBrow(context, 276, 120, faceProfile.leftBrow, profile.secondary)
  drawBrow(context, 556, 120, faceProfile.rightBrow, profile.secondary)

  drawGlowBar(
    context,
    276 - faceProfile.leftWidth / 2,
    faceProfile.leftY,
    faceProfile.leftWidth,
    faceProfile.leftHeight,
    faceProfile.leftHeight / 2,
    faceColor,
    0.74 + activity * 0.22
  )
  drawGlowBar(
    context,
    556 - faceProfile.rightWidth / 2,
    faceProfile.rightY,
    faceProfile.rightWidth,
    faceProfile.rightHeight,
    faceProfile.rightHeight / 2,
    faceColor,
    0.74 + activity * 0.22
  )

  if (props.state === 'listening') {
    for (let index = 0; index < 3; index += 1) {
      const radius = 26 + index * 15 + Math.sin(time * 3.4 + index) * 3
      context.beginPath()
      context.arc(96, centerY, radius, -0.75, 0.75)
      context.arc(FACE_WIDTH - 96, centerY, radius, Math.PI - 0.75, Math.PI + 0.75)
      context.strokeStyle = toRgba(faceColor, 0.2 + props.listeningLevel * 0.24)
      context.lineWidth = 5 - index
      context.stroke()
    }
  }

  if (speaking) {
    drawSpeakingMouth(context, signalLevel, faceColor, time)
  } else {
    drawStaticMouth(context, props.expression, faceProfile, faceColor, time)
  }

  const bottomPulse = 0.36 + activity * 0.38 + Math.sin(time * 2.1) * 0.04
  drawGlowBar(context, centerX - 62, 356, 124, 10, 6, faceColor, bottomPulse)

  const reflection = context.createLinearGradient(120, 40, 610, 180)
  reflection.addColorStop(0, 'rgba(255,255,255,0)')
  reflection.addColorStop(0.45, 'rgba(255,255,255,0.16)')
  reflection.addColorStop(1, 'rgba(255,255,255,0)')
  context.save()
  roundedRect(context, 16, 16, FACE_WIDTH - 32, FACE_HEIGHT - 32, 62)
  context.clip()
  context.translate(0, Math.sin(time * 0.35) * 8)
  context.rotate(-0.14)
  context.fillStyle = reflection
  context.fillRect(72, 42, 690, 48)
  context.restore()
}

function markTextureNeedsUpdate(texture: CanvasTexture) {
  texture.needsUpdate = true
}

export default function MechaCoachFacePanel(props: MechaCoachTerminalProps) {
  const faceTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = FACE_WIDTH
    canvas.height = FACE_HEIGHT

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.anisotropy = 4

    return { canvas, texture }
  }, [])

  useEffect(() => () => faceTexture.texture.dispose(), [faceTexture])

  useFrame(({ clock }) => {
    drawFaceTexture(faceTexture.canvas, props, clock.elapsedTime)
    markTextureNeedsUpdate(faceTexture.texture)
  })

  return (
    <group position={[0, 0.05, 0.49]} rotation={[-0.02, 0, 0]}>
      <mesh>
        <planeGeometry args={[1.74, 0.87]} />
        <meshBasicMaterial map={faceTexture.texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
