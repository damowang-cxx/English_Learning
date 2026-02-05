'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TrainingItem {
  id: string
  title: string
  createdAt: string | Date
  sentences: { id: string }[]
}

interface HudScreenProps {
  isOpen: boolean
  onClose: () => void
  buttonPosition: { x: number; y: number; width: number; height: number } | null
  trainingItems: TrainingItem[]
}

export default function HudScreen({ isOpen, onClose, buttonPosition, trainingItems }: HudScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [scanLineY, setScanLineY] = useState(0)
  const [laserProgress, setLaserProgress] = useState(0)

  // 扫描线动画
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(() => {
      setScanLineY(prev => (prev + 2) % 100)
    }, 50)
    
    return () => clearInterval(interval)
  }, [isOpen])

  // 激光进度动画（控制激光光柱和屏幕形成）
  useEffect(() => {
    if (!isOpen) {
      setLaserProgress(0)
      return
    }
    
    // 激光光柱先延伸
    const timer1 = setTimeout(() => {
      setLaserProgress(0.5) // 激光到达屏幕中心
    }, 300)
    
    // 然后屏幕开始形成
    const timer2 = setTimeout(() => {
      setLaserProgress(1) // 屏幕完全形成
    }, 600)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isOpen])

  // ESC键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!buttonPosition) return null

  // 计算HUD位置（屏幕中央）
  const hudWidth = 700
  const hudHeight = 550
  const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
  const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0
  const hudX = screenCenterX - hudWidth / 2
  const hudY = screenCenterY - hudHeight / 2

  // 按钮中心点
  const buttonCenterX = buttonPosition.x + buttonPosition.width / 2
  const buttonCenterY = buttonPosition.y + buttonPosition.height / 2

  // 投影仪组件位置（在按钮上方）
  const projectorWidth = 80
  const projectorHeight = 50
  const projectorX = buttonCenterX - projectorWidth / 2
  const projectorY = buttonPosition.y - projectorHeight - 20 // 按钮上方20px
  const projectorCenterX = projectorX + projectorWidth / 2
  const projectorCenterY = projectorY + projectorHeight / 2
  const projectorLensX = projectorCenterX
  const projectorLensY = projectorY + projectorHeight - 10 // 镜头在投影仪底部

  // 计算HUD窗口的中心点（光束的终点）
  const hudCenterX = hudX + hudWidth / 2
  const hudCenterY = hudY + hudHeight / 2
  
  // 计算HUD窗口的对角线长度（用于确定扇形最终大小）
  const hudDiagonal = Math.sqrt(hudWidth * hudWidth + hudHeight * hudHeight)
  
  // 计算从投影仪镜头到HUD中心的距离和角度
  const dx = hudCenterX - projectorLensX
  const dy = hudCenterY - projectorLensY
  const distance = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  
  // 计算扇形角度，使得在到达HUD窗口时，扇形宽度等于HUD窗口的对角线
  // 使用反正切函数计算：angle = 2 * atan(targetWidth / (2 * distance))
  const targetBeamWidth = hudDiagonal // 目标光束宽度等于HUD对角线
  const maxAngle = Math.atan(targetBeamWidth / (2 * distance)) * (180 / Math.PI) * 2 // 转换为度数并乘以2（扇形总角度）
  
  const beamConfig = { 
    sourcePoint: { x: projectorLensX, y: projectorLensY },
    hudCenter: { x: hudCenterX, y: hudCenterY },
    distance, 
    angle,
    maxAngle
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200]"
            onClick={onClose}
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          />

          {/* 投影仪组件（赛博朋克风格） */}
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="fixed z-[201] pointer-events-none"
            style={{
              left: `${projectorX}px`,
              top: `${projectorY}px`,
              width: `${projectorWidth}px`,
              height: `${projectorHeight}px`,
            }}
          >
            {/* 投影仪主体（多面体设计，赛博朋克风格） */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 30%, #0f0f1e 70%, #0a0a1a 100%)
                `,
                borderRadius: '6px 6px 3px 3px',
                border: '2px solid rgba(0, 255, 255, 0.4)',
                boxShadow: `
                  inset 0 2px 6px rgba(0, 255, 255, 0.15),
                  inset -2px 0 4px rgba(0, 255, 255, 0.1),
                  inset 2px 0 4px rgba(0, 255, 255, 0.1),
                  0 0 25px rgba(0, 255, 255, 0.4),
                  0 4px 12px rgba(0, 0, 0, 0.6),
                  0 0 0 1px rgba(0, 255, 255, 0.2)
                `,
                clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)',
              }}
            />
            
            {/* 顶部面板（科技感线条） */}
            <div
              className="absolute"
              style={{
                left: '8px',
                top: '6px',
                right: '8px',
                height: '12px',
                background: 'linear-gradient(to bottom, rgba(0, 255, 255, 0.15), rgba(0, 255, 255, 0.05))',
                borderRadius: '2px',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                boxShadow: 'inset 0 1px 2px rgba(0, 255, 255, 0.2)',
              }}
            />
            
            {/* 顶部装饰线条 */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${12 + i * 20}px`,
                  top: '10px',
                  width: '2px',
                  height: '4px',
                  background: 'rgba(0, 255, 255, 0.6)',
                  boxShadow: '0 0 4px rgba(0, 255, 255, 0.8)',
                }}
              />
            ))}
            
            {/* 侧边散热格栅（左侧） */}
            <div
              className="absolute"
              style={{
                left: '4px',
                top: '20px',
                width: '6px',
                height: '20px',
                background: 'repeating-linear-gradient(to bottom, transparent 0px, rgba(0, 255, 255, 0.2) 1px, transparent 2px, transparent 4px)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
              }}
            />
            
            {/* 侧边散热格栅（右侧） */}
            <div
              className="absolute"
              style={{
                right: '4px',
                top: '20px',
                width: '6px',
                height: '20px',
                background: 'repeating-linear-gradient(to bottom, transparent 0px, rgba(0, 255, 255, 0.2) 1px, transparent 2px, transparent 4px)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
              }}
            />
            
            {/* 投影仪镜头外壳（六边形设计） */}
            <div
              className="absolute"
              style={{
                left: '50%',
                top: `${projectorHeight - 8}px`,
                width: '32px',
                height: '32px',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #1a1a2e, #0f0f1e)',
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                border: '2px solid rgba(0, 255, 255, 0.5)',
                boxShadow: `
                  inset 0 0 8px rgba(0, 255, 255, 0.2),
                  0 0 15px rgba(0, 255, 255, 0.4),
                  0 2px 4px rgba(0, 0, 0, 0.5)
                `,
              }}
            />
            
            {/* 投影仪镜头（圆形，发光） */}
            <motion.div
              className="absolute"
              style={{
                left: '50%',
                top: `${projectorHeight - 6}px`,
                width: '26px',
                height: '26px',
                transform: 'translateX(-50%)',
                background: 'radial-gradient(circle, rgba(0, 255, 255, 0.95), rgba(0, 255, 255, 0.4), rgba(0, 255, 255, 0.1))',
                borderRadius: '50%',
                border: '2px solid rgba(0, 255, 255, 0.7)',
                boxShadow: `
                  0 0 25px rgba(0, 255, 255, 0.9),
                  0 0 50px rgba(0, 255, 255, 0.5),
                  inset 0 0 12px rgba(0, 255, 255, 0.4),
                  inset 0 2px 4px rgba(0, 255, 255, 0.6)
                `,
              }}
              animate={{
                boxShadow: [
                  '0 0 25px rgba(0, 255, 255, 0.9), 0 0 50px rgba(0, 255, 255, 0.5), inset 0 0 12px rgba(0, 255, 255, 0.4), inset 0 2px 4px rgba(0, 255, 255, 0.6)',
                  '0 0 35px rgba(0, 255, 255, 1), 0 0 70px rgba(0, 255, 255, 0.7), inset 0 0 18px rgba(0, 255, 255, 0.6), inset 0 2px 6px rgba(0, 255, 255, 0.8)',
                  '0 0 25px rgba(0, 255, 255, 0.9), 0 0 50px rgba(0, 255, 255, 0.5), inset 0 0 12px rgba(0, 255, 255, 0.4), inset 0 2px 4px rgba(0, 255, 255, 0.6)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* 镜头内部光点（核心） */}
            <motion.div
              className="absolute"
              style={{
                left: '50%',
                top: `${projectorHeight - 6}px`,
                width: '10px',
                height: '10px',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, #00ffff, rgba(0, 255, 255, 0.3))',
                borderRadius: '50%',
                boxShadow: '0 0 20px #00ffff, 0 0 40px rgba(0, 255, 255, 0.6)',
              }}
              animate={{
                opacity: [0.7, 1, 0.7],
                scale: [0.9, 1.3, 0.9],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* 镜头内部光晕环 */}
            <motion.div
              className="absolute"
              style={{
                left: '50%',
                top: `${projectorHeight - 6}px`,
                width: '18px',
                height: '18px',
                transform: 'translate(-50%, -50%)',
                border: '1px solid rgba(0, 255, 255, 0.5)',
                borderRadius: '50%',
                boxShadow: '0 0 10px rgba(0, 255, 255, 0.6)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.6, 0.9, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* 投影仪侧边指示灯（左侧） */}
            <motion.div
              className="absolute"
              style={{
                left: '6px',
                top: '14px',
                width: '5px',
                height: '5px',
                background: '#00ffff',
                borderRadius: '50%',
                boxShadow: '0 0 10px #00ffff',
                clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)',
              }}
              animate={{
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* 投影仪侧边指示灯（右侧） */}
            <motion.div
              className="absolute"
              style={{
                right: '6px',
                top: '14px',
                width: '5px',
                height: '5px',
                background: '#00ffff',
                borderRadius: '50%',
                boxShadow: '0 0 10px #00ffff',
                clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)',
              }}
              animate={{
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: 0.6,
                ease: 'easeInOut',
              }}
            />
            
            {/* 底部装饰线条 */}
            <div
              className="absolute"
              style={{
                left: '10px',
                right: '10px',
                bottom: '2px',
                height: '1px',
                background: 'linear-gradient(to right, transparent, rgba(0, 255, 255, 0.6), transparent)',
                boxShadow: '0 0 4px rgba(0, 255, 255, 0.8)',
              }}
            />
            
            {/* 科技感扫描线效果 */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, rgba(0, 255, 255, 0.05) 50%, transparent 100%)',
                borderRadius: '6px 6px 3px 3px',
              }}
              animate={{
                backgroundPosition: ['0% 0%', '0% 100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </motion.div>

          {/* 投影仪光束效果（从投影仪镜头发射到HUD窗口中心，扇形扩散，最终覆盖整个HUD窗口） */}
          {laserProgress > 0 && (() => {
            // 计算扇形光束参数
            const beamLength = beamConfig.distance * laserProgress
            // 扇形角度（从0度逐渐增加到目标角度）
            const currentAngle = beamConfig.maxAngle * laserProgress // 当前扇形角度（根据进度）
            
            // 计算扇形在目标位置的高度（确保最终等于HUD窗口对角线）
            const targetHeight = Math.tan((currentAngle * Math.PI) / 180) * beamLength
            
            // 闪烁效果的随机延迟
            const flickerDelay = 0.1
            
            return (
              <motion.div
                key="single-beam"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed z-[201] pointer-events-none"
                style={{
                  left: `${beamConfig.sourcePoint.x}px`,
                  top: `${beamConfig.sourcePoint.y}px`,
                  transformOrigin: '0 0',
                  transform: `rotate(${beamConfig.angle}deg)`,
                }}
              >
                  {/* 扇形光束最外层光晕（超柔和，强虚化） */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      width: `${beamLength}px`,
                      height: `${targetHeight + 120}px`,
                      transform: 'translateY(-50%)',
                      background: `
                        radial-gradient(
                          ellipse ${currentAngle * 2.5}deg ${targetHeight * 1.2}px at 0% 50%,
                          rgba(0, 255, 255, 0.12) 0%,
                          rgba(0, 255, 255, 0.08) 20%,
                          rgba(0, 255, 255, 0.04) 50%,
                          rgba(0, 255, 255, 0.015) 80%,
                          transparent 100%
                        )
                      `,
                      clipPath: `polygon(
                        0 0,
                        ${beamLength}px ${targetHeight / 2 + 60}px,
                        ${beamLength}px ${-targetHeight / 2 - 60}px,
                        0 0
                      )`,
                      filter: 'blur(25px)',
                      zIndex: -2,
                    }}
                    animate={{
                      opacity: [0.4, 0.8, 0.5, 0.7, 0.4],
                    }}
                    transition={{
                      duration: 3 + flickerDelay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />

                  {/* 扇形光束外层光晕（柔和，强虚化） */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      width: `${beamLength}px`,
                      height: `${targetHeight + 80}px`,
                      transform: 'translateY(-50%)',
                      background: `
                        radial-gradient(
                          ellipse ${currentAngle * 2.2}deg ${targetHeight * 1.1}px at 0% 50%,
                          rgba(0, 255, 255, 0.18) 0%,
                          rgba(0, 255, 255, 0.12) 15%,
                          rgba(0, 255, 255, 0.08) 40%,
                          rgba(0, 255, 255, 0.04) 70%,
                          rgba(0, 255, 255, 0.01) 95%,
                          transparent 100%
                        )
                      `,
                      clipPath: `polygon(
                        0 0,
                        ${beamLength}px ${targetHeight / 2 + 40}px,
                        ${beamLength}px ${-targetHeight / 2 - 40}px,
                        0 0
                      )`,
                      filter: 'blur(18px)',
                      zIndex: -1,
                    }}
                    animate={{
                      opacity: [0.5, 0.9, 0.6, 0.85, 0.5],
                    }}
                    transition={{
                      duration: 2.5 + flickerDelay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />

                  {/* 扇形光束主体（超柔和边缘） */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      width: `${beamLength}px`,
                      height: `${targetHeight + 60}px`,
                      transform: 'translateY(-50%)',
                      background: `
                        radial-gradient(
                          ellipse ${currentAngle * 2}deg ${targetHeight}px at 0% 50%,
                          rgba(0, 255, 255, 0.4) 0%,
                          rgba(0, 255, 255, 0.32) 10%,
                          rgba(0, 255, 255, 0.24) 25%,
                          rgba(0, 255, 255, 0.16) 45%,
                          rgba(0, 255, 255, 0.1) 70%,
                          rgba(0, 255, 255, 0.05) 90%,
                          rgba(0, 255, 255, 0.01) 100%
                        )
                      `,
                      clipPath: `polygon(
                        0 0,
                        ${beamLength}px ${targetHeight / 2 + 30}px,
                        ${beamLength}px ${-targetHeight / 2 - 30}px,
                        0 0
                      )`,
                      filter: 'blur(10px)',
                      boxShadow: `
                        0 0 25px rgba(0, 255, 255, 0.25),
                        0 0 50px rgba(0, 255, 255, 0.12),
                        inset 0 0 40px rgba(0, 255, 255, 0.06)
                      `,
                    }}
                    animate={{
                      opacity: [0.6, 0.95, 0.75, 1, 0.65],
                    }}
                    transition={{
                      duration: 2 + flickerDelay * 0.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  {/* 扇形光束核心（更亮的中心区域，超柔和边缘） */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      width: `${beamLength}px`,
                      height: `${targetHeight * 0.45 + 25}px`,
                      transform: 'translateY(-50%)',
                      background: `
                        radial-gradient(
                          ellipse ${currentAngle * 1.3}deg ${targetHeight * 0.45}px at 0% 50%,
                          rgba(0, 255, 255, 0.6) 0%,
                          rgba(0, 255, 255, 0.45) 20%,
                          rgba(0, 255, 255, 0.3) 45%,
                          rgba(0, 255, 255, 0.18) 70%,
                          rgba(0, 255, 255, 0.08) 90%,
                          rgba(0, 255, 255, 0.02) 100%
                        )
                      `,
                      clipPath: `polygon(
                        0 0,
                        ${beamLength}px ${targetHeight * 0.225 + 12.5}px,
                        ${beamLength}px ${-targetHeight * 0.225 - 12.5}px,
                        0 0
                      )`,
                      filter: 'blur(5px)',
                      boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
                    }}
                    animate={{
                      opacity: [0.5, 0.9, 0.65, 0.95, 0.6],
                      scale: [1, 1.02, 0.99, 1.01, 1],
                    }}
                    transition={{
                      duration: 1.8 + flickerDelay * 0.3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  {/* 扇形光束最内层核心（最亮区域，超柔和边缘） */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      width: `${beamLength}px`,
                      height: `${targetHeight * 0.25 + 15}px`,
                      transform: 'translateY(-50%)',
                      background: `
                        radial-gradient(
                          ellipse ${currentAngle * 0.8}deg ${targetHeight * 0.25}px at 0% 50%,
                          rgba(0, 255, 255, 0.7) 0%,
                          rgba(0, 255, 255, 0.5) 30%,
                          rgba(0, 255, 255, 0.3) 60%,
                          rgba(0, 255, 255, 0.15) 85%,
                          rgba(0, 255, 255, 0.05) 100%
                        )
                      `,
                      clipPath: `polygon(
                        0 0,
                        ${beamLength}px ${targetHeight * 0.125 + 7.5}px,
                        ${beamLength}px ${-targetHeight * 0.125 - 7.5}px,
                        0 0
                      )`,
                      filter: 'blur(3px)',
                      boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)',
                    }}
                    animate={{
                      opacity: [0.4, 0.85, 0.6, 0.9, 0.5],
                    }}
                    transition={{
                      duration: 1.5 + flickerDelay * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  {/* 光束起始点（光源点） */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      left: 0,
                      top: '50%',
                      width: '6px',
                      height: '6px',
                      transform: 'translate(-50%, -50%)',
                      background: 'radial-gradient(circle, rgba(0, 255, 255, 1), rgba(0, 255, 255, 0.3))',
                      boxShadow: '0 0 15px rgba(0, 255, 255, 0.9), 0 0 30px rgba(0, 255, 255, 0.5)',
                      filter: 'blur(1px)',
                    }}
                    animate={{
                      scale: [0.8, 1.2, 1],
                      opacity: [0.6, 1, 0.8],
                    }}
                    transition={{
                      duration: 1.5 + flickerDelay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                
                {/* 光束中的尘埃/粒子效果（增强真实感，超柔和闪烁，强度逐步递减，扇形分布） */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const pos = (i / 8) * laserProgress
                  // 粒子在扇形中的位置（从中心到边缘）
                  const angleOffset = (Math.random() - 0.5) * currentAngle * 0.9
                  const offset = Math.tan((angleOffset * Math.PI) / 180) * beamLength * pos
                  const size = 0.4 + Math.random() * 0.8
                  // 粒子强度根据位置递减，更柔和
                  const baseOpacity = (0.1 + Math.random() * 0.08) * (1 - pos * 0.85)
                  return (
                    <motion.div
                      key={`dust-${i}`}
                      className="absolute rounded-full"
                      style={{
                        left: `${beamLength * pos}px`,
                        top: `calc(50% + ${offset}px)`,
                        width: `${size}px`,
                        height: `${size}px`,
                        transform: 'translate(-50%, -50%)',
                        background: `rgba(0, 255, 255, ${baseOpacity * 0.5})`,
                        filter: 'blur(1.5px)',
                        boxShadow: `0 0 ${size * 1.5}px rgba(0, 255, 255, ${baseOpacity * 0.4})`,
                      }}
                      animate={{
                        opacity: [0, baseOpacity * 1, baseOpacity * 0.4, baseOpacity * 0.8, 0],
                        scale: [0.1, 1, 0.8, 0.9, 0.5],
                      }}
                      transition={{
                        duration: 2.5 + Math.random() * 1.5,
                        repeat: Infinity,
                        delay: Math.random() * 2.5 + flickerDelay,
                        ease: 'easeInOut',
                      }}
                    />
                  )
                })}
              </motion.div>
            )
          })()}

          {/* 激光到达屏幕中心时的扩散效果 */}
          {laserProgress >= 0.5 && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="fixed z-[201] pointer-events-none rounded-full"
              style={{
                left: `${screenCenterX}px`,
                top: `${screenCenterY}px`,
                width: '100px',
                height: '100px',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, rgba(0, 255, 255, 0.8), transparent)',
                boxShadow: '0 0 50px rgba(0, 255, 255, 0.8)',
              }}
            />
          )}

          {/* HUD屏幕（从激光终点扫描形成） */}
          <motion.div
            initial={{ 
              opacity: 0,
              clipPath: 'circle(0% at 50% 50%)',
            }}
            animate={{ 
              opacity: laserProgress >= 0.5 ? 1 : 0,
              clipPath: laserProgress >= 0.5 
                ? 'circle(100% at 50% 50%)' 
                : `circle(${((laserProgress - 0.5) * 2 * 100)}% at 50% 50%)`,
            }}
            exit={{ 
              opacity: 0,
              clipPath: 'circle(0% at 50% 50%)',
            }}
            transition={{ 
              duration: 0.5,
              ease: 'easeOut',
            }}
            className="fixed z-[202]"
            style={{
              width: `${hudWidth}px`,
              height: `${hudHeight}px`,
              left: `${hudX}px`,
              top: `${hudY}px`,
            }}
          >
            {/* HUD主体 - 激光投影效果 */}
            <div
              className="relative w-full h-full"
              style={{
                background: 'rgba(0, 20, 40, 0.85)',
                backdropFilter: 'blur(6px)',
                border: '3px solid rgba(0, 255, 255, 0.8)',
                boxShadow: `
                  0 0 40px rgba(0, 255, 255, 0.8),
                  inset 0 0 40px rgba(0, 255, 255, 0.15),
                  0 0 80px rgba(0, 255, 255, 0.4)
                `,
              }}
            >
              {/* 激光扫描线效果 */}
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: `${scanLineY}%`,
                  height: '3px',
                  background: 'linear-gradient(to right, transparent, rgba(0, 255, 255, 1), transparent)',
                  boxShadow: '0 0 12px rgba(0, 255, 255, 1), 0 0 24px rgba(0, 255, 255, 0.6)',
                }}
              />
              
              {/* 像素网格背景（激光投影网格） */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0, 255, 255, 0.4) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 255, 255, 0.4) 1px, transparent 1px)
                  `,
                  backgroundSize: '15px 15px',
                }}
              />

              {/* 四角激光节点 */}
              {/* 左上角 */}
              <motion.div
                className="absolute -top-2 -left-2 w-5 h-5"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 15px #00ffff, 0 0 30px #00ffff',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              {/* 右上角 */}
              <motion.div
                className="absolute -top-2 -right-2 w-5 h-5"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 15px #00ffff, 0 0 30px #00ffff',
                  clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
                }}
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}
              />
              {/* 左下角 */}
              <motion.div
                className="absolute -bottom-2 -left-2 w-5 h-5"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 15px #00ffff, 0 0 30px #00ffff',
                  clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                }}
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 1,
                }}
              />
              {/* 右下角 */}
              <motion.div
                className="absolute -bottom-2 -right-2 w-5 h-5"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 15px #00ffff, 0 0 30px #00ffff',
                  clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                }}
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 1.5,
                }}
              />

              {/* 边框激光扫描效果 */}
              <motion.div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  height: '3px',
                  background: 'linear-gradient(to right, transparent, rgba(0, 255, 255, 1), transparent)',
                  boxShadow: '0 0 15px rgba(0, 255, 255, 1)',
                }}
                animate={{
                  top: ['0%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />

              {/* 标题栏 */}
              <div
                className="px-4 py-3 border-b"
                style={{
                  borderColor: 'rgba(0, 255, 255, 0.6)',
                  borderWidth: '0 0 1px 0',
                  background: 'rgba(0, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.span 
                      className="text-xs font-mono" 
                      style={{ color: '#00ffff', textShadow: '0 0 8px rgba(0, 255, 255, 0.8)' }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {'>'}
                    </motion.span>
                    <h2 className="text-sm font-mono font-bold" style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0, 255, 255, 1)' }}>
                      [ TRAINING ITEMS LIST ]
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-xs font-mono px-2 py-1 hover:bg-opacity-20 transition-colors"
                    style={{ color: '#00ffff', textShadow: '0 0 6px rgba(0, 255, 255, 0.8)' }}
                  >
                    [X] CLOSE
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-4 h-full overflow-y-auto" style={{ height: 'calc(100% - 50px)' }}>
                {trainingItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs font-mono" style={{ color: '#00ffff', opacity: 0.7, textShadow: '0 0 6px rgba(0, 255, 255, 0.8)' }}>
                      {'>'} NO ITEMS FOUND
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {trainingItems.map((item, index) => (
                      <Link
                        key={item.id}
                        href={`/training/${item.id}`}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onMouseLeave={() => setSelectedIndex(null)}
                        className="block px-3 py-2 font-mono text-xs transition-all cursor-pointer relative"
                        style={{
                          color: selectedIndex === index ? '#000000' : '#00ffff',
                          background: selectedIndex === index 
                            ? 'rgba(0, 255, 255, 0.9)' 
                            : 'transparent',
                          border: selectedIndex === index 
                            ? '1px solid rgba(0, 255, 255, 0.9)' 
                            : '1px solid transparent',
                          boxShadow: selectedIndex === index 
                            ? '0 0 20px rgba(0, 255, 255, 0.8), inset 0 0 10px rgba(0, 255, 255, 0.4)' 
                            : 'none',
                          fontFamily: 'monospace',
                          letterSpacing: '0.5px',
                          textShadow: selectedIndex === index ? 'none' : '0 0 6px rgba(0, 255, 255, 0.8)',
                        }}
                      >
                        {/* 选中时的激光光标效果 */}
                        {selectedIndex === index && (
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{
                              background: '#00ffff',
                              boxShadow: '0 0 12px #00ffff, 0 0 24px #00ffff',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <span 
                            style={{ 
                              color: selectedIndex === index ? '#000000' : '#00ffff',
                            }}
                          >
                            {'>'}
                          </span>
                          <span className="flex-1 truncate">
                            {item.title}
                          </span>
                          <span 
                            className="text-xs opacity-60"
                            style={{ 
                              color: selectedIndex === index ? '#000000' : '#00ffff',
                            }}
                          >
                            [{item.sentences.length}]
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 底部状态栏 */}
              <div
                className="absolute bottom-0 left-0 right-0 px-4 py-2 border-t text-xs font-mono"
                style={{
                  borderColor: 'rgba(0, 255, 255, 0.6)',
                  borderWidth: '1px 0 0 0',
                  color: '#00ffff',
                  background: 'rgba(0, 255, 255, 0.08)',
                  textShadow: '0 0 6px rgba(0, 255, 255, 0.8)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span>{'>'} ITEMS: {trainingItems.length}</span>
                  <span>PRESS [ESC] TO CLOSE</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
