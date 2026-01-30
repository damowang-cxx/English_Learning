'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
  twinklePhase: number
  color: string
}

export default function StarBackground() {
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

    // 创建星星数组
    const stars: Star[] = []
    const starCount = 100 // 适中的星星数量，更正式

    // 星空星星的颜色（更正式，主要使用白色和淡蓝色）
    const starColors = [
      '#ffffff', // 纯白色（主要）
      '#f0f4ff', // 极淡蓝色
      '#ffffff', // 更多白色
      '#e8f0ff', // 淡蓝白
      '#ffffff', // 更多白色
    ]

    // 初始化星星（更正式、均匀的分布）
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 0.4 + 0.3, // 0.3-0.7，统一较小的尺寸
        brightness: Math.random() * 0.15 + 0.2, // 初始亮度 0.2-0.35，更稳定
        twinkleSpeed: Math.random() * 0.01 + 0.005, // 更慢的闪烁速度，更正式
        twinklePhase: Math.random() * Math.PI * 2, // 初始相位
        color: starColors[Math.floor(Math.random() * starColors.length)]
      })
    }

    // 绘制星星（真实的远处星星效果）
    const drawStar = (star: Star) => {
      if (!ctx) return

      // 计算边缘闪烁强度（更轻微、更正式的闪烁）
      const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.twinklePhase) * 0.15 + 0.85
      const coreBrightness = star.brightness * 0.85 // 核心亮度更稳定
      const edgeBrightness = star.brightness * twinkle * 0.9 // 边缘轻微闪烁

      // 绘制星星核心（圆点，亮度稳定，更正式）
      const coreRadius = Math.max(star.size * 0.4, 0.35)
      ctx.beginPath()
      ctx.arc(star.x, star.y, coreRadius, 0, Math.PI * 2)
      ctx.fillStyle = star.color + Math.floor(coreBrightness * 255).toString(16).padStart(2, '0')
      ctx.fill()

      // 绘制边缘光晕（轻微闪烁，更subtle）
      const glowRadius = star.size * 1.3 // 减小光晕范围
      const gradient = ctx.createRadialGradient(
        star.x, star.y, coreRadius,
        star.x, star.y, glowRadius
      )
      // 从核心到边缘的渐变，更subtle
      gradient.addColorStop(0, star.color + Math.floor(coreBrightness * 255).toString(16).padStart(2, '0'))
      gradient.addColorStop(0.5, star.color + Math.floor(edgeBrightness * 0.5 * 255).toString(16).padStart(2, '0'))
      gradient.addColorStop(1, star.color + '00')

      ctx.beginPath()
      ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // 移除十字星光效果，让星星更正式简洁
    }

    // 动画循环
    const animate = () => {
      if (!ctx) return

      // 清除画布（保持透明）
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制所有星星
      stars.forEach((star) => {
        drawStar(star)
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
        zIndex: 0
      }}
    />
  )
}
