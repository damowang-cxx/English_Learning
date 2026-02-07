'use client'

import React, { useEffect, useState } from 'react'
import { Rocket, Activity, Shield, Target, Menu, X, Home } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface TrainingItem {
  id: string
  title: string
  createdAt: string
  sentences: Array<{ id: string }>
}

// -----------------------------------------------------------------------------
// 组件：UI 仪表盘组件 (HUD Elements)
// -----------------------------------------------------------------------------

// 速度仪表盘 - 优化版（支持动态数值）
const Speedometer = ({ speed }: { speed: number }) => (
  <div className="relative w-36 h-36 flex items-center justify-center">
    {/* 外圈装饰环 */}
    <div className="absolute w-full h-full border-4 border-cyan-900/50 rounded-full border-b-transparent animate-spin-slow" style={{borderBottomColor: 'transparent', transform: 'rotate(45deg)'}}></div>
    <div className="absolute w-32 h-32 border-2 border-cyan-500/60 rounded-full border-t-transparent animate-pulse"></div>
    
    {/* 内部刻度线 - 使用SVG */}
    <svg className="absolute w-28 h-28" viewBox="0 0 28 28">
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180)
        const centerX = 14
        const centerY = 14
        const radius1 = 12
        const radius2 = 14
        const x1 = centerX + Math.cos(angle) * radius1
        const y1 = centerY + Math.sin(angle) * radius1
        const x2 = centerX + Math.cos(angle) * radius2
        const y2 = centerY + Math.sin(angle) * radius2
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(0, 243, 255, 0.5)"
            strokeWidth="0.5"
          />
        )
      })}
    </svg>
    
    {/* 中心光点 */}
    <div className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(0,243,255,0.8)] animate-pulse z-10"></div>
    
    {/* 数值 */}
    <div className="text-center z-10 relative">
      <div className="text-3xl font-bold text-cyan-400 font-mono tracking-tighter drop-shadow-[0_0_8px_rgba(0,243,255,0.9)]">
        {Math.round(speed)}
      </div>
      <div className="text-[10px] text-cyan-500 font-mono mt-1 tracking-wider">KM/S</div>
      {/* 数值下方的装饰线 */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
    </div>
  </div>
)

// 能量条 - 优化版
const EnergyBar = ({ label, color, value }: { label: string; color: string; value: string | number }) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <span className="text-gray-300 tracking-wider">{label}</span>
        <span className="text-cyan-400 font-bold" style={{ textShadow: `0 0 4px ${color}` }}>
          {numValue.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 w-full bg-gray-900/60 rounded-sm overflow-hidden border border-gray-800/50 relative">
        {/* 背景网格纹理 */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(255,255,255,0.05)_50%,transparent_51%)] bg-[length:4px_100%]"></div>
        
        {/* 能量条 */}
        <div 
          className="h-full transition-all duration-500 relative overflow-hidden"
          style={{ width: `${numValue}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}, inset 0 0 8px rgba(255,255,255,0.2)` }}
        >
          {/* 内部光效 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
          
          {/* 扫描线效果 */}
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzj//v37zaDfFCnCgALYEwAAXlIQ9xDxLJEAAAAASUVORK5CYII=')] opacity-40"></div>
        </div>
        
        {/* 能量条边缘高光 */}
        <div 
          className="absolute top-0 right-0 h-full w-[1px] transition-all duration-500"
          style={{ 
            right: `${100 - numValue}%`,
            background: `linear-gradient(to right, transparent, ${color})`,
            boxShadow: `0 0 8px ${color}`
          }}
        ></div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 主应用组件：App
// -----------------------------------------------------------------------------
export default function CockpitPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const [currentTime, setCurrentTime] = useState('')
  const [engineLevel, setEngineLevel] = useState(85)
  const [shieldLevel, setShieldLevel] = useState(100)
  const [showMenu, setShowMenu] = useState(false)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  
  // 左侧仪表盘动态数值状态
  const [speed, setSpeed] = useState(2997)
  const [temperature, setTemperature] = useState(1247)
  const [pressure, setPressure] = useState(8.4)
  const [thrusters, setThrusters] = useState(92)
  const [powerCore, setPowerCore] = useState(98)
  const [shieldGen, setShieldGen] = useState(87)
  const [efficiency, setEfficiency] = useState(94.2)
  const [acceleration, setAcceleration] = useState(12.3)
  const [uptimeHours, setUptimeHours] = useState(24)
  const [uptimeMinutes, setUptimeMinutes] = useState(15)
  
  // 判断是否在首页
  const isHomePage = pathname === '/'
  
  // 用于存储按钮的原始位置和目标位置
  const centerButtonsRef = React.useRef<HTMLDivElement>(null)
  const [buttonStartPos, setButtonStartPos] = useState<{ x: number; y: number } | null>(null)
  const [buttonEndPos, setButtonEndPos] = useState<{ x: number; y: number } | null>(null)
  const [isAnimatingDown, setIsAnimatingDown] = useState(false)
  const [isAnimatingUp, setIsAnimatingUp] = useState(false)
  
  // 监听路由变化，控制动画阶段
  useEffect(() => {
    if (!isHomePage) {
      // 开始向下隐藏动画
      setIsAnimatingDown(true)
      setIsAnimatingUp(false)
      // 500ms后切换到向上移动阶段
      const timer = setTimeout(() => {
        setIsAnimatingDown(false)
        setIsAnimatingUp(true)
        // 再等待100ms确保定位切换完成，然后开始向上移动动画
        setTimeout(() => {
          setIsAnimatingUp(false)
        }, 100)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      // 返回首页时立即重置所有状态
      setIsAnimatingDown(false)
      setIsAnimatingUp(false)
      // 位置更新由另一个useEffect处理，这里不需要额外操作
    }
  }, [isHomePage, pathname])
  
  // 初始化按钮位置（使用估算值，确保始终有值）
  useEffect(() => {
    // 计算中间控制台的位置
    // 底部容器高度40vh，中间控制台占30%，所以中间控制台的中心位置是：
    // 从底部向上：40vh - (30% * 40vh) / 2 = 40vh - 6vh = 34vh from bottom
    // 从顶部向下：100vh - 34vh = 66vh from top
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight - (window.innerHeight * 0.4) + (window.innerHeight * 0.4 * 0.3 / 2)
    setButtonStartPos({ x: centerX, y: centerY })
    setButtonEndPos({ 
      x: window.innerWidth - 88, 
      y: window.innerHeight - 24 
    })
  }, [])

  // 获取AUTOPILOT组件的位置（用于按钮定位）
  useEffect(() => {
    const updateButtonPositions = () => {
      if (centerButtonsRef.current) {
        const rect = centerButtonsRef.current.getBoundingClientRect()
        // 确保rect是有效的
        if (rect.width > 0 && rect.height > 0) {
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          setButtonStartPos({ x: centerX, y: centerY })
          return true
        }
      }
      return false
    }
    
    // 立即更新一次
    updateButtonPositions()
    
    // 延迟更新确保DOM渲染完成（特别是返回首页时）
    const timers: NodeJS.Timeout[] = []
    for (let i = 1; i <= 5; i++) {
      timers.push(setTimeout(() => {
        updateButtonPositions()
      }, i * 100))
    }
    
    // 始终更新右下角位置（基于窗口大小）
    const updateEndPos = () => {
      setButtonEndPos({ 
        x: window.innerWidth - 88, 
        y: window.innerHeight - 24 
      })
    }
    updateEndPos()
    
    // 监听窗口大小变化和路由变化
    window.addEventListener('resize', () => {
      updateButtonPositions()
      updateEndPos()
    })
    
    return () => {
      window.removeEventListener('resize', () => {
        updateButtonPositions()
        updateEndPos()
      })
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [isHomePage, pathname])

  // 动态更新左侧仪表盘数值
  useEffect(() => {
    // 速度：2997 ± 50，变化较慢，每2秒更新
    const speedInterval = setInterval(() => {
      setSpeed(prev => {
        const change = (Math.random() - 0.5) * 2 // -1 到 1
        const newSpeed = prev + change
        return Math.max(2947, Math.min(3047, newSpeed)) // 限制在 2947-3047 之间
      })
    }, 2000)

    // 温度：1247 ± 30，变化中等，每1.5秒更新
    const tempInterval = setInterval(() => {
      setTemperature(prev => {
        const change = (Math.random() - 0.5) * 3
        const newTemp = prev + change
        return Math.max(1217, Math.min(1277, newTemp))
      })
    }, 1500)

    // 压力：8.4 ± 0.3，变化较小，每1.8秒更新
    const pressureInterval = setInterval(() => {
      setPressure(prev => {
        const change = (Math.random() - 0.5) * 0.1
        const newPressure = prev + change
        return Math.max(8.1, Math.min(8.7, newPressure))
      })
    }, 1800)

    // 能量相关：每2.5秒更新
    const energyInterval = setInterval(() => {
      setThrusters(prev => {
        const change = (Math.random() - 0.5) * 0.6
        return Math.max(89, Math.min(95, prev + change))
      })
      setPowerCore(prev => {
        const change = (Math.random() - 0.5) * 0.2
        return Math.max(97, Math.min(99, prev + change))
      })
      setShieldGen(prev => {
        const change = (Math.random() - 0.5) * 0.4
        return Math.max(85, Math.min(89, prev + change))
      })
      setEfficiency(prev => {
        const change = (Math.random() - 0.5) * 0.4
        return Math.max(92.2, Math.min(96.2, prev + change))
      })
      setAcceleration(prev => {
        const change = (Math.random() - 0.5) * 0.3
        return Math.max(10.8, Math.min(13.8, prev + change))
      })
    }, 2500)

    // 运行时间：每分钟递增
    const uptimeInterval = setInterval(() => {
      setUptimeMinutes(prev => {
        const newMinutes = prev + 1
        if (newMinutes >= 60) {
          setUptimeHours(h => h + 1)
          return 0
        }
        return newMinutes
      })
    }, 60000)

    return () => {
      clearInterval(speedInterval)
      clearInterval(tempInterval)
      clearInterval(pressureInterval)
      clearInterval(energyInterval)
      clearInterval(uptimeInterval)
    }
  }, [])

  // 处理WARP按钮点击 - 跳转到上传页面
  const handleWarp = () => {
    router.push('/upload')
  }

  // 处理MENU按钮点击 - 显示/隐藏列表菜单
  const handleMenu = () => {
    if (!showMenu) {
      // 打开菜单时加载训练条目
      fetchTrainingItems()
    }
    setShowMenu(!showMenu)
  }

  // 处理HOME按钮点击 - 返回首页
  const handleHome = () => {
    router.push('/')
  }

  // 获取训练条目列表
  const fetchTrainingItems = async () => {
    setLoadingItems(true)
    try {
      const response = await fetch('/api/training-items')
      if (response.ok) {
        const data = await response.json()
        setTrainingItems(data)
      }
    } catch (error) {
      console.error('Error fetching training items:', error)
    } finally {
      setLoadingItems(false)
    }
  }

  // 模拟数据波动
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }))
      setEngineLevel(prev => Math.min(100, Math.max(70, prev + (Math.random() - 0.5) * 5)))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-30 cockpit-panel">
      
      {/* 驾驶舱 Overlay */}
      {/* 全局扫描线效果 (Scanlines) */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] opacity-20"></div>

      {/* 顶部装饰栏 */}
      <div className="absolute top-0 left-0 w-full h-24 z-40 flex justify-between items-start pointer-events-none">
        {/* 左上角 */}
        <div className="bg-black/80 backdrop-blur-md p-4 clip-path-polygon-br border-b-2 border-l-2 border-cyan-600 w-1/4">
           <div className="flex items-center gap-2 text-cyan-400 mb-1">
             <Activity size={16} className="animate-pulse" />
             <span className="font-mono text-xs tracking-[0.2em]">SYSTEM STATUS: NORMAL</span>
           </div>
           <div className="h-1 w-full bg-cyan-900/50 mt-2 overflow-hidden flex gap-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className={`h-full flex-1 ${i < 8 ? 'bg-cyan-500' : 'bg-gray-800'}`}></div>
              ))}
           </div>
        </div>

        {/* 顶部中间 - 装饰性结构 */}
        <div className="relative h-16 w-1/3 bg-black/60 backdrop-blur border-b border-cyan-500/30 flex items-center justify-center clip-path-trapezoid-top">
          <div className="bg-cyan-900/30 px-6 py-1 rounded border border-cyan-500/50">
             <span className="font-mono text-xl text-cyan-100 font-bold tracking-widest glow-text">{currentTime}</span>
          </div>
          {/* 红色警示灯 */}
          <div className="absolute bottom-2 left-10 w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          <div className="absolute bottom-2 right-10 w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
        </div>

        {/* 右上角 */}
        <div className="bg-black/80 backdrop-blur-md p-4 clip-path-polygon-bl border-b-2 border-r-2 border-pink-600 w-1/4 flex flex-col items-end text-right">
           <div className="flex items-center gap-2 text-pink-400 mb-1">
             <span className="font-mono text-xs tracking-[0.2em]">DESTINATION LOCKED</span>
             <Target size={16} />
           </div>
           <div className="text-xs text-gray-400 font-mono">SEC: ALPHA-9</div>
           <div className="text-xs text-gray-400 font-mono">DIST: 402.3 LY</div>
        </div>
      </div>

      {/* 底部仪表盘控制台 - 核心交互区（不包括中间按钮） */}
      {/* 按钮组也会随这个容器一起向下隐藏 */}
      <div className={`absolute bottom-0 left-0 w-full h-[40vh] z-40 flex items-end justify-between px-4 pb-4 pointer-events-auto transition-all duration-500 ease-in-out ${
        isHomePage ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}>
        
        {/* 仪表盘背景遮罩 (使用 clip-path 创建不规则形状，让中间空出来) */}
        <div 
          className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-black via-gray-900/90 to-transparent pointer-events-none -z-10"
          style={{
            clipPath: 'polygon(0% 100%, 0% 0%, 20% 20%, 35% 25%, 65% 25%, 80% 20%, 100% 0%, 100% 100%)'
          }}
        ></div>

        {/* 左侧仪表板 - 超强优化版 */}
        <div className="w-[30%] h-[80%] bg-gradient-to-br from-black/50 via-gray-900/40 to-black/50 backdrop-blur-md border-2 border-cyan-800/60 p-6 relative rounded-tr-3xl overflow-hidden shadow-[0_0_30px_rgba(0,243,255,0.15),inset_0_0_20px_rgba(0,243,255,0.05)] group">
          {/* 粒子背景效果 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400/40 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  boxShadow: '0 0 4px rgba(0,243,255,0.6)'
                }}
              ></div>
            ))}
          </div>

          {/* 能量波动效果 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,243,255,0.1)_30%,transparent_60%)] animate-pulse" style={{ animationDuration: '3s' }}></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,transparent_0%,rgba(0,243,255,0.08)_25%,transparent_50%)] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
          </div>

          {/* 数字雨效果 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute text-[8px] font-mono text-cyan-400/30"
                style={{
                  left: `${10 + i * 12}%`,
                  top: '-20px',
                  animation: `digital-rain ${3 + Math.random() * 2}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              >
                {Math.floor(Math.random() * 2)}
              </div>
            ))}
          </div>

          {/* 全息投影扫描线 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,243,255,0.1)_50%,transparent_100%)] bg-[length:100%_4px] animate-scan-vertical opacity-30"></div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(0,243,255,0.08)_50%,transparent_100%)] bg-[length:4px_100%] animate-shimmer opacity-20"></div>
          </div>

          {/* 顶部装饰线条 - 增强版 */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
          
          {/* 左侧装饰条 - 增强版 */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500/60 via-transparent to-transparent">
            <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-cyan-500/80 to-transparent shadow-[0_0_8px_rgba(0,243,255,0.6)]"></div>
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-cyan-500/40 to-transparent"></div>
          </div>

          {/* 右侧装饰条 */}
          <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent"></div>
          
          {/* 标题区域 - 增强版 */}
          <div className="mb-3 pb-2 border-b border-cyan-800/40 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-cyan-400 font-mono text-sm tracking-wider flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(0,243,255,0.8)]"></div>
                PROPULSION SYSTEMS
              </h3>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-mono text-cyan-500/70">ONLINE</span>
              </div>
            </div>
            {/* 标题下方数据流 */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          </div>

          {/* 顶部传感器数据面板 - 增强版 */}
          <div className="mb-3 grid grid-cols-2 gap-2 relative z-10">
             <div className="bg-black/40 border border-cyan-500/20 rounded p-1.5 relative overflow-hidden">
                {/* 背景光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-yellow-500/5"></div>
                
                <div className="text-[7px] font-mono text-cyan-400/60 mb-0.5 relative z-10 flex items-center gap-1">
                   <div className="w-0.5 h-0.5 bg-yellow-400 rounded-full animate-pulse"></div>
                   TEMP
                </div>
                <div className="flex items-baseline gap-1 relative z-10">
                  <span className="text-[11px] font-mono text-cyan-400 font-bold" style={{ textShadow: '0 0 4px rgba(0,243,255,0.5)' }}>
                     {Math.round(temperature).toLocaleString()}
                  </span>
                  <span className="text-[8px] font-mono text-cyan-500/70">°K</span>
                </div>
                <div className="h-0.5 w-full bg-gray-800 rounded mt-1 overflow-hidden relative z-10">
                  <div className="h-full bg-gradient-to-r from-green-500 via-green-400 to-yellow-500 transition-all duration-500 relative" style={{ width: `${((temperature - 1217) / 60) * 100}%` }}>
                     {/* 进度条光效 */}
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                  </div>
                  {/* 背景网格 */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%)] bg-[length:3px_100%]"></div>
                </div>
             </div>
             <div className="bg-black/40 border border-cyan-500/20 rounded p-1.5 relative overflow-hidden">
                {/* 背景光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5"></div>
                
                <div className="text-[7px] font-mono text-cyan-400/60 mb-0.5 relative z-10 flex items-center gap-1">
                   <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full animate-pulse"></div>
                   PRESSURE
                </div>
                <div className="flex items-baseline gap-1 relative z-10">
                  <span className="text-[11px] font-mono text-cyan-400 font-bold" style={{ textShadow: '0 0 4px rgba(0,243,255,0.5)' }}>
                     {pressure.toFixed(1)}
                  </span>
                  <span className="text-[8px] font-mono text-cyan-500/70">ATM</span>
                </div>
                <div className="h-0.5 w-full bg-gray-800 rounded mt-1 overflow-hidden relative z-10">
                  <div className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 transition-all duration-500 relative" style={{ width: `${((pressure - 8.1) / 0.6) * 100}%` }}>
                     {/* 进度条光效 */}
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                  </div>
                  {/* 背景网格 */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%)] bg-[length:3px_100%]"></div>
                </div>
             </div>
          </div>
          
          {/* 速度仪表盘和能量条区域 */}
          <div className="flex flex-col gap-3 mb-4 relative z-10">
             <div className="flex items-center justify-center relative">
               <Speedometer speed={speed} />
               {/* 速度仪表盘周围的装饰 - 增强版 */}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* 多层旋转环 */}
                  <div className="w-40 h-40 border border-cyan-500/10 rounded-full animate-spin-slow"></div>
                  <div className="w-44 h-44 border border-cyan-500/5 rounded-full animate-spin-slow-reverse" style={{ animationDuration: '15s' }}></div>
                  {/* 能量脉冲环 */}
                  <div className="absolute w-36 h-36 border-2 border-cyan-500/30 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                  {/* 光点装饰 */}
                  {[...Array(8)].map((_, i) => {
                    const angle = (i * 45) * (Math.PI / 180)
                    const radius = 70
                    const x = Math.cos(angle) * radius
                    const y = Math.sin(angle) * radius
                    return (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
                        style={{
                          left: `calc(50% + ${x}px)`,
                          top: `calc(50% + ${y}px)`,
                          animationDelay: `${i * 0.2}s`,
                          boxShadow: '0 0 4px rgba(0,243,255,0.8)'
                        }}
                      ></div>
                    )
                  })}
               </div>
             </div>
             
             {/* 速度信息补充 */}
             <div className="flex justify-center gap-4 text-[9px] font-mono text-cyan-400/70">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                  <span>VEL: {Math.round(speed)} KM/S</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                  <span>ACC: +{acceleration.toFixed(1)}</span>
                </div>
             </div>

             <div className="flex flex-col gap-2.5">
               <EnergyBar label="HYPERDRIVE" color="#bc13fe" value={engineLevel.toFixed(1)} />
               <EnergyBar label="THRUSTERS" color="#00f3ff" value={thrusters.toFixed(1)} />
               <EnergyBar label="POWER CORE" color="#0aff0a" value={powerCore.toFixed(1)} />
               <EnergyBar label="SHIELD GEN" color="#00f3ff" value={shieldGen.toFixed(1)} />
             </div>
          </div>

          {/* 性能图表区域 - 增强版 */}
          <div className="mb-3 bg-black/40 border border-cyan-500/20 rounded p-2 relative overflow-hidden">
             {/* 背景光效 */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"></div>
             
             <div className="text-[8px] font-mono text-cyan-400/60 mb-1.5 relative z-10 flex items-center gap-2">
                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                PERFORMANCE METRICS
             </div>
             <div className="relative h-12 z-10">
                {/* 波形图 - 动态更新 */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                   {/* 背景填充 */}
                   <defs>
                      <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="rgba(0,243,255,0.3)" />
                         <stop offset="50%" stopColor="rgba(0,243,255,0.6)" />
                         <stop offset="100%" stopColor="rgba(0,243,255,0.3)" />
                      </linearGradient>
                      <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="rgba(188,19,254,0.2)" />
                         <stop offset="50%" stopColor="rgba(188,19,254,0.4)" />
                         <stop offset="100%" stopColor="rgba(188,19,254,0.2)" />
                      </linearGradient>
                   </defs>
                   {/* 波形1 - 主波形 */}
                   <polyline
                      points="0,30 10,25 20,28 30,22 40,26 50,20 60,24 70,18 80,22 90,16 100,20"
                      fill="url(#waveGradient1)"
                      fillOpacity="0.2"
                      stroke="rgba(0,243,255,0.6)"
                      strokeWidth="1.5"
                      className="animate-pulse"
                   />
                   {/* 波形2 - 辅助波形 */}
                   <polyline
                      points="0,35 10,30 20,33 30,27 40,31 50,25 60,29 70,23 80,27 90,21 100,25"
                      fill="url(#waveGradient2)"
                      fillOpacity="0.15"
                      stroke="rgba(188,19,254,0.4)"
                      strokeWidth="1"
                      style={{ animationDelay: '0.2s' }}
                   />
                   {/* 数据点 */}
                   {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x, i) => (
                      <circle
                         key={i}
                         cx={x}
                         cy={i % 2 === 0 ? 25 : 30}
                         r="1.5"
                         fill="rgba(0,243,255,0.8)"
                         className="animate-pulse"
                         style={{ animationDelay: `${i * 0.1}s` }}
                      />
                   ))}
                </svg>
                {/* 网格线 - 增强版 */}
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%),linear-gradient(90deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%)] bg-[length:10px_10px]"></div>
                {/* 扫描线 - 增强版 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-shimmer" style={{ width: '35%', boxShadow: '0 0 20px rgba(0,243,255,0.4)' }}></div>
                {/* 垂直扫描线 */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent" style={{ width: '2px', left: '50%', animation: 'shimmer 3s linear infinite' }}></div>
             </div>
             <div className="flex justify-between mt-1 text-[7px] font-mono text-cyan-400/60 relative z-10">
                <span className="flex items-center gap-1">
                  <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full"></div>
                  MIN
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full animate-pulse"></div>
                  AVG
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full"></div>
                  MAX
                </span>
             </div>
          </div>

          {/* 系统状态按钮组 - 增强版 */}
          <div className="grid grid-cols-3 gap-2 mb-3 relative z-10">
             {['NAV', 'COM', 'LIF'].map((sys, idx) => (
               <button 
                 key={sys} 
                 className="relative border border-cyan-700/50 bg-cyan-900/20 text-cyan-300 text-xs py-2 hover:bg-cyan-500/30 hover:text-white hover:border-cyan-400 transition-all font-mono group/btn overflow-hidden"
               >
                 {/* 按钮背景光效 */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                 {/* 按钮扫描线 */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover/btn:opacity-100 animate-shimmer transition-opacity" style={{ width: '50%' }}></div>
                 {/* 左侧状态指示器 - 增强版 */}
                 <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_4px_rgba(0,255,0,0.8)] animate-pulse">
                    <div className="absolute inset-0 bg-green-500 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                 </div>
                 {/* 右侧装饰点 */}
                 <div className="absolute right-1 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-cyan-400/50 rounded-full opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                 <span className="relative z-10 block text-[10px]">{sys}</span>
                 <span className="relative z-10 block text-[8px] text-cyan-500/70 group-hover/btn:text-cyan-300 transition-colors">ON</span>
                 {/* 按钮边框光效 */}
                 <div className="absolute inset-0 border border-cyan-500/0 group-hover/btn:border-cyan-500/50 transition-all rounded"></div>
               </button>
             ))}
          </div>

          {/* 实时数据流 - 增强版 */}
          <div className="mb-3 bg-black/40 border border-cyan-500/20 rounded p-1.5 relative overflow-hidden">
             {/* 背景光效 */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"></div>
             
             <div className="text-[7px] font-mono text-cyan-400/60 mb-1 relative z-10 flex items-center gap-2">
                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                DATA STREAM
             </div>
             <div className="relative h-6 bg-black/60 rounded border border-cyan-500/10 overflow-hidden z-10">
                {/* 数据流动画 - 增强版 */}
                <div className="absolute inset-0 flex items-center">
                   {[...Array(12)].map((_, i) => (
                      <div
                         key={i}
                         className="absolute h-3 w-1 bg-gradient-to-t from-cyan-500/80 via-cyan-400/70 to-cyan-300/60 rounded-sm"
                         style={{
                            left: `${i * 8}%`,
                            animation: `data-flow 2.5s linear infinite`,
                            animationDelay: `${i * 0.15}s`,
                            boxShadow: '0 0 4px rgba(0,243,255,0.8), 0 0 8px rgba(0,243,255,0.4)'
                         }}
                      >
                         {/* 数据包顶部光点 */}
                         <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-0.5 bg-cyan-300 rounded-full"></div>
                      </div>
                   ))}
                </div>
                {/* 扫描线 - 增强版 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent animate-shimmer" style={{ width: '40%', boxShadow: '0 0 15px rgba(0,243,255,0.5)' }}></div>
                {/* 数据包连接线 */}
                <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.3 }}>
                   {[...Array(11)].map((_, i) => (
                      <line
                         key={i}
                         x1={`${(i + 0.5) * 8}%`}
                         y1="50%"
                         x2={`${(i + 1.5) * 8}%`}
                         y2="50%"
                         stroke="rgba(0,243,255,0.2)"
                         strokeWidth="0.5"
                      />
                   ))}
                </svg>
             </div>
          </div>

          {/* 系统统计 - 增强版 */}
          <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
             <div className="bg-black/40 border border-cyan-500/20 rounded p-1.5 relative overflow-hidden">
                {/* 背景光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-cyan-500/5"></div>
                
                <div className="text-[7px] font-mono text-cyan-400/60 mb-0.5 relative z-10 flex items-center gap-1">
                   <div className="w-0.5 h-0.5 bg-green-400 rounded-full animate-pulse"></div>
                   EFFICIENCY
                </div>
                <div className="text-[12px] font-mono text-cyan-400 font-bold relative z-10" style={{ textShadow: '0 0 6px rgba(0,243,255,0.6)' }}>
                   {efficiency.toFixed(1)}%
                </div>
                <div className="h-1 w-full bg-gray-800 rounded mt-1 overflow-hidden relative z-10">
                   <div className="h-full bg-gradient-to-r from-green-500 via-green-400 to-cyan-500 transition-all duration-500 relative" style={{ width: `${efficiency}%` }}>
                      {/* 进度条光效 */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      {/* 进度条边缘高光 */}
                      <div className="absolute top-0 right-0 h-full w-[2px] bg-white/50 shadow-[0_0_4px_white]"></div>
                   </div>
                   {/* 进度条背景网格 */}
                   <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%)] bg-[length:4px_100%]"></div>
                </div>
             </div>
             <div className="bg-black/40 border border-cyan-500/20 rounded p-1.5 relative overflow-hidden">
                {/* 背景光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5"></div>
                
                <div className="text-[7px] font-mono text-cyan-400/60 mb-0.5 relative z-10 flex items-center gap-1">
                   <div className="w-0.5 h-0.5 bg-cyan-400 rounded-full animate-pulse"></div>
                   UPTIME
                </div>
                <div className="text-[12px] font-mono text-cyan-400 font-bold relative z-10 flex items-baseline gap-1" style={{ textShadow: '0 0 6px rgba(0,243,255,0.6)' }}>
                   <span>{String(uptimeHours).padStart(2, '0')}</span>
                   <span className="text-[8px] text-cyan-500/70">:</span>
                   <span>{String(uptimeMinutes).padStart(2, '0')}</span>
                </div>
                <div className="text-[7px] font-mono text-cyan-500/70 mt-0.5 relative z-10">HOURS</div>
                {/* 数字闪烁效果 */}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(0,243,255,0.1)_50%,transparent_51%)] bg-[length:2px_100%] animate-shimmer opacity-50"></div>
             </div>
          </div>
          
          {/* 底部状态栏 - 增强版 */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-cyan-900/30 to-transparent border-t border-cyan-800/30 flex items-center justify-between px-4 relative z-10">
            {/* 背景光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5"></div>
            
            <div className="flex items-center gap-2 relative z-10">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_6px_green] relative">
                 <div className="absolute inset-0 bg-green-400 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
              </div>
              <span className="text-[9px] text-cyan-500 font-mono" style={{ textShadow: '0 0 4px rgba(0,243,255,0.4)' }}>
                 ALL SYSTEMS OPERATIONAL
              </span>
            </div>
            <div className="flex items-center gap-2 relative z-10">
              <div className="text-[8px] font-mono text-cyan-400/70">STATUS:</div>
              <div className="text-[9px] font-mono text-green-400 font-bold flex items-center gap-1" style={{ textShadow: '0 0 6px rgba(0,255,0,0.6)' }}>
                 <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                 NOMINAL
              </div>
            </div>
            {/* 状态栏扫描线 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent animate-shimmer opacity-50" style={{ width: '40%' }}></div>
          </div>
          
          {/* 全息网格背景 - 增强版 */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(0,243,255,.08)_25%,rgba(0,243,255,.08)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.08)_75%,rgba(0,243,255,.08)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,243,255,.08)_25%,rgba(0,243,255,.08)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.08)_75%,rgba(0,243,255,.08)_76%,transparent_77%,transparent)] bg-[length:25px_25px] pointer-events-none opacity-25"></div>
          
          {/* 扫描线效果 - 多层 */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,243,255,0.05)_50%,transparent_100%)] bg-[length:100%_3px] animate-scan-vertical pointer-events-none opacity-50"></div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,243,255,0.03)_50%,transparent_100%)] bg-[length:100%_5px] animate-scan-vertical pointer-events-none opacity-30" style={{ animationDelay: '1s', animationDuration: '3s' }}></div>
          
          {/* 角落光效 */}
          <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-cyan-500/10 to-transparent pointer-events-none"></div>
          
          {/* 角落装饰 - 增强版 */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40">
             <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-cyan-500/20"></div>
          </div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40">
             <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-cyan-500/20"></div>
          </div>
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/30"></div>
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/30"></div>
        </div>

        {/* 中间 - 较低的控制台，尽量不遮挡视线 */}
        <div className={`flex-1 mx-4 h-[30%] bg-black/60 backdrop-blur rounded-t-xl border-t border-cyan-500/30 flex items-center justify-center relative transition-all duration-500 ease-in-out ${
          isHomePage ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}>
          {/* 中控台 - 用于定位按钮组的位置，AUTOPILOT已移到按钮组中 */}
          <div ref={centerButtonsRef} className="flex gap-8 items-center relative w-full h-full">
            {/* 这个div只是用于定位，内容为空 */}
          </div>
        </div>

        {/* 右侧仪表板 */}
        <div className="w-[30%] h-[80%] bg-black/40 backdrop-blur-md border border-pink-800/50 p-6 relative rounded-tl-3xl overflow-hidden shadow-[0_0_20px_rgba(188,19,254,0.1)]">
           <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-pink-500 to-transparent"></div>

           <div className="flex flex-col h-full">
              <div className="flex justify-between items-center border-b border-pink-900 pb-2 mb-4">
                <h3 className="text-pink-400 font-mono text-sm">DEFENSE SYSTEMS</h3>
                <Shield size={16} className="text-pink-500" />
              </div>

              {/* 雷达模拟 - 超强优化版 */}
              <div className="flex-1 relative mb-4 overflow-hidden">
                 {/* 装饰性边框 */}
                 <div className="absolute inset-0 border border-pink-500/20 rounded-lg"></div>
                 <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-pink-500/50"></div>
                 <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-pink-500/50"></div>
                 <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-pink-500/50"></div>
                 <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-pink-500/50"></div>

                 {/* 雷达主容器 */}
                 <div className="relative w-full h-full min-h-[240px] flex flex-col">
                    {/* 顶部区域 - 信号强度和频率分析 */}
                    <div className="relative h-16 mb-2 border-b border-pink-500/20">
                       {/* 信号强度波形图 */}
                       <div className="absolute top-2 left-2 right-2 h-8">
                          <div className="text-[7px] font-mono text-pink-400/60 mb-0.5">SIGNAL STRENGTH</div>
                          <div className="relative h-5 bg-black/40 rounded border border-pink-500/20 overflow-hidden">
                             {/* 波形动画 */}
                             <div className="absolute inset-0 flex items-end justify-between px-1">
                                {[...Array(20)].map((_, i) => {
                                   const height = Math.random() * 0.6 + 0.2
                                   const delay = i * 0.1
                                   return (
                                      <div
                                         key={i}
                                         className="w-0.5 bg-gradient-to-t from-pink-500 to-pink-400 rounded-t animate-pulse"
                                         style={{
                                            height: `${height * 100}%`,
                                            animationDelay: `${delay}s`,
                                            animationDuration: '1.5s',
                                            boxShadow: '0 0 4px rgba(188,19,254,0.6)'
                                         }}
                                      ></div>
                                   )
                                })}
                             </div>
                             {/* 扫描线 */}
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/30 to-transparent animate-shimmer" style={{ width: '30%' }}></div>
                          </div>
                       </div>
                       {/* 频率显示 */}
                       <div className="absolute bottom-1 right-2 text-right">
                          <div className="text-[7px] font-mono text-pink-400/60">FREQ</div>
                          <div className="text-[10px] font-mono text-pink-400 font-bold">2.4 GHz</div>
                       </div>
                    </div>

                    {/* 中间区域 - 雷达主体 */}
                    <div className="relative flex-1 flex items-center justify-center min-h-[160px]">
                       {/* 背景装饰网格 */}
                       <div className="absolute inset-0">
                          <svg className="absolute w-full h-full" viewBox="0 0 200 200" style={{ opacity: 0.15 }}>
                             {/* 密集网格 */}
                             {[...Array(5)].map((_, i) => (
                                <line key={`h${i}`} x1="0" y1={40 + i * 30} x2="200" y2={40 + i * 30} stroke="rgba(188,19,254,0.2)" strokeWidth="0.5" />
                             ))}
                             {[...Array(5)].map((_, i) => (
                                <line key={`v${i}`} x1={40 + i * 30} y1="0" x2={40 + i * 30} y2="200" stroke="rgba(188,19,254,0.2)" strokeWidth="0.5" />
                             ))}
                          </svg>
                       </div>

                       {/* 雷达圆圈主体 */}
                       <div className="relative w-40 h-40 flex items-center justify-center z-10">
                          {/* 外圈装饰环 - 多层 */}
                          <div className="absolute w-full h-full border-2 border-pink-500/40 rounded-full animate-pulse"></div>
                          <div className="absolute w-[90%] h-[90%] border border-pink-500/30 rounded-full"></div>
                          <div className="absolute w-[75%] h-[75%] border border-pink-500/20 rounded-full"></div>
                          <div className="absolute w-[60%] h-[60%] border border-pink-500/15 rounded-full"></div>
                          <div className="absolute w-[45%] h-[45%] border border-pink-500/10 rounded-full"></div>
                          <div className="absolute w-[30%] h-[30%] border border-pink-500/10 rounded-full"></div>

                          {/* 角度标记 - 使用SVG */}
                          <svg className="absolute w-full h-full" viewBox="0 0 160 160">
                             {[...Array(8)].map((_, i) => {
                                const angle = (i * 45 - 90) * (Math.PI / 180)
                                const centerX = 80
                                const centerY = 80
                                const radius1 = 70
                                const radius2 = 75
                                const x1 = centerX + Math.cos(angle) * radius1
                                const y1 = centerY + Math.sin(angle) * radius1
                                const x2 = centerX + Math.cos(angle) * radius2
                                const y2 = centerY + Math.sin(angle) * radius2
                                return (
                                   <line
                                      key={i}
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke="rgba(188,19,254,0.5)"
                                      strokeWidth="1"
                                   />
                                )
                             })}
                             {/* 方向标记 N, E, S, W */}
                             <text x="80" y="15" textAnchor="middle" fill="rgba(188,19,254,0.8)" fontSize="10" fontFamily="monospace" fontWeight="bold">N</text>
                             <text x="145" y="85" textAnchor="middle" fill="rgba(188,19,254,0.8)" fontSize="10" fontFamily="monospace" fontWeight="bold">E</text>
                             <text x="80" y="155" textAnchor="middle" fill="rgba(188,19,254,0.8)" fontSize="10" fontFamily="monospace" fontWeight="bold">S</text>
                             <text x="15" y="85" textAnchor="middle" fill="rgba(188,19,254,0.8)" fontSize="10" fontFamily="monospace" fontWeight="bold">W</text>
                          </svg>

                          {/* 中心点 */}
                          <div className="absolute w-2 h-2 bg-pink-400 rounded-full shadow-[0_0_15px_rgba(188,19,254,0.9)] z-10 animate-pulse"></div>
                          <div className="absolute w-1 h-1 bg-white rounded-full z-10"></div>

                          {/* 扫描线 - 增强版，带渐变尾迹 */}
                          <div className="absolute w-1/2 h-[2px] top-1/2 left-1/2 origin-left animate-spin-radar z-20">
                             <div className="w-full h-full bg-gradient-to-r from-pink-500 via-pink-400 to-transparent shadow-[0_0_15px_#bc13fe]"></div>
                          </div>
                          {/* 扫描尾迹效果 */}
                          <div className="absolute w-1/2 h-[1px] top-1/2 left-1/2 origin-left animate-spin-radar z-10" style={{ animationDelay: '-0.1s', opacity: 0.6 }}>
                             <div className="w-full h-full bg-gradient-to-r from-pink-400/50 via-transparent to-transparent"></div>
                          </div>
                          <div className="absolute w-1/2 h-[1px] top-1/2 left-1/2 origin-left animate-spin-radar z-10" style={{ animationDelay: '-0.2s', opacity: 0.3 }}>
                             <div className="w-full h-full bg-gradient-to-r from-pink-300/30 via-transparent to-transparent"></div>
                          </div>

                          {/* 目标点 - 多个，不同位置 */}
                          <div className="absolute top-6 right-10 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping z-30">
                             <div className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                          </div>
                          <div className="absolute bottom-8 left-12 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_8px_yellow] animate-pulse z-30"></div>
                          <div className="absolute top-1/2 right-6 w-1 h-1 bg-green-400 rounded-full shadow-[0_0_6px_green] z-30"></div>
                       </div>

                       {/* 左侧数据面板 */}
                       <div className="absolute left-1 top-1/2 transform -translate-y-1/2 space-y-3">
                          {/* 状态指示器 */}
                          <div className="bg-black/60 border border-pink-500/30 rounded p-1.5 space-y-1.5">
                             <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_6px_green] animate-pulse"></div>
                                <span className="text-[8px] font-mono text-pink-400/70">ACTIVE</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_6px_yellow] animate-pulse"></div>
                                <span className="text-[8px] font-mono text-pink-400/70">TRACK</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_6px_red] animate-pulse"></div>
                                <span className="text-[8px] font-mono text-pink-400/70">THREAT</span>
                             </div>
                          </div>
                          {/* 距离刻度 */}
                          <div className="bg-black/60 border border-pink-500/30 rounded p-1.5">
                             <div className="text-[7px] font-mono text-pink-400/60 mb-1">RANGE SCALE</div>
                             <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                   <div className="w-8 h-[1px] bg-pink-500/50"></div>
                                   <span className="text-[7px] font-mono text-pink-400/70">10KM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                   <div className="w-6 h-[1px] bg-pink-500/40"></div>
                                   <span className="text-[7px] font-mono text-pink-400/70">5KM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                   <div className="w-4 h-[1px] bg-pink-500/30"></div>
                                   <span className="text-[7px] font-mono text-pink-400/70">1KM</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* 右侧数据面板 */}
                       <div className="absolute right-1 top-1/2 transform -translate-y-1/2 space-y-3">
                          {/* 威胁等级 */}
                          <div className="bg-black/60 border border-pink-500/30 rounded p-1.5 text-right">
                             <div className="text-[7px] font-mono text-pink-400/60 mb-1">THREAT LVL</div>
                             <div className="text-xs font-mono text-pink-400 font-bold mb-1">LOW</div>
                             <div className="h-1 w-full bg-gray-800 rounded overflow-hidden">
                                <div className="h-full bg-green-500 w-1/3 shadow-[0_0_6px_green]"></div>
                             </div>
                          </div>
                          {/* 目标统计 */}
                          <div className="bg-black/60 border border-pink-500/30 rounded p-1.5 text-right">
                             <div className="text-[7px] font-mono text-pink-400/60 mb-1">TARGETS</div>
                             <div className="text-xs font-mono text-pink-400 font-bold">03</div>
                             <div className="text-[7px] font-mono text-pink-400/70 mt-1">
                                <div>● 1 HOSTILE</div>
                                <div>● 1 FRIENDLY</div>
                                <div>● 1 UNKNOWN</div>
                             </div>
                          </div>
                          {/* 扫描进度 */}
                          <div className="bg-black/60 border border-pink-500/30 rounded p-1.5">
                             <div className="text-[7px] font-mono text-pink-400/60 mb-1">SCAN PROG</div>
                             <div className="h-1 w-full bg-gray-800 rounded overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-pink-500 to-pink-400 w-3/4 shadow-[0_0_6px_#bc13fe] animate-pulse"></div>
                             </div>
                             <div className="text-[7px] font-mono text-pink-400/70 mt-0.5">75%</div>
                          </div>
                       </div>

                       {/* 顶部信息条 */}
                       <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-2 py-1 bg-black/40 border-b border-pink-500/20">
                          <div className="flex items-center gap-3">
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">RANGE</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">50KM</div>
                             </div>
                             <div className="w-[1px] h-4 bg-pink-500/30"></div>
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">ALT</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">12.5KM</div>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-1 h-1 bg-pink-400 rounded-full animate-pulse"></div>
                             <span className="text-[8px] font-mono text-pink-400/70">SCANNING</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">BEARING</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">045°</div>
                             </div>
                             <div className="w-[1px] h-4 bg-pink-500/30"></div>
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">SPD</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">2997</div>
                             </div>
                          </div>
                       </div>

                       {/* 底部信息条 */}
                       <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-2 py-1 bg-black/40 border-t border-pink-500/20">
                          <div className="flex items-center gap-3">
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">COORD X</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">843.2</div>
                             </div>
                             <div className="w-[1px] h-4 bg-pink-500/30"></div>
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">COORD Y</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">-12.8</div>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="text-[8px] font-mono text-pink-400/60">MODE:</div>
                             <div className="text-[10px] font-mono text-pink-400 font-bold">AUTO</div>
                          </div>
                          <div className="flex items-center gap-3">
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">POWER</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">98%</div>
                             </div>
                             <div className="w-[1px] h-4 bg-pink-500/30"></div>
                             <div>
                                <div className="text-[8px] font-mono text-pink-400/60">QUALITY</div>
                                <div className="text-[10px] font-mono text-pink-400 font-bold">EXC</div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* 底部区域 - 数据流和统计 */}
                    <div className="relative h-12 mt-2 border-t border-pink-500/20">
                       {/* 数据流可视化 */}
                       <div className="absolute top-1 left-2 right-2 h-8">
                          <div className="text-[7px] font-mono text-pink-400/60 mb-0.5">DATA STREAM</div>
                          <div className="relative h-4 bg-black/40 rounded border border-pink-500/20 overflow-hidden">
                             {/* 数据包流动效果 */}
                             <div className="absolute inset-0 flex items-center overflow-hidden">
                                {[...Array(8)].map((_, i) => (
                                   <div
                                      key={i}
                                      className="absolute h-2 w-3 bg-gradient-to-r from-pink-500/80 to-pink-400/60 rounded-sm"
                                      style={{
                                         left: `${i * 12.5}%`,
                                         animation: `data-flow 3s linear infinite`,
                                         animationDelay: `${i * 0.3}s`,
                                         boxShadow: '0 0 4px rgba(188,19,254,0.6)'
                                      }}
                                   ></div>
                                ))}
                             </div>
                             {/* 扫描线 */}
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" style={{ width: '40%' }}></div>
                          </div>
                       </div>
                       {/* 统计信息 */}
                       <div className="absolute bottom-1 right-2 flex items-center gap-3">
                          <div className="text-right">
                             <div className="text-[7px] font-mono text-pink-400/60">DETECTIONS</div>
                             <div className="text-[10px] font-mono text-pink-400 font-bold">127</div>
                          </div>
                          <div className="w-[1px] h-6 bg-pink-500/30"></div>
                          <div className="text-right">
                             <div className="text-[7px] font-mono text-pink-400/60">UPTIME</div>
                             <div className="text-[10px] font-mono text-pink-400 font-bold">24:15:33</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-xs font-mono text-pink-300">
                    <span>SHIELD INTEGRITY</span>
                    <span>{shieldLevel}%</span>
                 </div>
                 <div className="h-1 w-full bg-gray-800">
                    <div className="h-full bg-pink-500 w-full shadow-[0_0_8px_#bc13fe]"></div>
                 </div>
                 <div className="flex gap-2 mt-2">
                   <div className="h-2 w-2 rounded-full bg-pink-500 animate-bounce"></div>
                   <span className="text-[10px] text-pink-400 font-mono">WARNING: ASTEROID FIELD</span>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* 独立按钮组 - 首页时在中间控制台位置显示（AUTOPILOT两侧），非首页时移动到右下角 */}
      {/* z-index设置为50，高于仪表盘的z-40，确保按钮可以点击 */}
      {/* 确保按钮始终渲染，即使位置还在计算中 */}
      {(buttonStartPos && buttonEndPos) ? (
        <div 
          key={`buttons-${isHomePage}-${isAnimatingDown}-${isAnimatingUp}`}
          className={`fixed z-50 flex items-center pointer-events-auto ${
            isHomePage ? 'gap-8' : 'gap-2'
          }`}
          style={{
            // 根据动画阶段切换定位方式
            // 首页或向下隐藏阶段：使用left/top定位在中间
            // 向上移动阶段：使用bottom/right定位在右下角（最终位置）
            left: (isHomePage || isAnimatingDown) ? `${buttonStartPos.x}px` : 'auto',
            top: (isHomePage || isAnimatingDown) ? `${buttonStartPos.y}px` : 'auto',
            bottom: (isHomePage || isAnimatingDown) ? 'auto' : '24px',
            right: (isHomePage || isAnimatingDown) ? 'auto' : '24px',
            // 使用transform来实现位置移动、缩放和垂直移动
            // 首页时：居中显示，按钮在AUTOPILOT两侧
            // 向下隐藏阶段：保持居中，但向下移动 translateY(100vh)
            // 向上移动初始阶段：已经定位到右下角，从屏幕外（translateY(100vh)）开始
            // 向上移动完成阶段：移动到最终位置（translateY(0)），同时缩小
            transform: isHomePage 
              ? 'translate(-50%, -50%) scale(1)' 
              : isAnimatingDown
              ? 'translate(-50%, -50%) translateY(100vh) scale(1)'
              : isAnimatingUp
              ? 'translate(0, 100vh) scale(0.5)'
              : 'translate(0, 0) scale(0.5)',
            // 首页时：正常显示；非首页时：先向下隐藏，然后从屏幕外向上移动
            opacity: isHomePage ? 1 : 1,
            // 确保按钮始终可见
            visibility: 'visible',
            // 动画时序：
            // 首页→非首页：
            //   1. 先向下隐藏（0-500ms，与其他组件同步）：从中间位置向下移动 translateY(100vh)
            //   2. 等待500ms后，切换定位方式到右下角（100ms内完成）
            //   3. 从屏幕外直上直下移动到最终位置（600-1300ms）：translateY(100vh) -> translateY(0) + 缩小
            // 非首页→首页：向上移动回中间位置并放大
            transition: isHomePage 
              ? 'opacity 0.3s ease-out 0.7s, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), left 0.7s cubic-bezier(0.4, 0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0, 0.2, 1), bottom 0s linear 0.7s, right 0s linear 0.7s, gap 0.3s ease-out 0.7s'
              : isAnimatingDown
              ? 'transform 0.5s ease-in-out, left 0s, top 0s, bottom 0s, right 0s, gap 0s'
              : isAnimatingUp
              ? 'transform 0s, left 0s, top 0s, bottom 0s, right 0s, gap 0s'
              : 'opacity 0s linear 0s, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), left 0s linear 0s, top 0s linear 0s, bottom 0s linear 0s, right 0s linear 0s, gap 0.3s ease-out 0s',
          }}
        >
          {/* WARP 按钮 - 在AUTOPILOT左侧 */}
          <div className="text-center group cursor-pointer relative" onClick={handleWarp}>
            {/* 按钮容器 */}
            <div className="relative w-16 h-16 rounded-full border-2 border-red-500/50 flex items-center justify-center bg-red-900/10 group-hover:bg-red-500/20 group-hover:scale-110 group-active:scale-95 transition-all duration-300 shadow-[0_0_15px_rgba(255,0,0,0.3)] group-hover:shadow-[0_0_25px_rgba(255,0,0,0.6),0_0_50px_rgba(255,0,0,0.3)] group-active:shadow-[0_0_35px_rgba(255,0,0,0.8),inset_0_0_20px_rgba(255,0,0,0.2)] overflow-hidden">
              {/* 背景网格 */}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_48%,rgba(255,0,0,.1)_49%,rgba(255,0,0,.1)_51%,transparent_52%),linear-gradient(90deg,transparent_48%,rgba(255,0,0,.1)_49%,rgba(255,0,0,.1)_51%,transparent_52%)] bg-[length:8px_8px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* 扫描线效果 */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,0,0,0.3)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 animate-scan-vertical transition-opacity duration-300"></div>
              
              {/* 旋转光环 - 正向 */}
              <div className="absolute inset-0 rounded-full border border-red-500/30 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow transition-opacity duration-300"></div>
              {/* 旋转光环 - 反向 */}
              <div className="absolute inset-[-2px] rounded-full border border-red-500/20 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow-reverse transition-opacity duration-300"></div>
              
              {/* 中心光点 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-red-400 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)] transition-opacity duration-300"></div>
              </div>
              
              {/* 点击波纹效果 */}
              <div className="absolute inset-0 rounded-full bg-red-500/20 scale-0 group-active:scale-150 opacity-0 group-active:opacity-100 transition-all duration-500 pointer-events-none"></div>
              
              {/* 图标 */}
              <Rocket className="text-red-400 relative z-10 group-hover:text-red-300 transition-colors duration-300 group-active:scale-90 group-hover:drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
            </div>
            <div className="text-[10px] text-red-400 mt-2 font-mono group-hover:text-red-300 transition-colors duration-300 group-active:text-red-500 group-hover:drop-shadow-[0_0_4px_rgba(255,0,0,0.6)]">WARP</div>
          </div>

          {/* AUTOPILOT组件 - 唯一的AUTOPILOT显示，在首页时显示，非首页时完全隐藏 */}
          {isHomePage && (
            <div className="flex flex-col items-center transition-opacity duration-500">
              <div className="flex gap-1 mb-1">
                <div className="w-8 h-1 bg-green-500 animate-pulse"></div>
                <div className="w-8 h-1 bg-green-500 animate-pulse delay-75"></div>
                <div className="w-8 h-1 bg-green-500 animate-pulse delay-150"></div>
              </div>
              <span className="text-xs text-green-400 font-mono tracking-widest">AUTOPILOT</span>
            </div>
          )}

          {/* HOME 按钮 - 只在非首页时显示，位于WARP和MENU中间 */}
          {!isHomePage && (
            <div className="text-center group cursor-pointer relative" onClick={handleHome}>
              <div className="w-16 h-16 rounded-full border-2 border-purple-500/50 flex items-center justify-center bg-purple-900/10 group-hover:bg-purple-500/20 group-hover:scale-110 group-active:scale-95 transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] group-hover:shadow-[0_0_25px_rgba(168,85,247,0.6),0_0_50px_rgba(168,85,247,0.3)] group-active:shadow-[0_0_35px_rgba(168,85,247,0.8),inset_0_0_20px_rgba(168,85,247,0.2)] relative overflow-hidden">
                {/* 背景网格 */}
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_48%,rgba(168,85,247,.1)_49%,rgba(168,85,247,.1)_51%,transparent_52%),linear-gradient(90deg,transparent_48%,rgba(168,85,247,.1)_49%,rgba(168,85,247,.1)_51%,transparent_52%)] bg-[length:8px_8px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* 扫描线效果 */}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(168,85,247,0.3)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 animate-scan-vertical transition-opacity duration-300"></div>
                
                {/* 旋转光环 */}
                <div className="absolute inset-0 rounded-full border border-purple-500/30 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow transition-opacity duration-300"></div>
                <div className="absolute inset-[-2px] rounded-full border border-purple-500/20 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow-reverse transition-opacity duration-300"></div>
                
                {/* 中心光点 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-opacity duration-300"></div>
                </div>
                
                {/* 点击波纹效果 */}
                <div className="absolute inset-0 rounded-full bg-purple-500/20 scale-0 group-active:scale-150 opacity-0 group-active:opacity-100 transition-all duration-500 pointer-events-none"></div>
                
                {/* 图标 */}
                <Home className="text-purple-400 relative z-10 group-hover:text-purple-300 transition-colors duration-300 group-active:scale-90 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" size={24} />
              </div>
              <div className="text-[10px] text-purple-400 mt-2 font-mono group-hover:text-purple-300 transition-colors duration-300 group-active:text-purple-500 group-hover:drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]">HOME</div>
            </div>
          )}

          {/* MENU 按钮 - 在AUTOPILOT右侧 */}
          <div className="text-center group cursor-pointer relative" onClick={handleMenu}>
            <div className="w-16 h-16 rounded-full border-2 border-cyan-500/50 flex items-center justify-center bg-cyan-900/10 group-hover:bg-cyan-500/20 group-hover:scale-110 group-active:scale-95 transition-all duration-300 shadow-[0_0_15px_rgba(0,243,255,0.3)] group-hover:shadow-[0_0_25px_rgba(0,243,255,0.6),0_0_50px_rgba(0,243,255,0.3)] group-active:shadow-[0_0_35px_rgba(0,243,255,0.8),inset_0_0_20px_rgba(0,243,255,0.2)] relative overflow-hidden">
              {/* 背景网格 */}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_48%,rgba(0,243,255,.1)_49%,rgba(0,243,255,.1)_51%,transparent_52%),linear-gradient(90deg,transparent_48%,rgba(0,243,255,.1)_49%,rgba(0,243,255,.1)_51%,transparent_52%)] bg-[length:8px_8px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* 扫描线效果 */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,243,255,0.3)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 animate-scan-vertical transition-opacity duration-300"></div>
              
              {/* 旋转光环 */}
              <div className="absolute inset-0 rounded-full border border-cyan-500/30 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow transition-opacity duration-300"></div>
              <div className="absolute inset-[-2px] rounded-full border border-cyan-500/20 opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow-reverse transition-opacity duration-300"></div>
              
              {/* 中心光点 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-pulse shadow-[0_0_10px_rgba(0,243,255,0.8)] transition-opacity duration-300"></div>
              </div>
              
              {/* 点击波纹效果 */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 scale-0 group-active:scale-150 opacity-0 group-active:opacity-100 transition-all duration-500"></div>
              
              {/* 图标 */}
              <Menu className="text-cyan-400 relative z-10 group-hover:text-cyan-300 transition-colors duration-300 group-active:scale-90 group-hover:drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" size={24} />
            </div>
            <div className="text-[10px] text-cyan-400 mt-2 font-mono group-hover:text-cyan-300 transition-colors duration-300 group-active:text-cyan-500 group-hover:drop-shadow-[0_0_4px_rgba(0,243,255,0.6)]">MENU</div>
          </div>
        </div>
      ) : null}

      {/* 训练条目列表菜单 */}
      {showMenu && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMenu(false)}
          ></div>
          
          {/* 菜单面板 */}
          <div className="relative w-[90%] max-w-2xl max-h-[80vh] bg-black/95 backdrop-blur-md border-2 border-cyan-500/50 rounded-lg shadow-[0_0_30px_rgba(0,243,255,0.3)] overflow-hidden">
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-cyan-500/30 bg-gradient-to-r from-cyan-900/30 to-transparent">
              <h2 className="text-cyan-400 font-mono text-lg tracking-wider">TRAINING ITEMS LIST</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* 列表内容 */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
              {loadingItems ? (
                <div className="text-center py-8 text-cyan-400 font-mono">
                  <div className="animate-pulse">LOADING...</div>
                </div>
              ) : trainingItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-mono">
                  <p className="mb-2">[ 系统提示 ]</p>
                  <p className="text-sm">还没有训练条目</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trainingItems.map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/training/${item.id}`}
                      onClick={() => setShowMenu(false)}
                      className="block p-4 bg-gray-900/50 border border-cyan-500/20 rounded hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-cyan-500 font-mono text-xs">#{index + 1}</span>
                            <h3 className="text-gray-200 font-mono group-hover:text-cyan-300 transition-colors">
                              {item.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
                            <span>[ 句子: {item.sentences.length} ]</span>
                            <span>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                        <div className="text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          →
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="p-4 border-t border-cyan-500/30 bg-gradient-to-r from-transparent to-cyan-900/30 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMenu(false)
                  router.push('/')
                }}
                className="px-4 py-2 bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 font-mono text-sm hover:bg-cyan-500/20 transition-colors"
              >
                VIEW ALL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS 注入：用于自定义动画和Clip-paths */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes spin-radar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scan-vertical {
          0% { background-position: 0% 0%; }
          100% { background-position: 0% 100%; }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 8s linear infinite;
        }
        .animate-spin-radar {
          animation: spin-radar 3s linear infinite;
        }
        .animate-scan-vertical {
          animation: scan-vertical 2s linear infinite;
        }
        .clip-path-polygon-br {
          clip-path: polygon(0 0, 100% 0, 100% 70%, 90% 100%, 0 100%);
        }
        .clip-path-polygon-bl {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 10% 100%, 0 70%);
        }
        .clip-path-trapezoid-top {
          clip-path: polygon(0 0, 100% 0, 85% 100%, 15% 100%);
        }
        .glow-text {
          text-shadow: 0 0 10px rgba(0, 243, 255, 0.7);
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes data-flow {
          0% { transform: translateX(-30px); opacity: 0.3; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(calc(100% + 30px)); opacity: 0.3; }
        }
        @keyframes digital-rain {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
