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

// 速度仪表盘 - 优化版
const Speedometer = () => (
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
        2997
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

        {/* 左侧仪表板 - 优化版 */}
        <div className="w-[30%] h-[80%] bg-gradient-to-br from-black/50 via-gray-900/40 to-black/50 backdrop-blur-md border-2 border-cyan-800/60 p-6 relative rounded-tr-3xl overflow-hidden shadow-[0_0_30px_rgba(0,243,255,0.15),inset_0_0_20px_rgba(0,243,255,0.05)] group">
          {/* 顶部装饰线条 - 增强版 */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
          
          {/* 左侧装饰条 */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500/60 via-transparent to-transparent"></div>
          
          {/* 标题区域 */}
          <div className="mb-4 pb-3 border-b border-cyan-800/40">
            <h3 className="text-cyan-400 font-mono text-sm tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(0,243,255,0.8)]"></div>
              PROPULSION SYSTEMS
            </h3>
          </div>
          
          {/* 速度仪表盘和能量条区域 */}
          <div className="flex flex-col gap-4 mb-6">
             <div className="flex items-center justify-center">
               <Speedometer />
             </div>
             <div className="flex flex-col gap-3">
               <EnergyBar label="HYPERDRIVE" color="#bc13fe" value={engineLevel.toFixed(1)} />
               <EnergyBar label="THRUSTERS" color="#00f3ff" value={92} />
               <EnergyBar label="POWER CORE" color="#0aff0a" value={98} />
             </div>
          </div>

          {/* 系统状态按钮组 - 优化版 */}
          <div className="grid grid-cols-3 gap-2 mt-4">
             {['NAV', 'COM', 'LIF'].map((sys, idx) => (
               <button 
                 key={sys} 
                 className="relative border border-cyan-700/50 bg-cyan-900/20 text-cyan-300 text-xs py-2.5 hover:bg-cyan-500/30 hover:text-white hover:border-cyan-400 transition-all font-mono group/btn overflow-hidden"
               >
                 {/* 按钮背景光效 */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                 {/* 左侧状态指示器 */}
                 <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_4px_rgba(0,255,0,0.8)]"></div>
                 <span className="relative z-10">{sys}_ON</span>
               </button>
             ))}
          </div>
          
          {/* 底部状态栏 */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-cyan-900/20 to-transparent border-t border-cyan-800/30 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-cyan-500 font-mono">ALL SYSTEMS OPERATIONAL</span>
            </div>
          </div>
          
          {/* 全息网格背景 - 增强版 */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(0,243,255,.08)_25%,rgba(0,243,255,.08)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.08)_75%,rgba(0,243,255,.08)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,243,255,.08)_25%,rgba(0,243,255,.08)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.08)_75%,rgba(0,243,255,.08)_76%,transparent_77%,transparent)] bg-[length:25px_25px] pointer-events-none opacity-25"></div>
          
          {/* 角落装饰 */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40"></div>
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

              {/* 雷达模拟 */}
              <div className="flex-1 relative flex items-center justify-center mb-4">
                 <div className="w-32 h-32 border border-pink-500/30 rounded-full relative flex items-center justify-center bg-pink-900/10">
                    <div className="absolute inset-0 rounded-full border border-pink-500/10 scale-75"></div>
                    <div className="absolute inset-0 rounded-full border border-pink-500/10 scale-50"></div>
                    <div className="w-1 h-1 bg-white rounded-full absolute center shadow-[0_0_10px_white]"></div>
                    {/* 扫描线 */}
                    <div className="absolute w-1/2 h-[1px] bg-pink-500 top-1/2 left-1/2 origin-left animate-spin-radar shadow-[0_0_10px_#bc13fe]"></div>
                    {/* 敌人点 */}
                    <div className="absolute top-8 right-8 w-1 h-1 bg-red-500 animate-ping"></div>
                 </div>
                 {/* 坐标文字 */}
                 <div className="absolute top-0 left-0 text-[10px] font-mono text-pink-700">X: 843</div>
                 <div className="absolute bottom-0 right-0 text-[10px] font-mono text-pink-700">Y: -12</div>
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
      `}</style>
    </div>
  )
}
