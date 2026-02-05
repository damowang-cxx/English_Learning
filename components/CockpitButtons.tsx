'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import HudScreen from './HudScreen'

interface TrainingItem {
  id: string
  title: string
  createdAt: string | Date
  sentences: { id: string }[]
}

export default function CockpitButtons() {
  const router = useRouter()
  const [isHudOpen, setIsHudOpen] = useState(false)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([])

  // 获取训练条目数据
  React.useEffect(() => {
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

  return (
    <>
      <div className="flex gap-4 items-center">
        {/* LIST 按钮 */}
        <button
          onClick={() => setIsHudOpen(true)}
          className="relative px-6 py-3 bg-slate-800/80 border-2 border-cyan-500/50 text-cyan-400 font-mono text-sm font-bold tracking-wider uppercase transition-all hover:border-cyan-400 hover:bg-slate-700/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95"
          style={{
            transform: 'skewX(-5deg)',
            clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0% 100%)'
          }}
        >
          <span style={{ transform: 'skewX(5deg)', display: 'inline-block' }}>
            LIST
          </span>
          <div className="absolute inset-0 border border-cyan-400/30 pointer-events-none" 
               style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0% 100%)' }}></div>
        </button>

        {/* UPLOAD 按钮 */}
        <button
          onClick={() => router.push('/upload')}
          className="relative px-6 py-3 bg-slate-800/80 border-2 border-cyan-500/50 text-cyan-400 font-mono text-sm font-bold tracking-wider uppercase transition-all hover:border-cyan-400 hover:bg-slate-700/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95"
          style={{
            transform: 'skewX(-5deg)',
            clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0% 100%)'
          }}
        >
          <span style={{ transform: 'skewX(5deg)', display: 'inline-block' }}>
            UPLOAD
          </span>
          <div className="absolute inset-0 border border-cyan-400/30 pointer-events-none" 
               style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0% 100%)' }}></div>
        </button>
      </div>

      {/* HUD 屏幕 */}
      <HudScreen
        isOpen={isHudOpen}
        onClose={() => setIsHudOpen(false)}
        trainingItems={trainingItems}
        buttonPosition={{ x: 0, y: 0, width: 0, height: 0 }} // HUD 屏幕不再需要按钮位置，因为按钮在底部仪表盘
      />
    </>
  )
}
