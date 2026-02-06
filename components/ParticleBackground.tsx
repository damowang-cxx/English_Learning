'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  z: number // 深度（z轴）
  size: number
  speed: number
  color: string
  trail: Array<{ x: number; y: number; z: number }> // 轨迹点
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布大小
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // 创建粒子数组
    const particles: Particle[] = []
    const particleCount = 250 // 适中的粒子数量
    
    // 星空星星的颜色（主要颜色，占80%）
    const starColors = [
      '#ffffff', // 纯白色星星
      '#e8f4ff', // 淡蓝色星星
      '#fff8e8', // 淡黄色星星
      '#f0f0ff', // 淡紫色星星
      '#ffe8e8', // 淡红色星星
      '#e8ffe8', // 淡绿色星星
      '#ffffff', // 更多白色
      '#ddeeff', // 淡蓝白
    ]
    
    // 变淡的彩色粒子（点缀颜色，占20%）
    const accentColors = [
      '#88ccff', // 淡青色
      '#ff88cc', // 淡粉红
      '#ccff88', // 淡黄绿
      '#ffcc88', // 淡橙黄
      '#cc88ff', // 淡紫色
    ]
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // 初始化粒子 - 随机分布在3D空间中
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * Math.max(canvas.width, canvas.height) * 1.2
      
      // 80%概率使用星星颜色，20%概率使用彩色点缀
      const useStarColor = Math.random() < 0.8
      const colorPalette = useStarColor ? starColors : accentColors
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
      
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        z: Math.random() * 3000 + 100, // 初始深度范围更大
        size: Math.random() * 2.0 + 0.5, // 增大粒子大小：0.5-2.5
        speed: Math.random() * 20 + 15, // 更快的飞行速度
        color: color,
        trail: []
      })
    }

    // 将3D坐标转换为2D屏幕坐标（透视投影）
    const project3D = (x: number, y: number, z: number) => {
      const fov = 1000 // 视场
      const scale = fov / (fov + z)
      return {
        x: centerX + (x - centerX) * scale,
        y: centerY + (y - centerY) * scale,
        scale: scale
      }
    }

    // 绘制粒子及其轨迹
    const drawParticle = (particle: Particle) => {
      if (!ctx) return

      const projected = project3D(particle.x, particle.y, particle.z)
      const size = particle.size * projected.scale

      // 绘制轨迹拖尾（更真实的速度线效果）
      if (particle.trail.length > 1) {
        // 绘制分段轨迹，每段逐渐变细变淡，更真实
        for (let i = 0; i < particle.trail.length - 1; i++) {
          const point1 = particle.trail[i]
          const point2 = particle.trail[i + 1]
          const proj1 = project3D(point1.x, point1.y, point1.z)
          const proj2 = project3D(point2.x, point2.y, point2.z)
          
          const x1 = centerX + (point1.x - centerX) * proj1.scale
          const y1 = centerY + (point1.y - centerY) * proj1.scale
          const x2 = centerX + (point2.x - centerX) * proj2.scale
          const y2 = centerY + (point2.y - centerY) * proj2.scale
          
          // 根据在轨迹中的位置计算透明度（越靠近当前粒子越亮）
          const progress = i / (particle.trail.length - 1)
          // 提高透明度，让轨迹更清晰可见
          const alpha = Math.min(projected.scale * 0.5 * (1 - progress * 0.6), 0.5)
          
          // 根据深度计算线条宽度（越近越粗）
          const lineWidth = Math.max(size * 0.5 * (1 - progress * 0.4), 0.4)
          
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.strokeStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
          ctx.lineWidth = lineWidth
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

      // 绘制粒子主体（只在足够近时绘制，减小大小和亮度）
      // 调整阈值，让穿梭的粒子更明显
      if (projected.scale > 0.2) {
        const gradient = ctx.createRadialGradient(
          projected.x, projected.y, 0,
          projected.x, projected.y, size * 2
        )
        // 提高粒子亮度，让穿梭效果更清晰
        const alpha = Math.min(projected.scale * 0.7, 0.7) // 提高穿梭粒子的可见度
        gradient.addColorStop(0, particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'))
        gradient.addColorStop(0.4, particle.color + Math.floor(alpha * 0.6 * 255).toString(16).padStart(2, '0'))
        gradient.addColorStop(1, particle.color + '00')

        ctx.beginPath()
        ctx.arc(projected.x, projected.y, size * 1.0, 0, Math.PI * 2) // 增大粒子半径
        ctx.fillStyle = gradient
        ctx.fill()

        // 适度的光晕效果
        ctx.shadowBlur = size * 1.5
        ctx.shadowColor = particle.color
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // 动画循环
    const animate = () => {
      if (!ctx) return

      // 不使用背景填充，让拖尾效果更清晰
      // 直接清除画布，通过粒子轨迹的自然衰减来创造拖尾效果
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        // 更新粒子位置 - 向屏幕外移动（z值减小）
        particle.z -= particle.speed

        // 添加当前位置到轨迹（每2帧添加一次，让轨迹更平滑）
        if (particle.trail.length === 0 || Math.random() > 0.3) {
          particle.trail.push({
            x: particle.x,
            y: particle.y,
            z: particle.z
          })
        }

        // 限制轨迹长度（缩短拖尾，更真实）
        const maxTrailLength = Math.floor(particle.speed / 5) + 3 // 从+5改为+3，从/3改为/5
        if (particle.trail.length > maxTrailLength) {
          particle.trail.shift()
        }

        // 如果粒子飞出视野，重新初始化到后方
        if (particle.z < 0) {
          const angle = Math.random() * Math.PI * 2
          const radius = Math.random() * Math.max(canvas.width, canvas.height) * 1.2
          particle.x = centerX + Math.cos(angle) * radius
          particle.y = centerY + Math.sin(angle) * radius
          particle.z = 3000 + Math.random() * 1000 // 重新初始化到更远的距离
          particle.trail = []
          // 随机改变速度和大小，增加变化
          particle.speed = Math.random() * 20 + 15
          particle.size = Math.random() * 2.0 + 0.5 // 重新随机大小，增大范围
          
          // 重新随机颜色（保持80%星星色，20%彩色）
          const useStarColor = Math.random() < 0.8
          const starColors = [
            '#ffffff', '#e8f4ff', '#fff8e8', '#f0f0ff', '#ffe8e8', '#e8ffe8', '#ffffff', '#ddeeff'
          ]
          const accentColors = [
            '#88ccff', '#ff88cc', '#ccff88', '#ffcc88', '#cc88ff'
          ]
          const colorPalette = useStarColor ? starColors : accentColors
          particle.color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
        }

        // 绘制粒子
        drawParticle(particle)
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ 
        background: 'transparent',
        zIndex: 1
      }}
    />
  )
}
