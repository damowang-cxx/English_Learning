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
  const [glitchOffset, setGlitchOffset] = useState(0)

  // 扫描线动画
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(() => {
      setScanLineY(prev => (prev + 2) % 100)
    }, 50)
    
    return () => clearInterval(interval)
  }, [isOpen])

  // 边框抖动/故障效果
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(() => {
      setGlitchOffset(Math.random() * 2 - 1)
    }, 100)
    
    return () => clearInterval(interval)
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

  // 计算HUD位置（从按钮位置展开）
  const hudWidth = 600
  const hudHeight = 500
  const hudX = buttonPosition.x + buttonPosition.width / 2 - hudWidth / 2
  const hudY = buttonPosition.y - hudHeight - 20

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200]"
            onClick={onClose}
            style={{ background: 'rgba(0, 0, 0, 0.3)' }}
          />

          {/* HUD屏幕 */}
          <motion.div
            initial={{ 
              opacity: 0,
              scale: 0.3,
              x: buttonPosition.x + buttonPosition.width / 2,
              y: buttonPosition.y + buttonPosition.height / 2
            }}
            animate={{ 
              opacity: 1,
              scale: 1,
              x: hudX,
              y: hudY
            }}
            exit={{ 
              opacity: 0,
              scale: 0.3,
              x: buttonPosition.x + buttonPosition.width / 2,
              y: buttonPosition.y + buttonPosition.height / 2
            }}
            transition={{ 
              type: 'spring',
              stiffness: 300,
              damping: 30,
              duration: 0.4
            }}
            className="fixed z-[201]"
            style={{
              width: `${hudWidth}px`,
              height: `${hudHeight}px`,
              left: `${hudX}px`,
              top: `${hudY}px`,
            }}
          >
            {/* HUD主体 */}
            <div
              className="relative w-full h-full"
              style={{
                background: 'rgba(10, 10, 26, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '2px solid #00ffff',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.5), inset 0 0 20px rgba(0, 255, 255, 0.1)',
                transform: `translateX(${glitchOffset}px)`,
                transition: 'transform 0.1s linear',
              }}
            >
              {/* 扫描线效果 */}
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: `${scanLineY}%`,
                  height: '2px',
                  background: 'linear-gradient(to right, transparent, #00ffff, transparent)',
                  opacity: 0.6,
                  boxShadow: '0 0 4px #00ffff',
                }}
              />
              
              {/* 像素网格背景 */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  backgroundImage: `
                    linear-gradient(#00ffff 1px, transparent 1px),
                    linear-gradient(90deg, #00ffff 1px, transparent 1px)
                  `,
                  backgroundSize: '10px 10px',
                }}
              />

              {/* 四角发光节点 */}
              {/* 左上角 */}
              <div
                className="absolute -top-1 -left-1 w-3 h-3"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 8px #00ffff, 0 0 16px #00ffff',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
              />
              {/* 右上角 */}
              <div
                className="absolute -top-1 -right-1 w-3 h-3"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 8px #00ffff, 0 0 16px #00ffff',
                  clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
                }}
              />
              {/* 左下角 */}
              <div
                className="absolute -bottom-1 -left-1 w-3 h-3"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 8px #00ffff, 0 0 16px #00ffff',
                  clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                }}
              />
              {/* 右下角 */}
              <div
                className="absolute -bottom-1 -right-1 w-3 h-3"
                style={{
                  background: '#00ffff',
                  boxShadow: '0 0 8px #00ffff, 0 0 16px #00ffff',
                  clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                }}
              />

              {/* 边框抖动效果 */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  border: '1px solid #00ffff',
                  opacity: 0.5,
                }}
                animate={{
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              
              {/* 边框发光扫描效果（顶部到底部） */}
              <motion.div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  height: '2px',
                  background: 'linear-gradient(to right, transparent, #00ffff, transparent)',
                  opacity: 0.8,
                  boxShadow: '0 0 8px #00ffff',
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
                  borderColor: '#00ffff',
                  borderWidth: '0 0 1px 0',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: '#00ffff' }}>
                      {'>'}
                    </span>
                    <h2 className="text-sm font-mono font-bold" style={{ color: '#00ffff' }}>
                      [ TRAINING ITEMS LIST ]
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-xs font-mono px-2 py-1 hover:bg-opacity-20 transition-colors"
                    style={{ color: '#00ffff' }}
                  >
                    [X] CLOSE
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-4 h-full overflow-y-auto" style={{ height: 'calc(100% - 50px)' }}>
                {trainingItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs font-mono" style={{ color: '#00ffff', opacity: 0.6 }}>
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
                            ? '1px solid #00ffff' 
                            : '1px solid transparent',
                          boxShadow: selectedIndex === index 
                            ? '0 0 10px rgba(0, 255, 255, 0.5), inset 0 0 5px rgba(0, 255, 255, 0.3)' 
                            : 'none',
                          fontFamily: 'monospace',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {/* 选中时的像素光标效果 */}
                        {selectedIndex === index && (
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{
                              background: '#00ffff',
                              boxShadow: '0 0 8px #00ffff',
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
                              textShadow: selectedIndex === index ? 'none' : '0 0 4px #00ffff',
                            }}
                          >
                            {'>'}
                          </span>
                          <span 
                            className="flex-1 truncate"
                            style={{
                              textShadow: selectedIndex === index ? 'none' : '0 0 2px #00ffff',
                            }}
                          >
                            {item.title}
                          </span>
                          <span 
                            className="text-xs opacity-60"
                            style={{ 
                              color: selectedIndex === index ? '#000000' : '#00ffff',
                              textShadow: selectedIndex === index ? 'none' : '0 0 2px #00ffff',
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
                  borderColor: '#00ffff',
                  borderWidth: '1px 0 0 0',
                  color: '#00ffff',
                  background: 'rgba(0, 255, 255, 0.05)',
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
