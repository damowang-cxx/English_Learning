'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HudScreen from './HudScreen'

interface TrainingItem {
  id: string
  title: string
  createdAt: string | Date
  sentences: { id: string }[]
}

export default function CockpitOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const router = useRouter()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHoveringUpload, setIsHoveringUpload] = useState(false)
  const [isHoveringList, setIsHoveringList] = useState(false)
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [listButtonPosition, setListButtonPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isHudOpen, setIsHudOpen] = useState(false)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([])

  // 获取训练条目数据
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/training-items')
        if (response.ok) {
          const data = await response.json()
          setTrainingItems(data)
        }
      } catch (error) {
        console.error('Failed to fetch training items:', error)
      }
    }
    fetchItems()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置像素完美的渲染
    const setPixelPerfect = () => {
      const dpr = window.devicePixelRatio || 1
      // 使用窗口尺寸而不是getBoundingClientRect，确保覆盖整个视口
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
    }

    setPixelPerfect()

    // 绘制复杂科技感驾驶舱
    const drawCockpit = (time: number) => {
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      
      // 添加 roundRect 方法的 polyfill（如果浏览器不支持）
      if (!ctx.roundRect) {
        ctx.roundRect = function(x: number, y: number, w: number, h: number, r: number) {
          if (w < 2 * r) r = w / 2
          if (h < 2 * r) r = h / 2
          this.beginPath()
          this.moveTo(x + r, y)
          this.arcTo(x + w, y, x + w, y + h, r)
          this.arcTo(x + w, y + h, x, y + h, r)
          this.arcTo(x, y + h, x, y, r)
          this.arcTo(x, y, x + w, y, r)
          this.closePath()
        }
      }

      // 绘制驾驶舱内部背景（深色金属质感）
      const cockpitColor = '#0a0a1a'
      const panelColor = '#1a1a2e'
      const accentColor1 = '#ff1493' // 粉红色
      const accentColor2 = '#00ffff' // 青色
      const accentColor3 = '#ff8c00' // 橙色

      // 三段式窗口结构参数
      const centerX = width / 2
      
      // 上段：倒梯形顶舱（包含左右三角形窗口区域）
      const topSectionTop = 0
      const topSectionBottom = height * 0.25 // 上段底部位置
      const topSectionHeight = topSectionBottom - topSectionTop
      
      // 中段：长方形主窗口区域
      const middleSectionTop = topSectionBottom
      const middleSectionBottom = height * 0.65 // 中段底部位置
      const middleSectionHeight = middleSectionBottom - middleSectionTop
      
      // 下段：操控面板
      const bottomSectionTop = middleSectionBottom
      const bottomSectionBottom = height
      const bottomSectionHeight = bottomSectionBottom - bottomSectionTop
      
      // 上段倒梯形参数
      const topTrapezoidTopWidth = width * 0.3 // 顶部宽度（窄）
      const topTrapezoidBottomWidth = width * 0.85 // 底部宽度（宽）
      const topTrapezoidTopLeft = centerX - topTrapezoidTopWidth / 2
      const topTrapezoidTopRight = centerX + topTrapezoidTopWidth / 2
      const topTrapezoidBottomLeft = centerX - topTrapezoidBottomWidth / 2
      const topTrapezoidBottomRight = centerX + topTrapezoidBottomWidth / 2
      
      // 中段长方形窗口参数
      const middleWindowWidth = width * 0.85
      const middleWindowLeft = centerX - middleWindowWidth / 2
      const middleWindowRight = centerX + middleWindowWidth / 2
      
      // 上段左右三角形窗口参数（剩余区域）
      const triangleWindowWidth = (width - middleWindowWidth) / 2 // 左右各一个三角形
      const leftTriangleRight = middleWindowLeft // 左三角形右边界
      const rightTriangleLeft = middleWindowRight // 右三角形左边界
      
      // 控制面板参数（下段）
      const panelTop = bottomSectionTop
      const panelHeight = bottomSectionHeight
      const panelWidth = width * 0.85
      const panelLeft = centerX - panelWidth / 2
      
      const centerY = (middleSectionTop + middleSectionBottom) / 2 // 中段中心Y位置

      // 清除画布
      ctx.clearRect(0, 0, width, height)
      
      // 先填充整个背景（深色驾驶舱内部）
      ctx.fillStyle = cockpitColor
      ctx.fillRect(0, 0, width, height)
      
      // 注意：窗口清除操作会在所有舱壁绘制完成后执行，让窗口区域显示底层星空背景

      // 绘制顶部面板区域（梯形，从顶部向下延伸）
      const topPanelTop = 0
      const topPanelBottom = topSectionBottom // 使用新的三段式结构变量
      const topPanelTopWidth = width
      const topPanelBottomWidth = width * 0.85  // 底部较窄，形成梯形
      
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, topPanelTop)
      ctx.lineTo(width, topPanelTop)
      ctx.lineTo(centerX + topPanelBottomWidth / 2, topPanelBottom)
      ctx.lineTo(centerX - topPanelBottomWidth / 2, topPanelBottom)
      ctx.closePath()
      
      const topPanelGradient = ctx.createLinearGradient(0, topPanelTop, 0, topPanelBottom)
      topPanelGradient.addColorStop(0, '#2a0a3a')
      topPanelGradient.addColorStop(0.5, '#150520')
      topPanelGradient.addColorStop(1, '#0a0210')
      ctx.fillStyle = topPanelGradient
      ctx.fill()
      
      // 顶部面板边框
      ctx.strokeStyle = '#4a00e0'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.restore()

      // 顶部装饰线条和细节（在顶部面板内）
      for (let i = 0; i < 5; i++) {
        const t = i / 5
        const y = topPanelTop + (topPanelBottom - topPanelTop) * (0.3 + t * 0.5)
        const lineLeftX = (width - topPanelBottomWidth) / 2 + topPanelBottomWidth * 0.1
        const lineRightX = (width + topPanelBottomWidth) / 2 - topPanelBottomWidth * 0.1
        const currentLeftX = (width - topPanelBottomWidth) / 2 + (topPanelBottomWidth * 0.1) * (1 - t)
        const currentRightX = (width + topPanelBottomWidth) / 2 - (topPanelBottomWidth * 0.1) * (1 - t)
        
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3 - i * 0.05
        ctx.beginPath()
        ctx.moveTo(currentLeftX, y)
        ctx.lineTo(currentRightX, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 顶部状态指示灯（在顶部面板底部）
      const indicatorSpacing = topPanelBottomWidth / 12
      const indicatorStartX = centerX - topPanelBottomWidth / 2
      for (let i = 0; i < 12; i++) {
        const x = indicatorStartX + indicatorSpacing * i + indicatorSpacing / 2
        const y = topPanelBottom - 10
        const isActive = Math.sin(time * 0.001 + i) > 0
        
        ctx.fillStyle = isActive ? accentColor2 : '#333344'
        ctx.fillRect(x - 4, y - 4, 8, 8)
        
        if (isActive) {
          ctx.shadowBlur = 8
          ctx.shadowColor = accentColor2
          ctx.fillRect(x - 4, y - 4, 8, 8)
          ctx.shadowBlur = 0
        }
      }

      // ========== 绘制顶部悬挂装置和灯光系统 ==========
      const warmLightColor = '#ff8c40'  // 暖橙色
      const warmLightColorBright = '#ffb366'  // 亮暖黄色
      
      // 1. 绘制吊顶结构（在状态指示灯上方）
      ctx.save()
      const ceilingStructureY = topPanelBottom - 25  // 使用 topPanelBottom 替代 topPanelHeight
      const ceilingThickness = 8
      
      // 吊顶主体（深色金属）
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, ceilingStructureY, width, ceilingThickness)
      
      // 吊顶边框（金属质感）
      ctx.strokeStyle = '#2d1b4e'
      ctx.lineWidth = 2
      ctx.strokeRect(0, ceilingStructureY, width, ceilingThickness)
      
      // 吊顶内部装饰线条
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(0, ceilingStructureY + ceilingThickness / 2)
      ctx.lineTo(width, ceilingStructureY + ceilingThickness / 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.restore()
      
      // 2. 绘制悬挂灯具（像素风格，3个主要灯具）
      const lampCount = 3
      const lampSpacing = width / (lampCount + 1)
      const lampSwingAmplitude = 2  // 摇摆幅度
      const lampSwingSpeed = 0.0008  // 摇摆速度
      
      for (let i = 0; i < lampCount; i++) {
        const lampX = lampSpacing * (i + 1)
        const baseLampY = ceilingStructureY + ceilingThickness + 15
        // 摇摆效果（轻微晃动）
        const swingOffset = Math.sin(time * lampSwingSpeed + i * Math.PI / 3) * lampSwingAmplitude
        const lampY = baseLampY + swingOffset
        
        ctx.save()
        
        // 2.1 绘制悬挂电缆
        const cableLength = 25
        ctx.strokeStyle = '#2d1b4e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(lampX, ceilingStructureY + ceilingThickness)
        ctx.lineTo(lampX, lampY)
        ctx.stroke()
        
        // 电缆高光
        ctx.strokeStyle = '#3a3a5a'
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.moveTo(lampX - 0.5, ceilingStructureY + ceilingThickness)
        ctx.lineTo(lampX - 0.5, lampY)
        ctx.stroke()
        ctx.globalAlpha = 1
        
        // 2.2 绘制灯具主体（像素风格设备盒）
        const lampWidth = 24
        const lampHeight = 18
        const lampXPos = lampX - lampWidth / 2
        const lampYPos = lampY
        
        // 灯具外壳（深色金属）
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(lampXPos, lampYPos, lampWidth, lampHeight)
        
        // 灯具边框（金属质感）
        ctx.strokeStyle = '#2d1b4e'
        ctx.lineWidth = 2
        ctx.strokeRect(lampXPos, lampYPos, lampWidth, lampHeight)
        
        // 灯具内边框（高光）
        ctx.strokeStyle = '#3a3a5a'
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.6
        ctx.strokeRect(lampXPos + 1, lampYPos + 1, lampWidth - 2, lampHeight - 2)
        ctx.globalAlpha = 1
        
        // 2.3 绘制光源（周期性闪烁）
        const lightIntensity = 0.5 + Math.sin(time * 0.002 + i * 0.5) * 0.4  // 闪烁效果
        const lightAlpha = lightIntensity * 0.9
        
        // 光源主体（暖橙色）
        ctx.fillStyle = warmLightColor
        ctx.globalAlpha = lightAlpha
        ctx.fillRect(lampXPos + 4, lampYPos + 4, lampWidth - 8, lampHeight - 8)
        
        // 光源高光（亮暖黄色）
        ctx.fillStyle = warmLightColorBright
        ctx.globalAlpha = lightAlpha * 0.6
        ctx.fillRect(lampXPos + 6, lampYPos + 6, lampWidth - 12, lampHeight - 12)
        ctx.globalAlpha = 1
        
        // 光源像素点（模拟LED）
        const pixelSize = 2
        const pixelSpacing = 4
        ctx.fillStyle = warmLightColorBright
        ctx.globalAlpha = lightAlpha
        for (let px = 0; px < 3; px++) {
          for (let py = 0; py < 2; py++) {
            const pixelX = lampXPos + 6 + px * pixelSpacing
            const pixelY = lampYPos + 6 + py * pixelSpacing
            ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize)
          }
        }
        ctx.globalAlpha = 1
        
        // 2.4 绘制光柱（从灯具向下照射）
        const lightBeamLength = 80
        const lightBeamWidth = lampWidth * 1.2
        const lightBeamY = lampYPos + lampHeight
        
        // 光柱渐变（从亮到暗）
        const beamGradient = ctx.createLinearGradient(
          lampX, lightBeamY,
          lampX, lightBeamY + lightBeamLength
        )
        beamGradient.addColorStop(0, `rgba(255, 140, 64, ${lightAlpha * 0.3})`)  // 暖橙色
        beamGradient.addColorStop(0.3, `rgba(255, 140, 64, ${lightAlpha * 0.15})`)
        beamGradient.addColorStop(0.7, `rgba(255, 140, 64, ${lightAlpha * 0.05})`)
        beamGradient.addColorStop(1, 'rgba(255, 140, 64, 0)')
        
        ctx.fillStyle = beamGradient
        ctx.beginPath()
        ctx.moveTo(lampX - lightBeamWidth / 2, lightBeamY)
        ctx.lineTo(lampX + lightBeamWidth / 2, lightBeamY)
        ctx.lineTo(lampX + lightBeamWidth / 2 * 0.8, lightBeamY + lightBeamLength)
        ctx.lineTo(lampX - lightBeamWidth / 2 * 0.8, lightBeamY + lightBeamLength)
        ctx.closePath()
        ctx.fill()
        
        // 光柱中心高亮线
        ctx.strokeStyle = warmLightColorBright
        ctx.lineWidth = 1
        ctx.globalAlpha = lightAlpha * 0.4
        ctx.beginPath()
        ctx.moveTo(lampX, lightBeamY)
        ctx.lineTo(lampX, lightBeamY + lightBeamLength)
        ctx.stroke()
        ctx.globalAlpha = 1
        
        // 2.5 绘制灯具投影（增加立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.beginPath()
        ctx.moveTo(lampXPos + lampWidth, lampYPos + lampHeight)
        ctx.lineTo(lampXPos + lampWidth + 3, lampYPos + lampHeight + 5)
        ctx.lineTo(lampXPos + lampWidth + 3, lightBeamY + lightBeamLength)
        ctx.lineTo(lampXPos + lampWidth, lightBeamY + lightBeamLength)
        ctx.closePath()
        ctx.fill()
        
        // 2.6 绘制灯具上的小型控制元件
        ctx.fillStyle = accentColor2
        ctx.globalAlpha = 0.6 + Math.sin(time * 0.003 + i) * 0.3
        ctx.fillRect(lampXPos + lampWidth - 6, lampYPos + 2, 3, 3)
        ctx.globalAlpha = 1
        
        ctx.restore()
      }
      
      // 3. 绘制额外的悬挂设备盒（在指示灯附近）
      const deviceBoxCount = 2
      const deviceBoxSpacing = width / (deviceBoxCount + 1)
      
      for (let i = 0; i < deviceBoxCount; i++) {
        const boxX = deviceBoxSpacing * (i + 1)
        const boxY = ceilingStructureY + ceilingThickness + 8
        const boxWidth = 16
        const boxHeight = 12
        
        ctx.save()
        
        // 3.1 悬挂点
        ctx.fillStyle = '#2d1b4e'
        ctx.beginPath()
        ctx.arc(boxX, ceilingStructureY + ceilingThickness, 2, 0, Math.PI * 2)
        ctx.fill()
        
        // 3.2 设备盒主体
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(boxX - boxWidth / 2, boxY, boxWidth, boxHeight)
        
        // 设备盒边框
        ctx.strokeStyle = '#2d1b4e'
        ctx.lineWidth = 1.5
        ctx.strokeRect(boxX - boxWidth / 2, boxY, boxWidth, boxHeight)
        
        // 设备盒内边框
        ctx.strokeStyle = '#3a3a5a'
        ctx.lineWidth = 0.5
        ctx.globalAlpha = 0.5
        ctx.strokeRect(boxX - boxWidth / 2 + 1, boxY + 1, boxWidth - 2, boxHeight - 2)
        ctx.globalAlpha = 1
        
        // 3.3 设备盒上的指示灯
        const indicatorColor = Math.sin(time * 0.002 + i) > 0 ? accentColor2 : '#333344'
        ctx.fillStyle = indicatorColor
        ctx.fillRect(boxX - 3, boxY + 3, 6, 4)
        
        // 3.4 设备盒投影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.fillRect(boxX - boxWidth / 2 + 2, boxY + boxHeight, boxWidth - 4, 3)
        
        ctx.restore()
      }
      
      // 4. 绘制顶部区域的整体投影（增强空间层次感）
      ctx.save()
      const shadowGradient = ctx.createLinearGradient(0, ceilingStructureY + ceilingThickness, 0, ceilingStructureY + ceilingThickness + 30)
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)')
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = shadowGradient
      ctx.fillRect(0, ceilingStructureY + ceilingThickness, width, 30)
      ctx.restore()

      // ========== 绘制三段式窗口结构（曲线连接，自然融合） ==========
      ctx.save()
      
      // 计算曲线控制点（用于平滑连接）
      const curveControlOffset = 30 // 曲线控制点偏移量
      
      // 1. 绘制窗口框架线条（使用曲线连接，让过渡更自然）
      ctx.strokeStyle = accentColor1 // 品红色主框架
      ctx.lineWidth = 4
      ctx.shadowBlur = 10
      ctx.shadowColor = accentColor1
      ctx.globalAlpha = 0.9
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      // 垂直分割线（将中段长方形分成左右两部分，使用曲线）
      const verticalDividerX = centerX
      ctx.beginPath()
      ctx.moveTo(verticalDividerX, middleSectionTop)
      // 使用二次贝塞尔曲线，让线条更柔和
      ctx.quadraticCurveTo(verticalDividerX, middleSectionTop + middleSectionHeight * 0.3, verticalDividerX, (middleSectionTop + middleSectionBottom) / 2)
      ctx.quadraticCurveTo(verticalDividerX, middleSectionBottom - middleSectionHeight * 0.3, verticalDividerX, middleSectionBottom)
      ctx.stroke()
      
      // 水平分割线（将中段长方形分成上下两部分，使用曲线）
      const horizontalDividerY = (middleSectionTop + middleSectionBottom) / 2
      ctx.beginPath()
      ctx.moveTo(middleWindowLeft, horizontalDividerY)
      // 使用二次贝塞尔曲线
      ctx.quadraticCurveTo(middleWindowLeft + middleWindowWidth * 0.3, horizontalDividerY, centerX, horizontalDividerY)
      ctx.quadraticCurveTo(middleWindowRight - middleWindowWidth * 0.3, horizontalDividerY, middleWindowRight, horizontalDividerY)
      ctx.stroke()
      
      // 连接上段三角形和中段长方形的曲线（左侧）
      // 左上角到中段左侧（曲线）
      ctx.beginPath()
      ctx.moveTo(topTrapezoidTopLeft, topSectionTop)
      // 使用二次贝塞尔曲线，控制点在中间偏下
      ctx.quadraticCurveTo(
        (topTrapezoidTopLeft + middleWindowLeft) / 2, 
        topSectionTop + (middleSectionTop - topSectionTop) * 0.6,
        middleWindowLeft, 
        middleSectionTop
      )
      ctx.stroke()
      
      // 左下角到中段左侧（曲线）
      ctx.beginPath()
      ctx.moveTo(topTrapezoidBottomLeft, topSectionBottom)
      ctx.quadraticCurveTo(
        (topTrapezoidBottomLeft + middleWindowLeft) / 2,
        topSectionBottom + (middleSectionTop - topSectionBottom) * 0.4,
        middleWindowLeft,
        middleSectionTop
      )
      ctx.stroke()
      
      // 连接上段三角形和中段长方形的曲线（右侧）
      // 右上角到中段右侧（曲线）
      ctx.beginPath()
      ctx.moveTo(topTrapezoidTopRight, topSectionTop)
      ctx.quadraticCurveTo(
        (topTrapezoidTopRight + middleWindowRight) / 2,
        topSectionTop + (middleSectionTop - topSectionTop) * 0.6,
        middleWindowRight,
        middleSectionTop
      )
      ctx.stroke()
      
      // 右下角到中段右侧（曲线）
      ctx.beginPath()
      ctx.moveTo(topTrapezoidBottomRight, topSectionBottom)
      ctx.quadraticCurveTo(
        (topTrapezoidBottomRight + middleWindowRight) / 2,
        topSectionBottom + (middleSectionTop - topSectionBottom) * 0.4,
        middleWindowRight,
        middleSectionTop
      )
      ctx.stroke()
      
      // 内层框架线条（青色，增强视觉效果，也使用曲线）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 6
      ctx.shadowColor = accentColor2
      ctx.globalAlpha = 0.7
      
      // 内层垂直分割线（曲线）
      ctx.beginPath()
      ctx.moveTo(verticalDividerX, middleSectionTop + 5)
      ctx.quadraticCurveTo(verticalDividerX, horizontalDividerY, verticalDividerX, middleSectionBottom - 5)
      ctx.stroke()
      
      // 内层水平分割线（曲线）
      ctx.beginPath()
      ctx.moveTo(middleWindowLeft + 5, horizontalDividerY)
      ctx.quadraticCurveTo(centerX, horizontalDividerY, middleWindowRight - 5, horizontalDividerY)
      ctx.stroke()
      
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      
      // 2. 绘制窗口边框（只绘制边框，不填充背景，因为窗口需要透明）
      // 上段倒梯形边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.moveTo(topTrapezoidTopLeft, topSectionTop)
      ctx.lineTo(topTrapezoidTopRight, topSectionTop)
      ctx.lineTo(topTrapezoidBottomRight, topSectionBottom)
      ctx.lineTo(topTrapezoidBottomLeft, topSectionBottom)
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 中段长方形边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.strokeRect(middleWindowLeft, middleSectionTop, middleWindowWidth, middleSectionHeight)
      ctx.shadowBlur = 0
      
      // 左三角形边框（曲线连接）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.moveTo(0, topSectionTop)
      // 使用曲线连接到中段
      ctx.quadraticCurveTo(
        middleWindowLeft * 0.5,
        topSectionTop + (middleSectionTop - topSectionTop) * 0.7,
        middleWindowLeft,
        middleSectionTop
      )
      // 连接到倒梯形底部
      ctx.quadraticCurveTo(
        (middleWindowLeft + topTrapezoidBottomLeft) / 2,
        (middleSectionTop + topSectionBottom) / 2,
        topTrapezoidBottomLeft,
        topSectionBottom
      )
      ctx.lineTo(topTrapezoidTopLeft, topSectionTop)
      ctx.closePath()
      ctx.stroke()
      
      // 右三角形边框（曲线连接）
      ctx.beginPath()
      ctx.moveTo(width, topSectionTop)
      ctx.quadraticCurveTo(
        middleWindowRight + (width - middleWindowRight) * 0.5,
        topSectionTop + (middleSectionTop - topSectionTop) * 0.7,
        middleWindowRight,
        middleSectionTop
      )
      ctx.quadraticCurveTo(
        (middleWindowRight + topTrapezoidBottomRight) / 2,
        (middleSectionTop + topSectionBottom) / 2,
        topTrapezoidBottomRight,
        topSectionBottom
      )
      ctx.lineTo(topTrapezoidTopRight, topSectionTop)
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0
      
      ctx.restore()
      
      // 保存窗口边界用于清除操作
      // 需要清除的区域包括：上段左右三角形 + 中段长方形
      const windowLeft = 0 // 左三角形左边界
      const windowRight = width // 右三角形右边界
      const windowTopY = topSectionTop
      const windowBottomY = middleSectionBottom

      // ========== 控制面板（保留原有功能） ==========
      // 控制面板参数已在顶部定义，这里直接使用
      // panelTop, panelHeight, panelWidth, panelLeft 已在顶部定义

      // 控制面板背景
      ctx.fillStyle = panelColor
      ctx.fillRect(panelLeft, panelTop, panelWidth, panelHeight)

      // 控制面板边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.strokeRect(panelLeft, panelTop, panelWidth, panelHeight)
      ctx.shadowBlur = 0

      // 控制面板内边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.strokeRect(panelLeft + 2, panelTop + 2, panelWidth - 4, panelHeight - 4)
      
      // 控制面板内部装饰线条（水平分隔线）
      const panelDividerY1 = panelTop + panelHeight * 0.3
      const panelDividerY2 = panelTop + panelHeight * 0.7
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.moveTo(panelLeft + 10, panelDividerY1)
      ctx.lineTo(panelLeft + panelWidth - 10, panelDividerY1)
      ctx.moveTo(panelLeft + 10, panelDividerY2)
      ctx.lineTo(panelLeft + panelWidth - 10, panelDividerY2)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // 控制面板内部装饰线条（垂直分隔线）
      const panelDividerX1 = panelLeft + panelWidth * 0.3
      const panelDividerX2 = panelLeft + panelWidth * 0.7
      ctx.strokeStyle = accentColor2
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.moveTo(panelDividerX1, panelTop + 10)
      ctx.lineTo(panelDividerX1, panelTop + panelHeight - 10)
      ctx.moveTo(panelDividerX2, panelTop + 10)
      ctx.lineTo(panelDividerX2, panelTop + panelHeight - 10)
      ctx.stroke()
      ctx.globalAlpha = 1

      // 左侧区域：按钮组和开关
      const leftSectionWidth = panelWidth * 0.3
      const leftSectionX = panelLeft + 15
      const leftSectionY = panelTop + 15
      
      // 左侧按钮组（不同大小和样式）
      const leftButtonRows = 3
      const leftButtonCols = 4
      const leftButtonSize = 8
      const leftButtonSpacingX = leftSectionWidth / (leftButtonCols + 1)
      const leftButtonSpacingY = (panelHeight - 30) / (leftButtonRows + 1)

      for (let row = 0; row < leftButtonRows; row++) {
        for (let col = 0; col < leftButtonCols; col++) {
          const x = leftSectionX + leftButtonSpacingX * (col + 1) - leftButtonSize / 2
          const y = leftSectionY + leftButtonSpacingY * (row + 1) - leftButtonSize / 2
          const isToggle = (row + col) % 2 === 0
          const isActive = Math.sin(time * 0.001 + col + row) > 0

          if (isToggle) {
            // 开关样式
            ctx.fillStyle = isActive ? accentColor2 : '#333344'
            ctx.fillRect(x - 3, y - 2, leftButtonSize + 6, leftButtonSize + 4)
            if (isActive) {
              ctx.shadowBlur = 6
              ctx.shadowColor = accentColor2
              ctx.fillRect(x - 3, y - 2, leftButtonSize + 6, leftButtonSize + 4)
              ctx.shadowBlur = 0
            }
          } else {
            // 按钮样式
            const glowColors = [accentColor1, accentColor2, accentColor3]
            const glowIndex = (row + col) % 3
            const glowAlpha = 0.3 + Math.sin(time * 0.002 + col * 0.3 + row * 0.2) * 0.3
            
            ctx.fillStyle = glowColors[glowIndex]
            ctx.globalAlpha = glowAlpha
            ctx.fillRect(x - 2, y - 2, leftButtonSize + 4, leftButtonSize + 4)
            ctx.globalAlpha = 1

            ctx.fillStyle = '#4b0082'
            ctx.fillRect(x, y, leftButtonSize, leftButtonSize)

            ctx.fillStyle = '#ffffff'
            ctx.globalAlpha = 0.5
            ctx.fillRect(x, y, leftButtonSize / 2, leftButtonSize / 2)
            ctx.globalAlpha = 1
          }
        }
      }

      // 左侧小显示屏
      const leftScreenX = leftSectionX
      const leftScreenY = leftSectionY + leftButtonSpacingY * leftButtonRows + 20
      const leftScreenWidth = leftSectionWidth - 10
      const leftScreenHeight = 40
      ctx.fillStyle = '#000000'
      ctx.fillRect(leftScreenX, leftScreenY, leftScreenWidth, leftScreenHeight)
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 1
      ctx.strokeRect(leftScreenX, leftScreenY, leftScreenWidth, leftScreenHeight)
      ctx.fillStyle = accentColor3
      ctx.font = '8px monospace'
      ctx.fillText('PWR: ' + Math.floor(85 + Math.sin(time * 0.001) * 10) + '%', leftScreenX + 3, leftScreenY + 12)
      ctx.fillText('TMP: ' + Math.floor(20 + Math.cos(time * 0.0015) * 5) + '°C', leftScreenX + 3, leftScreenY + 25)

      // 中央区域：摇杆和仪表盘
      const centerSectionX = panelLeft + panelWidth * 0.35
      const centerSectionWidth = panelWidth * 0.3
      
      // 摇杆/控制球
      const joystickX = centerX
      const joystickY = panelTop + panelHeight / 2
      const joystickSize = 40
      
      // 摇杆底座
      ctx.fillStyle = '#2d1b4e'
      ctx.fillRect(joystickX - joystickSize / 2, joystickY - joystickSize / 2, 
                   joystickSize, joystickSize)
      
      // 摇杆发光边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 6
      ctx.shadowColor = accentColor2
      ctx.strokeRect(joystickX - joystickSize / 2, joystickY - joystickSize / 2, 
                     joystickSize, joystickSize)
      ctx.shadowBlur = 0
      
      // 摇杆手柄（动态）
      const handleOffsetX = Math.sin(time * 0.001) * 3
      const handleOffsetY = Math.cos(time * 0.0015) * 3
      const handleSize = 14
      ctx.fillStyle = accentColor1
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.fillRect(joystickX - handleSize / 2 + handleOffsetX, 
                   joystickY - handleSize / 2 + handleOffsetY, 
                   handleSize, handleSize)
      ctx.shadowBlur = 0

      // 摇杆下方的仪表盘组（更丰富的设计）
      const gaugeY = joystickY + joystickSize / 2 + 15
      const gaugeSize = 45
      const gaugeSpacing = 60
      
      // 仪表盘1 - 速度（更详细的设计）
      const gauge1X = joystickX - gaugeSpacing
      const gauge1Radius = gaugeSize / 2
      
      // 仪表盘外圈
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.beginPath()
      ctx.arc(gauge1X, gaugeY, gauge1Radius, Math.PI, 0, false)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 仪表盘内圈
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(gauge1X, gaugeY, gauge1Radius - 3, Math.PI, 0, false)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // 刻度线
      const tickCount = 10
      for (let i = 0; i <= tickCount; i++) {
        const angle = Math.PI + (i / tickCount) * Math.PI
        const isMajorTick = i % 5 === 0
        const tickLength = isMajorTick ? 6 : 3
        const tickRadius = gauge1Radius - (isMajorTick ? 2 : 1)
        
        ctx.strokeStyle = accentColor2
        ctx.lineWidth = isMajorTick ? 1.5 : 1
        ctx.globalAlpha = isMajorTick ? 0.8 : 0.4
        ctx.beginPath()
        ctx.moveTo(gauge1X + Math.cos(angle) * tickRadius, gaugeY + Math.sin(angle) * tickRadius)
        ctx.lineTo(gauge1X + Math.cos(angle) * (tickRadius + tickLength), gaugeY + Math.sin(angle) * (tickRadius + tickLength))
        ctx.stroke()
        
        // 数字标签
        if (isMajorTick) {
          const labelRadius = tickRadius + tickLength + 8
          const labelX = gauge1X + Math.cos(angle) * labelRadius
          const labelY = gaugeY + Math.sin(angle) * labelRadius
          ctx.fillStyle = accentColor2
          ctx.font = '6px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((i * 10).toString(), labelX, labelY)
        }
      }
      
      // 指针
      const speedValue = Math.sin(time * 0.001) * 0.5 + 0.5
      const speedAngle = Math.PI + speedValue * Math.PI
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.beginPath()
      ctx.moveTo(gauge1X, gaugeY)
      ctx.lineTo(gauge1X + Math.cos(speedAngle) * (gauge1Radius - 5), gaugeY + Math.sin(speedAngle) * (gauge1Radius - 5))
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 中心点
      ctx.fillStyle = accentColor2
      ctx.beginPath()
      ctx.arc(gauge1X, gaugeY, 2, 0, Math.PI * 2)
      ctx.fill()
      
      // 标签和数值显示
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('SPD', gauge1X, gaugeY + gauge1Radius + 12)
      ctx.font = '7px monospace'
      ctx.fillText(Math.floor(speedValue * 100).toString(), gauge1X, gaugeY + gauge1Radius + 20)

      // 仪表盘2 - 能量（更详细的设计）
      const gauge2X = joystickX + gaugeSpacing
      const gauge2Radius = gaugeSize / 2
      
      // 仪表盘外圈
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.arc(gauge2X, gaugeY, gauge2Radius, Math.PI, 0, false)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 仪表盘内圈
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(gauge2X, gaugeY, gauge2Radius - 3, Math.PI, 0, false)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // 刻度线
      for (let i = 0; i <= tickCount; i++) {
        const angle = Math.PI + (i / tickCount) * Math.PI
        const isMajorTick = i % 5 === 0
        const tickLength = isMajorTick ? 6 : 3
        const tickRadius = gauge2Radius - (isMajorTick ? 2 : 1)
        
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = isMajorTick ? 1.5 : 1
        ctx.globalAlpha = isMajorTick ? 0.8 : 0.4
        ctx.beginPath()
        ctx.moveTo(gauge2X + Math.cos(angle) * tickRadius, gaugeY + Math.sin(angle) * tickRadius)
        ctx.lineTo(gauge2X + Math.cos(angle) * (tickRadius + tickLength), gaugeY + Math.sin(angle) * (tickRadius + tickLength))
        ctx.stroke()
        
        // 数字标签
        if (isMajorTick) {
          const labelRadius = tickRadius + tickLength + 8
          const labelX = gauge2X + Math.cos(angle) * labelRadius
          const labelY = gaugeY + Math.sin(angle) * labelRadius
          ctx.fillStyle = accentColor1
          ctx.font = '6px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((i * 10).toString(), labelX, labelY)
        }
      }
      
      // 指针
      const energyValue = Math.cos(time * 0.0015) * 0.5 + 0.5
      const energyAngle = Math.PI + energyValue * Math.PI
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.moveTo(gauge2X, gaugeY)
      ctx.lineTo(gauge2X + Math.cos(energyAngle) * (gauge2Radius - 5), gaugeY + Math.sin(energyAngle) * (gauge2Radius - 5))
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 中心点
      ctx.fillStyle = accentColor1
      ctx.beginPath()
      ctx.arc(gauge2X, gaugeY, 2, 0, Math.PI * 2)
      ctx.fill()
      
      // 标签和数值显示
      ctx.fillStyle = accentColor1
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('ENG', gauge2X, gaugeY + gauge2Radius + 12)
      ctx.font = '7px monospace'
      ctx.fillText(Math.floor(energyValue * 100).toString(), gauge2X, gaugeY + gauge2Radius + 20)

      // 仪表盘3 - 温度（新增）
      const gauge3X = joystickX
      const gauge3Y = gaugeY + gaugeSize / 2 + 20
      const gauge3Radius = 30
      
      // 仪表盘外圈
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor3
      ctx.beginPath()
      ctx.arc(gauge3X, gauge3Y, gauge3Radius, Math.PI, 0, false)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 刻度线
      const tempTickCount = 8
      for (let i = 0; i <= tempTickCount; i++) {
        const angle = Math.PI + (i / tempTickCount) * Math.PI
        const isMajorTick = i % 2 === 0
        const tickLength = isMajorTick ? 5 : 2.5
        const tickRadius = gauge3Radius - (isMajorTick ? 1 : 0.5)
        
        ctx.strokeStyle = accentColor3
        ctx.lineWidth = isMajorTick ? 1.5 : 1
        ctx.globalAlpha = isMajorTick ? 0.8 : 0.4
        ctx.beginPath()
        ctx.moveTo(gauge3X + Math.cos(angle) * tickRadius, gauge3Y + Math.sin(angle) * tickRadius)
        ctx.lineTo(gauge3X + Math.cos(angle) * (tickRadius + tickLength), gauge3Y + Math.sin(angle) * (tickRadius + tickLength))
        ctx.stroke()
      }
      
      // 指针
      const tempValue = Math.sin(time * 0.002) * 0.5 + 0.5
      const tempAngle = Math.PI + tempValue * Math.PI
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor3
      ctx.beginPath()
      ctx.moveTo(gauge3X, gauge3Y)
      ctx.lineTo(gauge3X + Math.cos(tempAngle) * (gauge3Radius - 4), gauge3Y + Math.sin(tempAngle) * (gauge3Radius - 4))
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 中心点
      ctx.fillStyle = accentColor3
      ctx.beginPath()
      ctx.arc(gauge3X, gauge3Y, 2, 0, Math.PI * 2)
      ctx.fill()
      
      // 标签
      ctx.fillStyle = accentColor3
      ctx.font = 'bold 7px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('TEMP', gauge3X, gauge3Y + gauge3Radius + 10)
      
      // 连接线（装饰性）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(gauge1X + gauge1Radius, gaugeY - 5)
      ctx.lineTo(gauge2X - gauge2Radius, gaugeY - 5)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(gauge1X + gauge1Radius, gaugeY + 5)
      ctx.lineTo(gauge2X - gauge2Radius, gaugeY + 5)
      ctx.stroke()
      ctx.globalAlpha = 1

      // 新增组件区域：波形显示器、条形图、雷达扫描等（调整位置为上传按钮留出空间）
      const componentAreaY = gauge3Y + gauge3Radius + 15
      const componentAreaHeight = 50
      
      // 波形显示器（左侧）
      const waveformX = gauge1X - 20
      const waveformY = componentAreaY
      const waveformWidth = 80
      const waveformHeight = 30
      
      // 波形显示器边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.strokeRect(waveformX, waveformY, waveformWidth, waveformHeight)
      
      // 波形显示器内部网格线
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.2
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(waveformX, waveformY + (waveformHeight / 4) * i)
        ctx.lineTo(waveformX + waveformWidth, waveformY + (waveformHeight / 4) * i)
        ctx.stroke()
      }
      for (let i = 1; i < 8; i++) {
        ctx.beginPath()
        ctx.moveTo(waveformX + (waveformWidth / 8) * i, waveformY)
        ctx.lineTo(waveformX + (waveformWidth / 8) * i, waveformY + waveformHeight)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 绘制波形
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.beginPath()
      const waveformPoints = 50
      for (let i = 0; i < waveformPoints; i++) {
        const x = waveformX + (waveformWidth / waveformPoints) * i
        const waveValue = Math.sin(time * 0.003 + i * 0.2) * Math.sin(time * 0.001 + i * 0.1)
        const y = waveformY + waveformHeight / 2 + waveValue * (waveformHeight / 2 - 2)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      
      // 波形显示器标签
      ctx.fillStyle = accentColor2
      ctx.font = '6px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('WAVE', waveformX + waveformWidth / 2, waveformY - 5)

      // 条形图显示器（中央）
      const barChartX = gauge3X - 40
      const barChartY = componentAreaY
      const barChartWidth = 80
      const barChartHeight = 30
      
      // 条形图边框
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 1
      ctx.strokeRect(barChartX, barChartY, barChartWidth, barChartHeight)
      
      // 条形图内部网格线
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.2
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(barChartX, barChartY + (barChartHeight / 4) * i)
        ctx.lineTo(barChartX + barChartWidth, barChartY + (barChartHeight / 4) * i)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 绘制条形
      const barCount = 8
      const barWidth = barChartWidth / (barCount * 2)
      const barSpacing = barChartWidth / barCount
      for (let i = 0; i < barCount; i++) {
        const barX = barChartX + barSpacing * i + barSpacing / 2 - barWidth / 2
        const barHeight = (Math.sin(time * 0.002 + i * 0.5) * 0.5 + 0.5) * (barChartHeight - 4)
        const barY = barChartY + barChartHeight - barHeight - 2
        
        ctx.fillStyle = accentColor3
        ctx.globalAlpha = 0.6 + Math.sin(time * 0.002 + i) * 0.3
        ctx.fillRect(barX, barY, barWidth, barHeight)
        ctx.globalAlpha = 1
        
        // 条形边框
        ctx.strokeStyle = accentColor3
        ctx.lineWidth = 0.5
        ctx.strokeRect(barX, barY, barWidth, barHeight)
      }
      
      // 条形图标签
      ctx.fillStyle = accentColor3
      ctx.font = '6px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('BARS', barChartX + barChartWidth / 2, barChartY - 5)

      // 雷达扫描显示器（右侧）
      const radarX = gauge2X + 20
      const radarY = componentAreaY
      const radarSize = 30
      const radarRadius = radarSize / 2
      
      // 雷达显示器边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.strokeRect(radarX, radarY, radarSize, radarSize)
      
      // 雷达扫描圆
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(radarX + radarRadius, radarY + radarRadius, (radarRadius / 3) * i, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 雷达扫描线（旋转）
      const radarAngle = (time * 0.002) % (Math.PI * 2)
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.moveTo(radarX + radarRadius, radarY + radarRadius)
      ctx.lineTo(
        radarX + radarRadius + Math.cos(radarAngle) * radarRadius,
        radarY + radarRadius + Math.sin(radarAngle) * radarRadius
      )
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 雷达目标点
      for (let i = 0; i < 3; i++) {
        const targetAngle = (time * 0.001 + i * 2) % (Math.PI * 2)
        const targetDistance = 0.3 + Math.sin(time * 0.001 + i) * 0.2
        const targetX = radarX + radarRadius + Math.cos(targetAngle) * radarRadius * targetDistance
        const targetY = radarY + radarRadius + Math.sin(targetAngle) * radarRadius * targetDistance
        
        ctx.fillStyle = accentColor1
        ctx.shadowBlur = 3
        ctx.shadowColor = accentColor1
        ctx.beginPath()
        ctx.arc(targetX, targetY, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
      
      // 雷达标签
      ctx.fillStyle = accentColor1
      ctx.font = '6px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('RADAR', radarX + radarRadius, radarY - 5)

      // 数字显示屏组（仪表盘下方）
      const digitalDisplayY = componentAreaY + componentAreaHeight + 10
      const digitalDisplaySpacing = 50
      
      // 数字显示屏1 - 速度
      const digital1X = gauge1X - 25
      const digital1Width = 50
      const digital1Height = 20
      ctx.fillStyle = '#000000'
      ctx.fillRect(digital1X, digitalDisplayY, digital1Width, digital1Height)
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.strokeRect(digital1X, digitalDisplayY, digital1Width, digital1Height)
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(Math.floor(speedValue * 100).toString().padStart(3, '0'), digital1X + digital1Width / 2, digitalDisplayY + 14)
      
      // 数字显示屏2 - 能量
      const digital2X = gauge2X - 25
      ctx.fillStyle = '#000000'
      ctx.fillRect(digital2X, digitalDisplayY, digital1Width, digital1Height)
      ctx.strokeStyle = accentColor1
      ctx.strokeRect(digital2X, digitalDisplayY, digital1Width, digital1Height)
      ctx.fillStyle = accentColor1
      ctx.fillText(Math.floor(energyValue * 100).toString().padStart(3, '0'), digital2X + digital1Width / 2, digitalDisplayY + 14)

      // 状态指示灯组（仪表盘周围）
      const indicatorRadius = 3
      const indicatorPositions = [
        { x: gauge1X - gauge1Radius - 15, y: gaugeY - 10, color: accentColor2 },
        { x: gauge1X - gauge1Radius - 15, y: gaugeY + 10, color: accentColor2 },
        { x: gauge2X + gauge2Radius + 15, y: gaugeY - 10, color: accentColor1 },
        { x: gauge2X + gauge2Radius + 15, y: gaugeY + 10, color: accentColor1 },
        { x: gauge3X, y: gauge3Y - gauge3Radius - 12, color: accentColor3 },
      ]
      
      indicatorPositions.forEach((indicator, index) => {
        const isBlinking = Math.sin(time * 0.003 + index) > 0
        ctx.fillStyle = isBlinking ? indicator.color : '#333344'
        ctx.shadowBlur = isBlinking ? 4 : 0
        ctx.shadowColor = indicator.color
        ctx.beginPath()
        ctx.arc(indicator.x, indicator.y, indicatorRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // 数据流线条（连接各个组件）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      
      // 从仪表盘到波形显示器的线条
      ctx.beginPath()
      ctx.moveTo(gauge1X, gaugeY + gauge1Radius)
      ctx.lineTo(waveformX + waveformWidth / 2, waveformY)
      ctx.stroke()
      
      // 从仪表盘到条形图的线条
      ctx.beginPath()
      ctx.moveTo(gauge3X, gauge3Y + gauge3Radius)
      ctx.lineTo(barChartX + barChartWidth / 2, barChartY)
      ctx.stroke()
      
      // 从仪表盘到雷达的线条
      ctx.beginPath()
      ctx.moveTo(gauge2X, gaugeY + gauge2Radius)
      ctx.lineTo(radarX + radarRadius, radarY)
      ctx.stroke()
      
      // 从仪表盘到数字显示屏的线条
      ctx.beginPath()
      ctx.moveTo(gauge1X, gaugeY + gauge1Radius)
      ctx.lineTo(digital1X + digital1Width / 2, digitalDisplayY)
      ctx.stroke()
      
      ctx.beginPath()
      ctx.moveTo(gauge2X, gaugeY + gauge2Radius)
      ctx.lineTo(digital2X + digital1Width / 2, digitalDisplayY)
      ctx.stroke()
      
      ctx.globalAlpha = 1

      // 装饰性网格背景（仪表盘区域）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.1
      const gridSpacing = 20
      const gridStartX = panelLeft + 10
      const gridEndX = panelLeft + panelWidth - 10
      const gridStartY = panelTop + 10
      const gridEndY = componentAreaY + componentAreaHeight + 30
      
      for (let x = gridStartX; x < gridEndX; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, gridStartY)
        ctx.lineTo(x, gridEndY)
        ctx.stroke()
      }
      
      for (let y = gridStartY; y < gridEndY; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(gridStartX, y)
        ctx.lineTo(gridEndX, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 大型雷达监控组件（右侧区域）
      const radarMonitorX = panelLeft + panelWidth * 0.72
      const radarMonitorY = panelTop + 20
      const radarMonitorWidth = panelWidth * 0.25
      const radarMonitorHeight = panelHeight - 40
      const radarMonitorRadius = Math.min(radarMonitorWidth, radarMonitorHeight) / 2 - 10
      const radarMonitorCenterX = radarMonitorX + radarMonitorWidth / 2
      const radarMonitorCenterY = radarMonitorY + radarMonitorHeight / 2
      
      // 雷达监控器边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 2
      ctx.shadowBlur = 6
      ctx.shadowColor = accentColor1
      ctx.strokeRect(radarMonitorX, radarMonitorY, radarMonitorWidth, radarMonitorHeight)
      ctx.shadowBlur = 0
      
      // 雷达监控器内边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.strokeRect(radarMonitorX + 2, radarMonitorY + 2, radarMonitorWidth - 4, radarMonitorHeight - 4)
      
      // 雷达扫描圆（同心圆）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.4
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(radarMonitorCenterX, radarMonitorCenterY, (radarMonitorRadius / 4) * i, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 雷达扫描线（十字线）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(radarMonitorCenterX - radarMonitorRadius, radarMonitorCenterY)
      ctx.lineTo(radarMonitorCenterX + radarMonitorRadius, radarMonitorCenterY)
      ctx.moveTo(radarMonitorCenterX, radarMonitorCenterY - radarMonitorRadius)
      ctx.lineTo(radarMonitorCenterX, radarMonitorCenterY + radarMonitorRadius)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // 旋转扫描线
      const radarScanAngle = (time * 0.003) % (Math.PI * 2)
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 2
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor1
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(radarMonitorCenterX, radarMonitorCenterY)
      ctx.lineTo(
        radarMonitorCenterX + Math.cos(radarScanAngle) * radarMonitorRadius,
        radarMonitorCenterY + Math.sin(radarScanAngle) * radarMonitorRadius
      )
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      
      // 雷达目标（多个动态目标）
      const targetCount = 5
      for (let i = 0; i < targetCount; i++) {
        const targetAngle = (time * 0.0005 + i * 1.2) % (Math.PI * 2)
        const targetDistance = 0.2 + Math.sin(time * 0.001 + i) * 0.3
        const targetX = radarMonitorCenterX + Math.cos(targetAngle) * radarMonitorRadius * targetDistance
        const targetY = radarMonitorCenterY + Math.sin(targetAngle) * radarMonitorRadius * targetDistance
        const targetSize = 3 + Math.sin(time * 0.002 + i) * 1
        
        // 目标点
        ctx.fillStyle = accentColor1
        ctx.shadowBlur = 6
        ctx.shadowColor = accentColor1
        ctx.beginPath()
        ctx.arc(targetX, targetY, targetSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        
        // 目标脉冲圈（确保半径始终为正数）
        const pulseRadius = Math.max(0.5, targetSize + Math.sin(time * 0.005 + i) * 5)
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.5 - Math.abs(Math.sin(time * 0.005 + i)) * 0.3
        ctx.beginPath()
        ctx.arc(targetX, targetY, pulseRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      
      // 雷达监控器标题
      ctx.fillStyle = accentColor1
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('RADAR MONITOR', radarMonitorCenterX, radarMonitorY - 5)
      
      // 雷达监控器状态信息
      ctx.fillStyle = accentColor2
      ctx.font = '7px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('TARGETS: ' + targetCount, radarMonitorX + 5, radarMonitorY + radarMonitorHeight - 15)
      ctx.fillText('RANGE: MAX', radarMonitorX + 5, radarMonitorY + radarMonitorHeight - 8)

      // 航行日志组件（左侧区域，调整位置为上传按钮留出空间）
      const logX = panelLeft + 15
      const logY = componentAreaY + componentAreaHeight + 20
      const logWidth = panelWidth * 0.3
      const logHeight = 60  // 减小高度为按钮留出空间
      
      // 日志边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.strokeRect(logX, logY, logWidth, logHeight)
      ctx.shadowBlur = 0
      
      // 日志内边框
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.strokeRect(logX + 2, logY + 2, logWidth - 4, logHeight - 4)
      ctx.globalAlpha = 1
      
      // 日志标题
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('[NAVIGATION LOG]', logX + 5, logY + 12)
      
      // 日志分隔线
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(logX + 5, logY + 18)
      ctx.lineTo(logX + logWidth - 5, logY + 18)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // 日志条目（滚动显示）
      const logEntries = [
        `[${new Date(Date.now() - 5000).toLocaleTimeString()}] System online`,
        `[${new Date(Date.now() - 4000).toLocaleTimeString()}] Navigation active`,
        `[${new Date(Date.now() - 3000).toLocaleTimeString()}] Course set`,
        `[${new Date(Date.now() - 2000).toLocaleTimeString()}] Speed: ${Math.floor(speedValue * 100)}%`,
        `[${new Date(Date.now() - 1000).toLocaleTimeString()}] Energy: ${Math.floor(energyValue * 100)}%`,
        `[${new Date().toLocaleTimeString()}] All systems operational`
      ]
      
      ctx.fillStyle = accentColor2
      ctx.font = '7px monospace'
      ctx.textAlign = 'left'
      const logLineHeight = 10
      const scrollOffset = Math.floor((time * 0.0001) % logEntries.length) * logLineHeight
      
      for (let i = 0; i < 5; i++) {
        const entryIndex = (Math.floor(scrollOffset / logLineHeight) + i) % logEntries.length
        const y = logY + 25 + i * logLineHeight
        ctx.globalAlpha = 1 - (i * 0.15)
        ctx.fillText(logEntries[entryIndex], logX + 5, y)
      }
      ctx.globalAlpha = 1
      
      // 日志滚动指示器
      const scrollBarX = logX + logWidth - 8
      const scrollBarY = logY + 20
      const scrollBarHeight = logHeight - 25
      ctx.fillStyle = '#333344'
      ctx.fillRect(scrollBarX, scrollBarY, 3, scrollBarHeight)
      ctx.fillStyle = accentColor2
      const scrollBarPos = (scrollOffset % (logEntries.length * logLineHeight)) / (logEntries.length * logLineHeight)
      ctx.fillRect(scrollBarX, scrollBarY + scrollBarPos * scrollBarHeight, 3, 8)

      // 上传按钮位置计算（位于控制面板中右区域，雷达监控器左侧）
      const uploadButtonWidth = 120
      const uploadButtonHeight = 38
      const buttonRadius = 10  // 圆角半径
      // 按钮位置：雷达监控器左侧，控制面板中右区域
      const buttonMargin = 15  // 距离边缘的边距
      // 雷达监控器起始位置是 panelLeft + panelWidth * 0.72
      // 按钮应该在雷达监控器左侧，留出间距
      const finalButtonX = panelLeft + panelWidth * 0.72 - uploadButtonWidth - buttonMargin
      // 垂直位置：控制面板中央偏上区域
      const uploadButtonY = panelTop + panelHeight * 0.3
      
      // 存储按钮位置供后续使用
      const uploadButtonInfo = {
        x: finalButtonX,
        y: uploadButtonY,
        width: uploadButtonWidth,
        height: uploadButtonHeight,
        radius: buttonRadius
      }
      
      // 更新按钮位置状态（用于渲染透明按钮）
      setButtonPosition({
        x: finalButtonX,
        y: uploadButtonY,
        width: uploadButtonWidth,
        height: uploadButtonHeight
      })

      // 列表按钮位置计算（位于上传按钮左侧）
      const listButtonWidth = 120
      const listButtonHeight = 38
      const listButtonSpacing = 15  // 与上传按钮的间距
      const listButtonX = finalButtonX - listButtonWidth - listButtonSpacing
      const listButtonY = uploadButtonY  // 与上传按钮同一水平线
      
      // 存储列表按钮位置供后续使用
      const listButtonInfo = {
        x: listButtonX,
        y: listButtonY,
        width: listButtonWidth,
        height: listButtonHeight,
        radius: buttonRadius
      }
      
      // 更新列表按钮位置状态（用于渲染透明按钮）
      setListButtonPosition({
        x: listButtonX,
        y: listButtonY,
        width: listButtonWidth,
        height: listButtonHeight
      })

      // 连接线条（连接各个组件）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      
      // 从仪表盘到雷达监控器的线条
      ctx.beginPath()
      ctx.moveTo(gauge2X + gauge2Radius, gaugeY)
      ctx.lineTo(radarMonitorX, radarMonitorCenterY)
      ctx.stroke()
      
      // 从仪表盘到航行日志的线条
      ctx.beginPath()
      ctx.moveTo(gauge1X - gauge1Radius, gaugeY)
      ctx.lineTo(logX, logY + logHeight / 2)
      ctx.stroke()
      
      // 从各个组件到上传按钮的连接线（装饰性，指向中右区域按钮）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4
      
      // 从雷达监控器到上传按钮（左侧）
      ctx.beginPath()
      ctx.moveTo(radarMonitorX, radarMonitorY + radarMonitorHeight / 2)
      ctx.lineTo(uploadButtonInfo.x + uploadButtonInfo.width, uploadButtonInfo.y + uploadButtonInfo.height / 2)
      ctx.stroke()
      
      ctx.globalAlpha = 1
      
      // 更多装饰线条（连接各个仪表盘组件）
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.2
      
      // 波形显示器到日志的线条
      ctx.beginPath()
      ctx.moveTo(waveformX + waveformWidth, waveformY + waveformHeight / 2)
      ctx.lineTo(logX, logY + 10)
      ctx.stroke()
      
      // 条形图到日志的线条
      ctx.beginPath()
      ctx.moveTo(barChartX + barChartWidth, barChartY + barChartHeight / 2)
      ctx.lineTo(logX, logY + 30)
      ctx.stroke()
      
      // 雷达扫描到雷达监控器的线条
      ctx.beginPath()
      ctx.moveTo(radarX + radarSize, radarY + radarRadius)
      ctx.lineTo(radarMonitorX, radarMonitorY + 15)
      ctx.stroke()
      
      ctx.globalAlpha = 1
      
      // 装饰性框架线条（围绕整个控制面板区域）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.15
      const frameOffset = 5
      ctx.strokeRect(
        panelLeft - frameOffset, 
        panelTop - frameOffset, 
        panelWidth + frameOffset * 2, 
        panelHeight + frameOffset * 2
      )
      ctx.globalAlpha = 1

      // 右侧区域：旋钮、滑块和显示屏
      const rightSectionX = panelLeft + panelWidth * 0.7
      const rightSectionWidth = panelWidth * 0.25
      const rightSectionY = panelTop + 15

      // 旋钮组
      const knobRows = 2
      const knobCols = 3
      const knobSize = 12
      const knobSpacingX = rightSectionWidth / (knobCols + 1)
      const knobSpacingY = (panelHeight - 30) / (knobRows + 1)

      for (let row = 0; row < knobRows; row++) {
        for (let col = 0; col < knobCols; col++) {
          const x = rightSectionX + knobSpacingX * (col + 1)
          const y = rightSectionY + knobSpacingY * (row + 1)
          
          // 旋钮底座
          ctx.fillStyle = '#4b0082'
          ctx.beginPath()
          ctx.arc(x, y, knobSize / 2, 0, Math.PI * 2)
          ctx.fill()
          
          // 旋钮边框
          ctx.strokeStyle = accentColor3
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, knobSize / 2, 0, Math.PI * 2)
          ctx.stroke()
          
          // 旋钮指示器
          const knobAngle = (time * 0.0005 + col + row) * Math.PI * 2
          ctx.strokeStyle = accentColor3
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + Math.cos(knobAngle) * knobSize / 3, y + Math.sin(knobAngle) * knobSize / 3)
          ctx.stroke()
        }
      }

      // 右侧滑块
      const sliderX = rightSectionX + rightSectionWidth - 20
      const sliderY = rightSectionY + knobSpacingY * knobRows + 30
      const sliderHeight = panelHeight - (sliderY - panelTop) - 20
      const sliderWidth = 8
      
      // 滑块轨道
      ctx.fillStyle = '#333344'
      ctx.fillRect(sliderX - sliderWidth / 2, sliderY, sliderWidth, sliderHeight)
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.strokeRect(sliderX - sliderWidth / 2, sliderY, sliderWidth, sliderHeight)
      
      // 滑块指示器（动态）
      const sliderPos = 0.3 + Math.sin(time * 0.001) * 0.2
      const sliderIndicatorY = sliderY + sliderPos * sliderHeight
      ctx.fillStyle = accentColor2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.fillRect(sliderX - sliderWidth / 2 - 2, sliderIndicatorY - 4, sliderWidth + 4, 8)
      ctx.shadowBlur = 0

      // 右侧小显示屏（控制面板内）
      const rightPanelScreenX = rightSectionX
      const rightPanelScreenY = sliderY + sliderHeight + 10
      const rightPanelScreenWidth = rightSectionWidth - 30
      const rightPanelScreenHeight = 35
      ctx.fillStyle = '#000000'
      ctx.fillRect(rightPanelScreenX, rightPanelScreenY, rightPanelScreenWidth, rightPanelScreenHeight)
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.strokeRect(rightPanelScreenX, rightPanelScreenY, rightPanelScreenWidth, rightPanelScreenHeight)
      ctx.fillStyle = accentColor1
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('STATUS', rightPanelScreenX + 3, rightPanelScreenY + 12)
      ctx.fillText('READY', rightPanelScreenX + 3, rightPanelScreenY + 25)

      // ========== 不再绘制左右侧内壁（根据用户要求） ==========
      // 窗口边界用于其他组件（如果需要）
      const windowLeftEdgeX = middleWindowLeft
      const windowRightEdgeX = middleWindowRight
      
      // 注意：以下所有左侧和右侧舱壁的绘制代码已被注释掉，因为用户要求不再需要左右侧内壁
      /*
      
      // 左侧舱壁的连接点（近端和远端）
      const leftWallNearEdgeX = leftWallNearWidth // 近端边缘
      const leftWallFarEdgeX = leftWallFarWidth // 远端边缘

      // 左侧舱壁基础（深色金属，带透视的梯形）
      ctx.save()
      ctx.beginPath()
      // 绘制透视梯形（近大远小）
      ctx.moveTo(0, leftWallNearY) // 左下角（近端）
      ctx.lineTo(leftWallNearEdgeX, leftWallNearY) // 右下角（近端）
      ctx.lineTo(leftWallFarEdgeX, leftWallFarY) // 右上角（远端）
      ctx.lineTo(0, leftWallFarY) // 左上角（远端）
      ctx.closePath()
      
      // 渐变填充（从近到远，从亮到暗）
      const wallBaseGradient = ctx.createLinearGradient(0, leftWallNearY, leftWallFarEdgeX, leftWallFarY)
      wallBaseGradient.addColorStop(0, '#0a0a1a')
      wallBaseGradient.addColorStop(0.2, '#1a1a2e')
      wallBaseGradient.addColorStop(0.6, '#1a1a2e')
      wallBaseGradient.addColorStop(1, '#0f0f1e')
      ctx.fillStyle = wallBaseGradient
      ctx.fill()
      
      // 添加深度渐变（从近到远逐渐变暗）
      const leftWallDepthGradient = ctx.createLinearGradient(0, leftWallNearY, 0, leftWallFarY)
      leftWallDepthGradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
      leftWallDepthGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)')
      leftWallDepthGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)')
      leftWallDepthGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
      ctx.fillStyle = leftWallDepthGradient
      ctx.fill()
      ctx.restore()

      // 左侧舱壁面板接缝（垂直，带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      for (let i = 1; i < 4; i++) {
        const nearX = (leftWallNearEdgeX / 4) * i
        const farX = (leftWallFarEdgeX / 4) * i
        ctx.beginPath()
        ctx.moveTo(farX, leftWallFarY) // 远端
        ctx.lineTo(nearX, leftWallNearY) // 近端
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 左侧舱壁面板接缝（水平，带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      const horizontalSeams = 6
      for (let i = 1; i < horizontalSeams; i++) {
        const t = i / horizontalSeams // 0到1的进度
        const seamY = leftWallFarY + (leftWallNearY - leftWallFarY) * t
        const seamNearWidth = leftWallNearEdgeX
        const seamFarWidth = leftWallFarEdgeX
        const currentWidth = seamFarWidth + (seamNearWidth - seamFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(0, seamY)
        ctx.lineTo(currentWidth, seamY)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 左侧舱壁铆钉（沿接缝，带透视）
      ctx.fillStyle = '#3a3a4e'
      for (let row = 0; row < horizontalSeams; row++) {
        for (let col = 0; col < 4; col++) {
          const t = (row + 0.5) / horizontalSeams // 0到1的进度
          const rivetY = leftWallFarY + (leftWallNearY - leftWallFarY) * t
          const nearX = (leftWallNearEdgeX / 4) * col + (leftWallNearEdgeX / 8)
          const farX = (leftWallFarEdgeX / 4) * col + (leftWallFarEdgeX / 8)
          const rivetX = farX + (nearX - farX) * t
          const rivetSize = 1.5 + t * 0.5 // 近处大，远处小
          ctx.beginPath()
          ctx.arc(rivetX, rivetY, rivetSize, 0, Math.PI * 2)
          ctx.fill()
          // 铆钉高光
          ctx.fillStyle = '#5a5a6e'
          ctx.beginPath()
          ctx.arc(rivetX - 0.3, rivetY - 0.3, rivetSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#3a3a4e'
        }
      }

      // 左侧舱壁金属纹理（划痕和磨损）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.3
      for (let i = 0; i < 15; i++) {
        const scratchY = leftWallTop + Math.random() * leftWallHeight
        const scratchLength = 20 + Math.random() * 30
        // 根据Y位置计算对应的宽度（透视效果：顶部窄，底部宽）
        const t = (scratchY - leftWallTop) / leftWallHeight // 0=顶部, 1=底部
        const currentWallWidth = leftWallFarWidth + (leftWallNearWidth - leftWallFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(leftWallFarEdgeX + Math.random() * (currentWallWidth - leftWallFarEdgeX), scratchY)
        ctx.lineTo(leftWallFarEdgeX + Math.random() * (currentWallWidth - leftWallFarEdgeX), scratchY + scratchLength)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 左侧舱壁管道（垂直，带透视）
      const pipeCount = 3
      for (let i = 0; i < pipeCount; i++) {
        const pipeRatio = (i + 1) / (pipeCount + 1)
        // 近端和远端的管道位置
        const pipeNearX = leftWallNearEdgeX * pipeRatio
        const pipeFarX = leftWallFarEdgeX * pipeRatio
        const pipeStartY = leftWallFarY + 40
        const pipeEndY = leftWallNearY - 40
        // 管道宽度（近大远小）
        const pipeNearWidth = 6
        const pipeFarWidth = 4
        
        // 管道主体（透视梯形）
        ctx.beginPath()
        ctx.moveTo(pipeFarX - pipeFarWidth / 2, pipeStartY) // 左上
        ctx.lineTo(pipeFarX + pipeFarWidth / 2, pipeStartY) // 右上
        ctx.lineTo(pipeNearX + pipeNearWidth / 2, pipeEndY) // 右下
        ctx.lineTo(pipeNearX - pipeNearWidth / 2, pipeEndY) // 左下
        ctx.closePath()
        
        // 管道渐变
        const pipeGradient = ctx.createLinearGradient(pipeFarX - pipeFarWidth / 2, pipeStartY, pipeNearX + pipeNearWidth / 2, pipeEndY)
        pipeGradient.addColorStop(0, '#2a2a3e')
        pipeGradient.addColorStop(0.5, '#3a3a4e')
        pipeGradient.addColorStop(1, '#2a2a3e')
        ctx.fillStyle = pipeGradient
        ctx.fill()
        
        // 管道高光（左侧边缘）
        ctx.strokeStyle = '#4a4a5e'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(pipeFarX - pipeFarWidth / 2 + 0.5, pipeStartY)
        ctx.lineTo(pipeNearX - pipeNearWidth / 2 + 0.5, pipeEndY)
        ctx.stroke()
        
        // 管道连接环（带透视）
        for (let ringIndex = 1; ringIndex < 5; ringIndex++) {
          const ringT = ringIndex / 5
          const ringY = pipeStartY + (pipeEndY - pipeStartY) * ringT
          const ringX = pipeFarX + (pipeNearX - pipeFarX) * ringT
          const ringWidth = pipeFarWidth + (pipeNearWidth - pipeFarWidth) * ringT
          ctx.strokeStyle = '#1a1a2e'
          ctx.lineWidth = 1.5 + ringT * 0.5
          ctx.strokeRect(ringX - ringWidth / 2 - 1, ringY - 2, ringWidth + 2, 4)
        }
      }

      // 左侧舱壁线缆（水平，带透视）
      ctx.strokeStyle = accentColor3
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4
      for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 6 // 0到1的进度
        const cableY = leftWallFarY + (leftWallNearY - leftWallFarY) * t
        const cableNearWidth = leftWallNearEdgeX - 10
        const cableFarWidth = leftWallFarEdgeX - 10
        const currentWidth = cableFarWidth + (cableNearWidth - cableFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(10, cableY)
        ctx.lineTo(10 + currentWidth, cableY)
        ctx.stroke()
        // 线缆高光
        ctx.strokeStyle = accentColor2
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(10, cableY - 0.5)
        ctx.lineTo(10 + currentWidth, cableY - 0.5)
        ctx.stroke()
        ctx.strokeStyle = accentColor3
        ctx.lineWidth = 1.5
      }
      ctx.globalAlpha = 1

      // 左侧舱壁边缘高光（带透视）
      ctx.save()
      const leftEdgeGradient = ctx.createLinearGradient(0, leftWallNearY, 3, leftWallFarY)
      leftEdgeGradient.addColorStop(0, 'rgba(0, 255, 255, 0.12)')
      leftEdgeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.05)')
      ctx.fillStyle = leftEdgeGradient
      ctx.beginPath()
      ctx.moveTo(0, leftWallNearY)
      ctx.lineTo(3, leftWallNearY)
      ctx.lineTo(3, leftWallFarY)
      ctx.lineTo(0, leftWallFarY)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // 左侧舱壁边框（深色金属，带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, leftWallNearY)
      ctx.lineTo(leftWallNearEdgeX, leftWallNearY)
      ctx.lineTo(leftWallFarEdgeX, leftWallFarY)
      ctx.lineTo(0, leftWallFarY)
      ctx.closePath()
      ctx.stroke()
      
      // 左侧舱壁内边框（发光，带透视）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(2, leftWallNearY - 2)
      ctx.lineTo(leftWallNearEdgeX - 2, leftWallNearY - 2)
      ctx.lineTo(leftWallFarEdgeX - 2, leftWallFarY + 2)
      ctx.lineTo(2, leftWallFarY + 2)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1

      // ========== 左侧舱壁与窗口的连接框架（带透视） ==========
      // 连接框架（从左侧舱壁延伸到窗口，带透视）
      const connectionFrameNearWidth = windowLeftEdgeX - leftWallNearEdgeX // 近端宽度
      const connectionFrameFarWidth = windowLeftEdgeX - leftWallFarEdgeX // 远端宽度（透视缩小）
      const connectionFrameTop = windowTop
      const connectionFrameBottom = leftWallBottom
      
      // 连接框架基础（深色金属，与舱壁融合，带透视的梯形）
      ctx.beginPath()
      ctx.moveTo(leftWallNearEdgeX, connectionFrameBottom) // 左下角（近端）
      ctx.lineTo(windowLeftEdgeX, connectionFrameBottom) // 右下角（近端）
      ctx.lineTo(windowLeftEdgeX, connectionFrameTop) // 右上角（远端）
      ctx.lineTo(leftWallFarEdgeX, connectionFrameTop) // 左上角（远端）
      ctx.closePath()
      
      const connectionGradient = ctx.createLinearGradient(leftWallNearEdgeX, connectionFrameBottom, windowLeftEdgeX, connectionFrameTop)
      connectionGradient.addColorStop(0, '#1a1a2e')
      connectionGradient.addColorStop(0.5, '#0f0f1e')
      connectionGradient.addColorStop(1, '#0a0a1a')
      ctx.fillStyle = connectionGradient
      ctx.fill()
      
      // 连接框架深度渐变
      const connectionDepthGradient = ctx.createLinearGradient(leftWallNearEdgeX, connectionFrameBottom, leftWallFarEdgeX, connectionFrameTop)
      connectionDepthGradient.addColorStop(0, 'rgba(255, 255, 255, 0.03)')
      connectionDepthGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
      ctx.fillStyle = connectionDepthGradient
      ctx.fill()
      
      // 连接框架的垂直支撑结构（带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.6
      const supportCount = 3
      for (let i = 1; i < supportCount; i++) {
        const ratio = i / supportCount
        const supportNearX = leftWallNearEdgeX + connectionFrameNearWidth * ratio
        const supportFarX = leftWallFarEdgeX + connectionFrameFarWidth * ratio
        ctx.beginPath()
        ctx.moveTo(supportFarX, connectionFrameTop)
        ctx.lineTo(supportNearX, connectionFrameBottom)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 连接框架的水平加强筋（带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5
      for (let i = 1; i < horizontalSeams; i++) {
        const t = i / horizontalSeams
        const seamY = connectionFrameTop + (connectionFrameBottom - connectionFrameTop) * t
        const seamNearX = leftWallNearEdgeX
        const seamFarX = leftWallFarEdgeX
        const seamNearEndX = windowLeftEdgeX
        const seamFarEndX = windowLeftEdgeX
        const currentStartX = seamFarX + (seamNearX - seamFarX) * t
        const currentEndX = seamFarEndX + (seamNearEndX - seamFarEndX) * t
        ctx.beginPath()
        ctx.moveTo(currentStartX, seamY)
        ctx.lineTo(currentEndX, seamY)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 连接框架的铆钉（带透视）
      ctx.fillStyle = '#3a3a4e'
      for (let row = 0; row < horizontalSeams; row++) {
        for (let col = 0; col < supportCount; col++) {
          const rowT = (row + 0.5) / horizontalSeams
          const colT = (col + 0.5) / supportCount
          const rivetY = connectionFrameTop + (connectionFrameBottom - connectionFrameTop) * rowT
          const rivetNearX = leftWallNearEdgeX + connectionFrameNearWidth * colT
          const rivetFarX = leftWallFarEdgeX + connectionFrameFarWidth * colT
          const rivetX = rivetFarX + (rivetNearX - rivetFarX) * rowT
          const rivetSize = 1.2 + rowT * 0.8 // 近处大，远处小
          ctx.beginPath()
          ctx.arc(rivetX, rivetY, rivetSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#5a5a6e'
          ctx.beginPath()
          ctx.arc(rivetX - 0.3, rivetY - 0.3, rivetSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#3a3a4e'
        }
      }
      
      // 连接框架边缘高光（与窗口框架融合，带透视）
      ctx.save()
      const leftConnectionEdgeGradient = ctx.createLinearGradient(windowLeftEdgeX - 3, connectionFrameTop, windowLeftEdgeX, connectionFrameBottom)
      leftConnectionEdgeGradient.addColorStop(0, 'rgba(0, 255, 255, 0.08)')
      leftConnectionEdgeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.18)')
      ctx.fillStyle = leftConnectionEdgeGradient
      ctx.beginPath()
      ctx.moveTo(windowLeftEdgeX - 3, connectionFrameTop)
      ctx.lineTo(windowLeftEdgeX, connectionFrameTop)
      ctx.lineTo(windowLeftEdgeX, connectionFrameBottom)
      ctx.lineTo(windowLeftEdgeX - 3, connectionFrameBottom)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // 连接框架边框（带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(leftWallNearEdgeX, connectionFrameBottom)
      ctx.lineTo(windowLeftEdgeX, connectionFrameBottom)
      ctx.lineTo(windowLeftEdgeX, connectionFrameTop)
      ctx.lineTo(leftWallFarEdgeX, connectionFrameTop)
      ctx.closePath()
      ctx.stroke()
      
      // 连接框架内边框（发光，与窗口框架呼应，带透视）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.moveTo(leftWallNearEdgeX + 2, connectionFrameBottom - 2)
      ctx.lineTo(windowLeftEdgeX - 2, connectionFrameBottom - 2)
      ctx.lineTo(windowLeftEdgeX - 2, connectionFrameTop + 2)
      ctx.lineTo(leftWallFarEdgeX + 2, connectionFrameTop + 2)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1

      // ========== 绘制右侧舱壁（带透视效果，近大远小） ==========
      const rightWallTop = windowTop
      const rightWallHeight = windowBottom - windowTop  // 窗口区域的高度
      const rightWallBottom = rightWallTop + rightWallHeight
      
      // 右侧舱壁的近端（底部，靠近观察者）和远端（顶部，远离观察者）
      const rightWallNearWidth = width - (panelLeft + panelWidth) // 近端宽度（底部）
      const rightWallFarWidth = rightWallNearWidth * wallPerspectiveScale // 远端宽度（顶部，透视缩小）
      const rightWallNearY = rightWallBottom // 近端Y位置（底部）
      const rightWallFarY = rightWallTop // 远端Y位置（顶部）
      
      // 右侧舱壁的边缘位置
      const rightWallNearEdgeX = panelLeft + panelWidth // 近端边缘
      const rightWallFarEdgeX = width - rightWallFarWidth // 远端边缘

      // 右侧舱壁基础（深色金属，带透视的梯形）
      ctx.save()
      ctx.beginPath()
      // 绘制透视梯形（近大远小）
      ctx.moveTo(rightWallNearEdgeX, rightWallNearY) // 左下角（近端）
      ctx.lineTo(width, rightWallNearY) // 右下角（近端）
      ctx.lineTo(width, rightWallFarY) // 右上角（远端）
      ctx.lineTo(rightWallFarEdgeX, rightWallFarY) // 左上角（远端）
      ctx.closePath()
      
      // 渐变填充（从近到远，从亮到暗）
      const rightWallBaseGradient = ctx.createLinearGradient(rightWallNearEdgeX, rightWallNearY, rightWallFarEdgeX, rightWallFarY)
      rightWallBaseGradient.addColorStop(0, '#0f0f1e')
      rightWallBaseGradient.addColorStop(0.2, '#1a1a2e')
      rightWallBaseGradient.addColorStop(0.6, '#1a1a2e')
      rightWallBaseGradient.addColorStop(1, '#0a0a1a')
      ctx.fillStyle = rightWallBaseGradient
      ctx.fill()
      
      // 添加深度渐变（从近到远逐渐变暗）
      const rightDepthGradient = ctx.createLinearGradient(rightWallNearEdgeX, rightWallNearY, rightWallFarEdgeX, rightWallFarY)
      rightDepthGradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
      rightDepthGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)')
      rightDepthGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)')
      rightDepthGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
      ctx.fillStyle = rightDepthGradient
      ctx.fill()
      ctx.restore()

      // 右侧舱壁面板接缝（垂直，带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      for (let i = 1; i < 4; i++) {
        const ratio = i / 4
        const nearX = rightWallNearEdgeX + rightWallNearWidth * ratio
        const farX = rightWallFarEdgeX + rightWallFarWidth * ratio
        ctx.beginPath()
        ctx.moveTo(farX, rightWallFarY) // 远端
        ctx.lineTo(nearX, rightWallNearY) // 近端
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 右侧舱壁面板接缝（水平，带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      for (let i = 1; i < horizontalSeams; i++) {
        const t = i / horizontalSeams
        const seamY = rightWallFarY + (rightWallNearY - rightWallFarY) * t
        const seamNearWidth = rightWallNearWidth
        const seamFarWidth = rightWallFarWidth
        const currentWidth = seamFarWidth + (seamNearWidth - seamFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(rightWallFarEdgeX, seamY)
        ctx.lineTo(rightWallFarEdgeX + currentWidth, seamY)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 右侧舱壁铆钉（沿接缝，带透视）
      ctx.fillStyle = '#3a3a4e'
      for (let row = 0; row < horizontalSeams; row++) {
        for (let col = 0; col < 4; col++) {
          const t = (row + 0.5) / horizontalSeams
          const rivetY = rightWallFarY + (rightWallNearY - rightWallFarY) * t
          const nearX = rightWallNearEdgeX + (rightWallNearWidth / 4) * col + (rightWallNearWidth / 8)
          const farX = rightWallFarEdgeX + (rightWallFarWidth / 4) * col + (rightWallFarWidth / 8)
          const rivetX = farX + (nearX - farX) * t
          const rivetSize = 1.5 + t * 0.5 // 近处大，远处小
          ctx.beginPath()
          ctx.arc(rivetX, rivetY, rivetSize, 0, Math.PI * 2)
          ctx.fill()
          // 铆钉高光
          ctx.fillStyle = '#5a5a6e'
          ctx.beginPath()
          ctx.arc(rivetX - 0.3, rivetY - 0.3, rivetSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#3a3a4e'
        }
      }

      // 右侧舱壁金属纹理（划痕和磨损）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.3
      for (let i = 0; i < 15; i++) {
        const scratchY = rightWallTop + Math.random() * rightWallHeight
        const scratchLength = 20 + Math.random() * 30
        // 根据Y位置计算对应的宽度（透视效果：顶部窄，底部宽）
        const t = (scratchY - rightWallTop) / rightWallHeight // 0=顶部, 1=底部
        const currentWallWidth = rightWallFarWidth + (rightWallNearWidth - rightWallFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(rightWallFarEdgeX + Math.random() * (rightWallNearEdgeX - rightWallFarEdgeX), scratchY)
        ctx.lineTo(rightWallFarEdgeX + Math.random() * (rightWallNearEdgeX - rightWallFarEdgeX), scratchY + scratchLength)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 右侧舱壁管道（垂直，带透视）
      const rightPipeCount = 3
      for (let i = 0; i < rightPipeCount; i++) {
        const pipeRatio = (i + 1) / (rightPipeCount + 1)
        // 近端和远端的管道位置
        const pipeNearX = rightWallNearEdgeX + rightWallNearWidth * pipeRatio
        const pipeFarX = rightWallFarEdgeX + rightWallFarWidth * pipeRatio
        const pipeStartY = rightWallFarY + 40
        const pipeEndY = rightWallNearY - 40
        // 管道宽度（近大远小）
        const pipeNearWidth = 6
        const pipeFarWidth = 4
        
        // 管道主体（透视梯形）
        ctx.beginPath()
        ctx.moveTo(pipeFarX - pipeFarWidth / 2, pipeStartY) // 左上
        ctx.lineTo(pipeFarX + pipeFarWidth / 2, pipeStartY) // 右上
        ctx.lineTo(pipeNearX + pipeNearWidth / 2, pipeEndY) // 右下
        ctx.lineTo(pipeNearX - pipeNearWidth / 2, pipeEndY) // 左下
        ctx.closePath()
        
        // 管道渐变
        const rightPipeGradient = ctx.createLinearGradient(pipeFarX - pipeFarWidth / 2, pipeStartY, pipeNearX + pipeNearWidth / 2, pipeEndY)
        rightPipeGradient.addColorStop(0, '#2a2a3e')
        rightPipeGradient.addColorStop(0.5, '#3a3a4e')
        rightPipeGradient.addColorStop(1, '#2a2a3e')
        ctx.fillStyle = rightPipeGradient
        ctx.fill()
        
        // 管道高光（左侧边缘）
        ctx.strokeStyle = '#4a4a5e'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(pipeFarX - pipeFarWidth / 2 + 0.5, pipeStartY)
        ctx.lineTo(pipeNearX - pipeNearWidth / 2 + 0.5, pipeEndY)
        ctx.stroke()
        
        // 管道连接环（带透视）
        for (let ringIndex = 1; ringIndex < 5; ringIndex++) {
          const ringT = ringIndex / 5
          const ringY = pipeStartY + (pipeEndY - pipeStartY) * ringT
          const ringX = pipeFarX + (pipeNearX - pipeFarX) * ringT
          const ringWidth = pipeFarWidth + (pipeNearWidth - pipeFarWidth) * ringT
          ctx.strokeStyle = '#1a1a2e'
          ctx.lineWidth = 1.5 + ringT * 0.5
          ctx.strokeRect(ringX - ringWidth / 2 - 1, ringY - 2, ringWidth + 2, 4)
        }
      }

      // 右侧舱壁线缆（水平，带透视）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4
      for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 6
        const cableY = rightWallFarY + (rightWallNearY - rightWallFarY) * t
        const cableNearWidth = rightWallNearWidth - 10
        const cableFarWidth = rightWallFarWidth - 10
        const currentWidth = cableFarWidth + (cableNearWidth - cableFarWidth) * t
        ctx.beginPath()
        ctx.moveTo(rightWallFarEdgeX + 10, cableY)
        ctx.lineTo(rightWallFarEdgeX + 10 + currentWidth, cableY)
        ctx.stroke()
        // 线缆高光
        ctx.strokeStyle = accentColor2
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(rightWallFarEdgeX + 10, cableY - 0.5)
        ctx.lineTo(rightWallFarEdgeX + 10 + currentWidth, cableY - 0.5)
        ctx.stroke()
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 1.5
      }
      ctx.globalAlpha = 1

      // 右侧舱壁边缘高光（带透视）
      ctx.save()
      const rightEdgeGradient = ctx.createLinearGradient(width - 3, rightWallNearY, width, rightWallFarY)
      rightEdgeGradient.addColorStop(0, 'rgba(0, 255, 255, 0.12)')
      rightEdgeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.05)')
      ctx.fillStyle = rightEdgeGradient
      ctx.beginPath()
      ctx.moveTo(width - 3, rightWallNearY)
      ctx.lineTo(width, rightWallNearY)
      ctx.lineTo(width, rightWallFarY)
      ctx.lineTo(width - 3, rightWallFarY)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // 右侧舱壁边框（深色金属，带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(rightWallNearEdgeX, rightWallNearY)
      ctx.lineTo(width, rightWallNearY)
      ctx.lineTo(width, rightWallFarY)
      ctx.lineTo(rightWallFarEdgeX, rightWallFarY)
      ctx.closePath()
      ctx.stroke()
      
      // 右侧舱壁内边框（发光，带透视）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(rightWallNearEdgeX + 2, rightWallNearY - 2)
      ctx.lineTo(width - 2, rightWallNearY - 2)
      ctx.lineTo(width - 2, rightWallFarY + 2)
      ctx.lineTo(rightWallFarEdgeX + 2, rightWallFarY + 2)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1

      // ========== 右侧舱壁与窗口的连接框架（带透视） ==========
      // 连接框架（从窗口延伸到右侧舱壁，带透视）
      const rightConnectionFrameNearWidth = rightWallNearEdgeX - windowRightEdgeX // 近端宽度
      const rightConnectionFrameFarWidth = rightWallFarEdgeX - windowRightEdgeX // 远端宽度（透视缩小）
      const rightConnectionFrameTop = windowTop
      const rightConnectionFrameBottom = rightWallBottom
      
      // 连接框架基础（深色金属，与舱壁融合，带透视的梯形）
      ctx.beginPath()
      ctx.moveTo(windowRightEdgeX, rightConnectionFrameBottom) // 左下角（近端）
      ctx.lineTo(rightWallNearEdgeX, rightConnectionFrameBottom) // 右下角（近端）
      ctx.lineTo(rightWallFarEdgeX, rightConnectionFrameTop) // 右上角（远端）
      ctx.lineTo(windowRightEdgeX, rightConnectionFrameTop) // 左上角（远端）
      ctx.closePath()
      
      const rightConnectionGradient = ctx.createLinearGradient(windowRightEdgeX, rightConnectionFrameBottom, rightWallNearEdgeX, rightConnectionFrameTop)
      rightConnectionGradient.addColorStop(0, '#0a0a1a')
      rightConnectionGradient.addColorStop(0.5, '#0f0f1e')
      rightConnectionGradient.addColorStop(1, '#1a1a2e')
      ctx.fillStyle = rightConnectionGradient
      ctx.fill()
      
      // 连接框架深度渐变
      const rightConnectionDepthGradient = ctx.createLinearGradient(windowRightEdgeX, rightConnectionFrameBottom, windowRightEdgeX, rightConnectionFrameTop)
      rightConnectionDepthGradient.addColorStop(0, 'rgba(255, 255, 255, 0.03)')
      rightConnectionDepthGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
      ctx.fillStyle = rightConnectionDepthGradient
      ctx.fill()
      
      // 连接框架的垂直支撑结构（带透视）
      ctx.strokeStyle = '#2a2a3e'
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.6
      for (let i = 1; i < supportCount; i++) {
        const ratio = i / supportCount
        const supportNearX = windowRightEdgeX + rightConnectionFrameNearWidth * ratio
        const supportFarX = windowRightEdgeX + rightConnectionFrameFarWidth * ratio
        ctx.beginPath()
        ctx.moveTo(supportFarX, rightConnectionFrameTop)
        ctx.lineTo(supportNearX, rightConnectionFrameBottom)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 连接框架的水平加强筋（带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5
      for (let i = 1; i < horizontalSeams; i++) {
        const t = i / horizontalSeams
        const seamY = rightConnectionFrameTop + (rightConnectionFrameBottom - rightConnectionFrameTop) * t
        const seamNearX = windowRightEdgeX
        const seamFarX = windowRightEdgeX
        const seamNearEndX = rightWallNearEdgeX
        const seamFarEndX = rightWallFarEdgeX
        const currentStartX = seamFarX + (seamNearX - seamFarX) * t
        const currentEndX = seamFarEndX + (seamNearEndX - seamFarEndX) * t
        ctx.beginPath()
        ctx.moveTo(currentStartX, seamY)
        ctx.lineTo(currentEndX, seamY)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      
      // 连接框架的铆钉（带透视）
      ctx.fillStyle = '#3a3a4e'
      for (let row = 0; row < horizontalSeams; row++) {
        for (let col = 0; col < supportCount; col++) {
          const rowT = (row + 0.5) / horizontalSeams
          const colT = (col + 0.5) / supportCount
          const rivetY = rightConnectionFrameTop + (rightConnectionFrameBottom - rightConnectionFrameTop) * rowT
          const rivetNearX = windowRightEdgeX + rightConnectionFrameNearWidth * colT
          const rivetFarX = windowRightEdgeX + rightConnectionFrameFarWidth * colT
          const rivetX = rivetFarX + (rivetNearX - rivetFarX) * rowT
          const rivetSize = 1.2 + rowT * 0.8 // 近处大，远处小
          ctx.beginPath()
          ctx.arc(rivetX, rivetY, rivetSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#5a5a6e'
          ctx.beginPath()
          ctx.arc(rivetX - 0.3, rivetY - 0.3, rivetSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#3a3a4e'
        }
      }
      
      // 连接框架边缘高光（与窗口框架融合，带透视）
      ctx.save()
      const rightConnectionEdgeGradient = ctx.createLinearGradient(windowRightEdgeX, rightConnectionFrameTop, windowRightEdgeX + 3, rightConnectionFrameBottom)
      rightConnectionEdgeGradient.addColorStop(0, 'rgba(0, 255, 255, 0.18)')
      rightConnectionEdgeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.08)')
      ctx.fillStyle = rightConnectionEdgeGradient
      ctx.beginPath()
      ctx.moveTo(windowRightEdgeX, rightConnectionFrameTop)
      ctx.lineTo(windowRightEdgeX + 3, rightConnectionFrameTop)
      ctx.lineTo(windowRightEdgeX + 3, rightConnectionFrameBottom)
      ctx.lineTo(windowRightEdgeX, rightConnectionFrameBottom)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // 连接框架边框（带透视）
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(windowRightEdgeX, rightConnectionFrameBottom)
      ctx.lineTo(rightWallNearEdgeX, rightConnectionFrameBottom)
      ctx.lineTo(rightWallFarEdgeX, rightConnectionFrameTop)
      ctx.lineTo(windowRightEdgeX, rightConnectionFrameTop)
      ctx.closePath()
      ctx.stroke()
      
      // 连接框架内边框（发光，与窗口框架呼应，带透视）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.moveTo(windowRightEdgeX + 2, rightConnectionFrameBottom - 2)
      ctx.lineTo(rightWallNearEdgeX - 2, rightConnectionFrameBottom - 2)
      ctx.lineTo(rightWallFarEdgeX - 2, rightConnectionFrameTop + 2)
      ctx.lineTo(windowRightEdgeX + 2, rightConnectionFrameTop + 2)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1

      // ========== 添加空间深度指示元素（已移除，因为不再有左右侧舱壁） ==========

      // 绘制底部控制台
      const bottomConsoleTop = panelTop + panelHeight
      const bottomConsoleHeight = height - bottomConsoleTop

      ctx.fillStyle = panelColor
      ctx.fillRect(0, bottomConsoleTop, width, bottomConsoleHeight)

      // 底部装饰线条
      for (let i = 0; i < 3; i++) {
        const y = bottomConsoleTop + 10 + i * 20
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.4 - i * 0.1
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 底部状态显示
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      const statusText = `SYSTEM STATUS: ALL SYSTEMS OPERATIONAL | TIME: ${new Date().toLocaleTimeString()}`
      ctx.fillText(statusText, width / 2, bottomConsoleTop + bottomConsoleHeight - 15)

      // ========== 统一的光照效果（简化版，因为不再有左右侧舱壁） ==========
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      // 中心区域的环境光（让窗口区域稍微更亮）
      const windowCenterRadius = Math.max(middleWindowWidth, middleSectionHeight) / 2
      const centerLightGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, windowCenterRadius * 1.5)
      centerLightGradient.addColorStop(0, 'rgba(0, 255, 255, 0.03)')
      centerLightGradient.addColorStop(0.4, 'rgba(0, 255, 255, 0.015)')
      centerLightGradient.addColorStop(0.8, 'rgba(0, 255, 255, 0.008)')
      centerLightGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = centerLightGradient
      ctx.fillRect(middleWindowLeft, middleSectionTop, middleWindowWidth, middleSectionHeight)
      ctx.restore()


      // 侧边装饰元素已在舱壁绘制中完成
      */
      
      // ========== 列表按钮（在上传按钮左侧） ==========
      const listBtnX = listButtonInfo.x
      const listBtnY = listButtonInfo.y
      const listBtnW = listButtonInfo.width
      const listBtnH = listButtonInfo.height
      const listBtnR = listButtonInfo.radius
      
      // 列表按钮背景（动态发光效果，圆角）
      const listButtonGlowValue = 0.5 + Math.sin(time * 0.003 + 0.5) * 0.3
      ctx.fillStyle = accentColor2
      ctx.globalAlpha = listButtonGlowValue * 0.4
      ctx.beginPath()
      ctx.roundRect(listBtnX - 3, listBtnY - 3, listBtnW + 6, listBtnH + 6, listBtnR + 2)
      ctx.fill()
      ctx.globalAlpha = 1
      
      // 列表按钮主体（圆角矩形）
      ctx.fillStyle = '#2a2a4e'
      ctx.beginPath()
      ctx.roundRect(listBtnX, listBtnY, listBtnW, listBtnH, listBtnR)
      ctx.fill()
      
      // 列表按钮边框（动态，圆角）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 3
      ctx.shadowBlur = 8 + Math.sin(time * 0.003 + 0.5) * 4
      ctx.shadowColor = accentColor2
      ctx.beginPath()
      ctx.roundRect(listBtnX, listBtnY, listBtnW, listBtnH, listBtnR)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 列表按钮内边框（圆角）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(listBtnX + 2, listBtnY + 2, listBtnW - 4, listBtnH - 4, listBtnR - 1)
      ctx.stroke()
      
      // 列表按钮图标（列表/网格图标）
      const listIconX = listBtnX + listBtnW / 2
      const listIconY = listBtnY + listBtnH / 2 - 2
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 6
      ctx.shadowColor = accentColor2
      // 绘制网格图标（3x3网格）
      const iconGridSize = 8
      const iconGridSpacing = 3
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = listIconX - iconGridSize + col * iconGridSpacing
          const y = listIconY - iconGridSize + row * iconGridSpacing
          ctx.fillStyle = accentColor2
          ctx.fillRect(x, y, 2, 2)
        }
      }
      ctx.shadowBlur = 0
      
      // 列表按钮文字
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.fillText('LIST', listIconX, listBtnY + listBtnH - 8)
      ctx.shadowBlur = 0
      
      // 列表按钮交互提示
      const mouseInListButton = mousePos.x >= listBtnX && 
                                mousePos.x <= listBtnX + listBtnW &&
                                mousePos.y >= listBtnY && 
                                mousePos.y <= listBtnY + listBtnH
      
      setIsHoveringList(mouseInListButton)
      
      if (mouseInListButton) {
        // 悬停时的外发光效果（圆角）
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 4
        ctx.globalAlpha = 0.9
        ctx.shadowBlur = 12
        ctx.shadowColor = accentColor1
        ctx.beginPath()
        ctx.roundRect(listBtnX - 4, listBtnY - 4, listBtnW + 8, listBtnH + 8, listBtnR + 3)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        
        // 悬停时的背景高亮（圆角）
        ctx.fillStyle = accentColor1
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.roundRect(listBtnX, listBtnY, listBtnW, listBtnH, listBtnR)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // ========== 上传按钮（最后绘制，位于控制面板右上角，确保在所有元素之上） ==========
      // 使用之前计算的按钮位置信息
      const buttonX = uploadButtonInfo.x
      const buttonY = uploadButtonInfo.y
      const buttonW = uploadButtonInfo.width
      const buttonH = uploadButtonInfo.height
      const buttonR = uploadButtonInfo.radius
      
      // 按钮背景（动态发光效果，圆角）
      const buttonGlowValue = 0.5 + Math.sin(time * 0.003) * 0.3
      ctx.fillStyle = accentColor1
      ctx.globalAlpha = buttonGlowValue * 0.4
      ctx.beginPath()
      ctx.roundRect(buttonX - 3, buttonY - 3, buttonW + 6, buttonH + 6, buttonR + 2)
      ctx.fill()
      ctx.globalAlpha = 1
      
      // 按钮主体（圆角矩形）
      ctx.fillStyle = '#2a2a4e'
      ctx.beginPath()
      ctx.roundRect(buttonX, buttonY, buttonW, buttonH, buttonR)
      ctx.fill()
      
      // 按钮边框（动态，圆角）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 8 + Math.sin(time * 0.003) * 4
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.roundRect(buttonX, buttonY, buttonW, buttonH, buttonR)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 按钮内边框（圆角）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(buttonX + 2, buttonY + 2, buttonW - 4, buttonH - 4, buttonR - 1)
      ctx.stroke()
      
      // 按钮图标（上传箭头）
      const iconX = buttonX + buttonW / 2
      const iconY = buttonY + buttonH / 2 - 2
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.shadowBlur = 6
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      // 向上箭头
      ctx.moveTo(iconX, iconY - 8)
      ctx.lineTo(iconX - 5, iconY - 1)
      ctx.lineTo(iconX, iconY - 3)
      ctx.lineTo(iconX + 5, iconY - 1)
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 按钮文字
      ctx.fillStyle = accentColor1
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor1
      ctx.fillText('UPLOAD', iconX, buttonY + buttonH - 8)
      ctx.shadowBlur = 0
      
      // 按钮交互提示（根据鼠标位置）
      // buttonX, buttonY 和 mousePos 都使用逻辑坐标（CSS 像素坐标）
      const mouseInButton = mousePos.x >= buttonX && 
                            mousePos.x <= buttonX + buttonW &&
                            mousePos.y >= buttonY && 
                            mousePos.y <= buttonY + buttonH
      
      setIsHoveringUpload(mouseInButton)
      
      if (mouseInButton) {
        // 悬停时的外发光效果（圆角）
        ctx.strokeStyle = accentColor2
        ctx.lineWidth = 4
        ctx.globalAlpha = 0.9
        ctx.shadowBlur = 12
        ctx.shadowColor = accentColor2
        ctx.beginPath()
        ctx.roundRect(buttonX - 4, buttonY - 4, buttonW + 8, buttonH + 8, buttonR + 3)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        
        // 悬停时的背景高亮（圆角）
        ctx.fillStyle = accentColor2
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.roundRect(buttonX, buttonY, buttonW, buttonH, buttonR)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // ========== 清除窗口内部区域，使其透明（在所有绘制完成后，最后执行） ==========
      // 注意：这个操作必须在所有绘制操作（包括底部控制台、按钮等）完成后执行，才能正确显示星空背景
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      
      // 清除三段式窗口区域：上段左右三角形 + 中段长方形（完全透明）
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      const clearMargin = 2 // 清除边距，避免清除框架
      
      // 清除左三角形窗口区域（使用曲线路径，与框架一致）
      ctx.beginPath()
      ctx.moveTo(clearMargin, topSectionTop + clearMargin)
      // 使用曲线连接到中段（与框架曲线一致）
      ctx.quadraticCurveTo(
        middleWindowLeft * 0.5,
        topSectionTop + (middleSectionTop - topSectionTop) * 0.7,
        middleWindowLeft - clearMargin,
        middleSectionTop + clearMargin
      )
      ctx.quadraticCurveTo(
        (middleWindowLeft + topTrapezoidBottomLeft) / 2,
        (middleSectionTop + topSectionBottom) / 2,
        topTrapezoidBottomLeft - clearMargin,
        topSectionBottom - clearMargin
      )
      ctx.lineTo(topTrapezoidTopLeft + clearMargin, topSectionTop + clearMargin)
      ctx.closePath()
      ctx.fill()
      
      // 清除中段长方形窗口区域（完全透明）
      ctx.beginPath()
      ctx.moveTo(middleWindowLeft + clearMargin, middleSectionTop + clearMargin)
      ctx.lineTo(middleWindowRight - clearMargin, middleSectionTop + clearMargin)
      ctx.lineTo(middleWindowRight - clearMargin, middleSectionBottom - clearMargin)
      ctx.lineTo(middleWindowLeft + clearMargin, middleSectionBottom - clearMargin)
      ctx.closePath()
      ctx.fill()
      
      // 清除右三角形窗口区域（使用曲线路径，与框架一致）
      ctx.beginPath()
      ctx.moveTo(width - clearMargin, topSectionTop + clearMargin)
      ctx.quadraticCurveTo(
        middleWindowRight + (width - middleWindowRight) * 0.5,
        topSectionTop + (middleSectionTop - topSectionTop) * 0.7,
        middleWindowRight + clearMargin,
        middleSectionTop + clearMargin
      )
      ctx.quadraticCurveTo(
        (middleWindowRight + topTrapezoidBottomRight) / 2,
        (middleSectionTop + topSectionBottom) / 2,
        topTrapezoidBottomRight + clearMargin,
        topSectionBottom - clearMargin
      )
      ctx.lineTo(topTrapezoidTopRight - clearMargin, topSectionTop + clearMargin)
      ctx.closePath()
      ctx.fill()
      
      ctx.restore()
    }

    // 动画循环
    const animate = (time: number) => {
      drawCockpit(time)
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animationFrameRef.current = requestAnimationFrame(animate)

    // 监听窗口大小变化
    const handleResize = () => {
      setPixelPerfect()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // 处理鼠标移动和点击
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    // 使用逻辑坐标（CSS 像素坐标），与绘制时的坐标系统一致
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }
  
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    // 计算点击位置的逻辑坐标（与绘制时使用的坐标系统一致）
    // 因为 ctx.scale(dpr, dpr)，绘制时使用的是逻辑坐标（对应 CSS 像素）
    // 所以点击坐标直接使用相对于 canvas 的 CSS 像素坐标即可
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    
    // 重新计算按钮位置（与绘制函数中的逻辑一致）
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    const centerX = width / 2
    
    // 使用新的三段式结构变量
    const topSectionBottom = height * 0.25 // 上段底部位置
    const middleSectionTop = topSectionBottom
    const middleSectionBottom = height * 0.65 // 中段底部位置
    const bottomSectionTop = middleSectionBottom
    
    const panelTop = bottomSectionTop  // 控制面板顶部位置（下段）
    const panelHeight = height - bottomSectionTop  // 控制面板高度（下段高度）
    const panelWidth = width * 0.85  // 控制面板宽度
    const panelLeft = centerX - panelWidth / 2
    
    // 按钮位置计算（与绘制函数中的逻辑一致）
    const uploadButtonWidth = 120
    const uploadButtonHeight = 38
    const buttonMargin = 15
    const finalButtonX = panelLeft + panelWidth * 0.72 - uploadButtonWidth - buttonMargin
    const uploadButtonY = panelTop + panelHeight * 0.3
    
    // 检查点击位置是否在按钮区域内（使用逻辑坐标）
    // 注意：由于 canvas 的 pointerEvents 设置为 'none'，此函数实际上不会被调用
    // 保留此函数作为备用方案
    const isInButton = clickX >= finalButtonX && 
                      clickX <= finalButtonX + uploadButtonWidth &&
                      clickY >= uploadButtonY && 
                      clickY <= uploadButtonY + uploadButtonHeight
    
    if (isInButton) {
      e.preventDefault()
      e.stopPropagation()
      router.push('/upload')
    }
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0"
        style={{ 
          zIndex: 5,
          imageRendering: 'crisp-edges',
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          cursor: (isHoveringUpload || isHoveringList) ? 'pointer' : 'default',
          pointerEvents: 'none' // Canvas 不拦截点击，让透明按钮处理
        }}
        onMouseMove={handleMouseMove}
      />
      {/* 列表按钮 */}
      {listButtonPosition && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (listButtonPosition) {
              setIsHudOpen(true)
            }
          }}
          onMouseEnter={() => setIsHoveringList(true)}
          onMouseLeave={() => setIsHoveringList(false)}
          style={{
            position: 'fixed',
            left: `${listButtonPosition.x}px`,
            top: `${listButtonPosition.y}px`,
            width: `${listButtonPosition.width}px`,
            height: `${listButtonPosition.height}px`,
            zIndex: 100,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            pointerEvents: 'auto'
          }}
          aria-label="打开训练条目列表"
        />
      )}
      {/* 上传按钮 */}
      {buttonPosition && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            router.push('/upload')
          }}
          onMouseEnter={() => setIsHoveringUpload(true)}
          onMouseLeave={() => setIsHoveringUpload(false)}
          style={{
            position: 'fixed',
            left: `${buttonPosition.x}px`,
            top: `${buttonPosition.y}px`,
            width: `${buttonPosition.width}px`,
            height: `${buttonPosition.height}px`,
            zIndex: 100, // 确保在最上层，高于内容区域的 z-index 10
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            pointerEvents: 'auto' // 确保可以接收点击事件
          }}
          aria-label="上传新的训练条目"
        />
      )}
      {/* HUD屏幕 */}
      <HudScreen
        isOpen={isHudOpen}
        onClose={() => setIsHudOpen(false)}
        buttonPosition={listButtonPosition}
        trainingItems={trainingItems}
      />
    </>
  )
}
