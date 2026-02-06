'use client'

import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()

  const handleUpload = () => {
    router.push('/upload')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="relative w-full max-w-6xl mx-auto px-8 pb-6 pointer-events-auto">
        {/* 仪表盘背景 */}
        <div 
          className="relative bg-slate-900/95 border-t-2 border-cyan-500/50 shadow-[0_-25px_80px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          style={{
            clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0% 100%)',
            minHeight: '120px'
          }}
        >
          {/* 装饰线条 */}
          <div className="absolute top-3 left-[9%] right-[9%] h-[1px] bg-cyan-500/50 shadow-[0_0_5px_cyan]"></div>
          <div className="absolute top-0 left-[8%] w-6 h-6 border-l-2 border-t-2 border-cyan-400/60"></div>
          <div className="absolute top-0 right-[8%] w-6 h-6 border-r-2 border-t-2 border-cyan-400/60"></div>
          
          {/* 底部装饰线 */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent"></div>

          {/* 内容区域 */}
          <div className="pt-8 pb-6 px-12 flex flex-col items-center justify-center gap-4">
            {/* 系统状态 */}
            <div className="text-cyan-400/80 text-xs font-mono tracking-wider">
              SYSTEM STATUS: ALL SYSTEMS OPERATIONAL | TIME: {new Date().toLocaleTimeString()}
            </div>
            
            {/* 按钮组 */}
            <div className="flex gap-4 items-center">
              {/* 上传按钮 */}
              <button
                onClick={handleUpload}
                className="relative px-6 py-3 bg-slate-800/90 border-2 border-cyan-500/50 rounded-lg 
                         text-cyan-400 font-mono text-sm font-bold
                         hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-cyan-300
                         transition-all duration-300
                         shadow-[0_0_15px_rgba(34,211,238,0.3)]
                         hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>UPLOAD</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
