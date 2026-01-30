'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CockpitOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const router = useRouter()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHoveringUpload, setIsHoveringUpload] = useState(false)
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

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

      // 中央半圆形窗户参数（扩大一倍）
      const centerX = width / 2
      const windowRadius = Math.min(width, height) * 0.7 // 从0.35扩大到0.7，扩大一倍
      const windowTop = height * 0.05 // 调整顶部位置以适应更大的窗口
      const windowCenterY = windowTop + windowRadius
      const paneCount = 3 // 三个分段
      const paneAngle = Math.PI / paneCount // 每个窗格的角度

      // 清除画布
      ctx.clearRect(0, 0, width, height)
      
      // 先填充整个背景
      ctx.fillStyle = cockpitColor
      ctx.fillRect(0, 0, width, height)

      // 绘制顶部控制台区域（缩小以适应更大的窗口）
      const topPanelHeight = Math.max(windowTop, 5) // 确保至少有一些顶部空间
      ctx.fillStyle = panelColor
      ctx.fillRect(0, 0, width, topPanelHeight)

      // 顶部装饰线条和细节
      for (let i = 0; i < 5; i++) {
        const y = topPanelHeight - 20 - i * 15
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3 - i * 0.05
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 顶部状态指示灯
      const indicatorSpacing = width / 12
      for (let i = 0; i < 12; i++) {
        const x = indicatorSpacing * i + indicatorSpacing / 2
        const y = topPanelHeight - 10
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

      // 绘制中央半圆形窗户框架（只绘制框架，不填充内部）
      // 使用路径绘制环形框架（外圈减去内圈）
      ctx.save()
      ctx.fillStyle = '#2d1b4e'
      ctx.beginPath()
      // 外圈（顺时针）
      ctx.arc(centerX, windowCenterY, windowRadius + 15, 0, Math.PI, true)
      // 内圈（逆时针，形成环形）
      ctx.arc(centerX, windowCenterY, windowRadius, Math.PI, 0, false)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      
      // 清除半圆形窗户内部区域，使其透明（使用destination-out混合模式）
      // 必须在绘制框架之后清除，这样框架不会被清除
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.beginPath()
      ctx.arc(centerX, windowCenterY, windowRadius, 0, Math.PI, true)
      ctx.fill()
      ctx.restore()

      // 绘制三个分段的窗格框架
      for (let i = 0; i < paneCount; i++) {
        const startAngle = Math.PI - (i * paneAngle)
        const endAngle = Math.PI - ((i + 1) * paneAngle)
        
        // 窗格分隔线
        ctx.strokeStyle = accentColor1
        ctx.lineWidth = 4
        ctx.shadowBlur = 6
        ctx.shadowColor = accentColor1
        ctx.beginPath()
        ctx.moveTo(centerX, windowCenterY)
        const angle = Math.PI - (i * paneAngle) - paneAngle / 2
        const x1 = centerX + Math.cos(angle) * windowRadius
        const y1 = windowCenterY + Math.sin(angle) * windowRadius
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // 绘制窗户外边框（粉红色发光）
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 5
      ctx.shadowBlur = 12
      ctx.shadowColor = accentColor1
      ctx.beginPath()
      ctx.arc(centerX, windowCenterY, windowRadius + 12, 0, Math.PI, true)
      ctx.stroke()
      ctx.shadowBlur = 0

      // 绘制窗户内边框（青色）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, windowCenterY, windowRadius - 2, 0, Math.PI, true)
      ctx.stroke()

      // 绘制半圆形下方的长方形控制面板
      const panelTop = windowCenterY + 5
      const panelHeight = windowRadius * 0.4
      const panelWidth = windowRadius * 2
      const panelLeft = centerX - panelWidth / 2

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

      // 绘制左侧控制台
      const leftConsoleWidth = panelLeft
      const leftConsoleTop = windowTop
      const leftConsoleHeight = height - windowTop - (height - panelTop - panelHeight)

      ctx.fillStyle = panelColor
      ctx.fillRect(0, leftConsoleTop, leftConsoleWidth, leftConsoleHeight)

      // 左侧控制台边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.strokeRect(0, leftConsoleTop, leftConsoleWidth, leftConsoleHeight)

      // 左侧多个屏幕
      const screenWidth = leftConsoleWidth * 0.75
      const screenHeight = 80
      const screenSpacing = 20
      const screenX = leftConsoleWidth * 0.125

      // 屏幕1 - 系统状态
      let screenY = leftConsoleTop + 30
      ctx.fillStyle = '#000000'
      ctx.fillRect(screenX, screenY, screenWidth, screenHeight)
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor2
      ctx.strokeRect(screenX, screenY, screenWidth, screenHeight)
      ctx.shadowBlur = 0
      
      ctx.fillStyle = accentColor2
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('[SYSTEM]', screenX + 6, screenY + 18)
      ctx.fillText('STATUS: ONLINE', screenX + 6, screenY + 35)
      ctx.fillText('POWER: 100%', screenX + 6, screenY + 52)
      ctx.fillText('TEMP: NORMAL', screenX + 6, screenY + 69)

      // 屏幕2 - 扫描数据
      screenY += screenHeight + screenSpacing
      ctx.fillStyle = '#000000'
      ctx.fillRect(screenX, screenY, screenWidth, screenHeight)
      ctx.strokeStyle = accentColor2
      ctx.strokeRect(screenX, screenY, screenWidth, screenHeight)
      ctx.fillStyle = accentColor2
      ctx.fillText('[SCAN]', screenX + 6, screenY + 18)
      ctx.fillText('TARGET: NONE', screenX + 6, screenY + 35)
      ctx.fillText('RANGE: MAX', screenX + 6, screenY + 52)
      ctx.fillText('SCAN: ACTIVE', screenX + 6, screenY + 69)

      // 屏幕3 - 通讯
      screenY += screenHeight + screenSpacing
      ctx.fillStyle = '#000000'
      ctx.fillRect(screenX, screenY, screenWidth, screenHeight)
      ctx.strokeStyle = accentColor2
      ctx.strokeRect(screenX, screenY, screenWidth, screenHeight)
      ctx.fillStyle = accentColor2
      ctx.fillText('[COMM]', screenX + 6, screenY + 18)
      ctx.fillText('LINK: ACTIVE', screenX + 6, screenY + 35)
      ctx.fillText('SIGNAL: STRONG', screenX + 6, screenY + 52)
      ctx.fillText('FREQ: 1420MHz', screenX + 6, screenY + 69)

      // 左侧按钮组
      const leftButtonX = leftConsoleWidth * 0.5
      const leftButtonY = screenY + screenHeight + 30
      const leftButtonSpacing = 25
      for (let i = 0; i < 6; i++) {
        const btnY = leftButtonY + i * leftButtonSpacing
        const isOn = Math.sin(time * 0.001 + i) > 0
        
        ctx.fillStyle = isOn ? accentColor2 : '#333344'
        ctx.fillRect(leftButtonX - 8, btnY - 4, 16, 8)
        
        if (isOn) {
          ctx.shadowBlur = 6
          ctx.shadowColor = accentColor2
          ctx.fillRect(leftButtonX - 8, btnY - 4, 16, 8)
          ctx.shadowBlur = 0
        }
      }

      // 绘制右侧控制台
      const rightConsoleWidth = width - (panelLeft + panelWidth)
      const rightConsoleTop = windowTop

      ctx.fillStyle = panelColor
      ctx.fillRect(panelLeft + panelWidth, rightConsoleTop, rightConsoleWidth, leftConsoleHeight)

      // 右侧控制台边框
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 3
      ctx.strokeRect(panelLeft + panelWidth, rightConsoleTop, rightConsoleWidth, leftConsoleHeight)

      // 右侧屏幕
      const rightScreenX = panelLeft + panelWidth + rightConsoleWidth * 0.125

      // 屏幕1 - 导航
      screenY = rightConsoleTop + 30
      ctx.fillStyle = '#000000'
      ctx.fillRect(rightScreenX, screenY, screenWidth, screenHeight)
      ctx.strokeStyle = accentColor1
      ctx.lineWidth = 2
      ctx.shadowBlur = 4
      ctx.shadowColor = accentColor1
      ctx.strokeRect(rightScreenX, screenY, screenWidth, screenHeight)
      ctx.shadowBlur = 0
      ctx.fillStyle = accentColor1
      ctx.fillText('[NAV]', rightScreenX + 6, screenY + 18)
      ctx.fillText('COURSE: SET', rightScreenX + 6, screenY + 35)
      ctx.fillText('SPEED: MAX', rightScreenX + 6, screenY + 52)
      ctx.fillText('ALT: 10000KM', rightScreenX + 6, screenY + 69)

      // 屏幕2 - 武器/系统
      screenY += screenHeight + screenSpacing
      ctx.fillStyle = '#000000'
      ctx.fillRect(rightScreenX, screenY, screenWidth, screenHeight)
      ctx.strokeStyle = accentColor1
      ctx.strokeRect(rightScreenX, screenY, screenWidth, screenHeight)
      ctx.fillStyle = accentColor1
      ctx.fillText('[WEAPON]', rightScreenX + 6, screenY + 18)
      ctx.fillText('STATUS: READY', rightScreenX + 6, screenY + 35)
      ctx.fillText('ENERGY: FULL', rightScreenX + 6, screenY + 52)
      ctx.fillText('TARGET: LOCKED', rightScreenX + 6, screenY + 69)

      // 屏幕3 - 全息投影区域
      screenY += screenHeight + screenSpacing
      const hologramSize = 60
      ctx.fillStyle = accentColor2
      ctx.globalAlpha = 0.2 + Math.sin(time * 0.003) * 0.15
      ctx.fillRect(rightScreenX + screenWidth / 2 - hologramSize / 2, screenY, 
                   hologramSize, hologramSize * 1.2)
      ctx.globalAlpha = 1
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 2
      ctx.shadowBlur = 8
      ctx.shadowColor = accentColor2
      ctx.strokeRect(rightScreenX + screenWidth / 2 - hologramSize / 2, screenY, 
                     hologramSize, hologramSize * 1.2)
      ctx.shadowBlur = 0

      // 右侧按钮和开关
      const rightButtonX = panelLeft + panelWidth + rightConsoleWidth * 0.5
      const rightButtonY = screenY + hologramSize * 1.2 + 20
      for (let i = 0; i < 6; i++) {
        const btnY = rightButtonY + i * leftButtonSpacing
        const isOn = Math.cos(time * 0.001 + i) > 0
        
        ctx.fillStyle = isOn ? accentColor1 : '#333344'
        ctx.fillRect(rightButtonX - 8, btnY - 4, 16, 8)
        
        if (isOn) {
          ctx.shadowBlur = 6
          ctx.shadowColor = accentColor1
          ctx.fillRect(rightButtonX - 8, btnY - 4, 16, 8)
          ctx.shadowBlur = 0
        }
      }

      // 绘制底部控制台
      const bottomPanelTop = panelTop + panelHeight
      const bottomPanelHeight = height - bottomPanelTop

      ctx.fillStyle = panelColor
      ctx.fillRect(0, bottomPanelTop, width, bottomPanelHeight)

      // 底部装饰线条
      for (let i = 0; i < 3; i++) {
        const y = bottomPanelTop + 10 + i * 20
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
      ctx.fillText(statusText, width / 2, bottomPanelTop + bottomPanelHeight - 15)


      // 绘制侧边装饰元素（管道、线路等）
      const pipeSpacing = 30
      for (let i = 0; i < Math.floor(leftConsoleHeight / pipeSpacing); i++) {
        const y = leftConsoleTop + i * pipeSpacing + 15
        ctx.strokeStyle = accentColor3
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(leftConsoleWidth - 10, y)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // 绘制连接线（科技感）
      ctx.strokeStyle = accentColor2
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.2
      for (let i = 0; i < 10; i++) {
        const x = leftConsoleWidth + (panelLeft - leftConsoleWidth) * (i / 10)
        ctx.beginPath()
        ctx.moveTo(x, leftConsoleTop)
        ctx.lineTo(x, panelTop)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

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
    const windowRadius = Math.min(width, height) * 0.7
    const windowTop = height * 0.05
    const windowCenterY = windowTop + windowRadius
    
    const panelTop = windowCenterY + 5
    const panelHeight = windowRadius * 0.4
    const panelWidth = windowRadius * 2
    const panelLeft = centerX - panelWidth / 2
    
    // 按钮位置计算（与绘制函数中的逻辑一致）
    const uploadButtonWidth = 120
    const uploadButtonHeight = 38
    const buttonMargin = 15
    const finalButtonX = panelLeft + panelWidth * 0.72 - uploadButtonWidth - buttonMargin
    const uploadButtonY = panelTop + panelHeight * 0.3
    
    // 检查点击位置是否在按钮区域内（使用逻辑坐标）
    const isInButton = clickX >= finalButtonX && 
                      clickX <= finalButtonX + uploadButtonWidth &&
                      clickY >= uploadButtonY && 
                      clickY <= uploadButtonY + uploadButtonHeight
    
    // 调试信息
    console.log('Click detected:', {
      clickX,
      clickY,
      buttonX: finalButtonX,
      buttonY: uploadButtonY,
      buttonWidth: uploadButtonWidth,
      buttonHeight: uploadButtonHeight,
      isInButton
    })
    
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
          cursor: isHoveringUpload ? 'pointer' : 'default',
          pointerEvents: 'none' // Canvas 不拦截点击，让透明按钮处理
        }}
        onMouseMove={handleMouseMove}
      />
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
            zIndex: 6, // 在 canvas 之上
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            margin: 0
          }}
          aria-label="上传新的训练条目"
        />
      )}
    </>
  )
}
