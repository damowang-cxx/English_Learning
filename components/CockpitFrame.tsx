import React from 'react';

export const CockpitFrame = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      
      {/* --- 顶部倒梯形结构 (Top Overhead Panel) --- */}
      <div className="relative w-full h-24 flex justify-center shrink-0">
         {/* 顶部深色遮罩背景 */}
         <div 
           className="h-full w-2/3 sm:w-1/2 bg-slate-950/90 border-b-2 border-x-2 border-cyan-600/50 backdrop-blur-md shadow-[0_0_30px_rgba(8,145,178,0.3)]"
           style={{ 
             clipPath: 'polygon(0 0, 100% 0, 85% 100%, 15% 100%)' // 倒梯形裁剪
           }}
         >
            {/* 顶部内部装饰细节 */}
            <div className="w-full h-full flex flex-col items-center justify-end pb-2">
                <div className="flex gap-2 mb-1">
                    <div className="w-16 h-1 bg-red-500/50 rounded-full animate-pulse"></div>
                    <div className="w-16 h-1 bg-yellow-500/50 rounded-full"></div>
                    <div className="w-16 h-1 bg-green-500/50 rounded-full"></div>
                </div>
                <div className="text-[10px] text-cyan-500/60 font-mono tracking-[0.3em]">SYSTEM OVERRIDE</div>
            </div>
         </div>
      </div>

      {/* --- 中间视野分割线 (Window Glazing Lines) --- */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(6,182,212,0.1)" />
                <stop offset="50%" stopColor="rgba(6,182,212,0)" />
                <stop offset="100%" stopColor="rgba(6,182,212,0.1)" />
            </linearGradient>
        </defs>

        {/* 左右两侧的斜柱 (A柱) */}
        <path d="M0 0 L 200 150 L 200 1080" stroke="rgba(6,182,212,0.3)" strokeWidth="2" fill="none" className="hidden sm:block" />
        <path d="M1920 0 L 1720 150 L 1720 1080" stroke="rgba(6,182,212,0.3)" strokeWidth="2" fill="none" className="hidden sm:block" />

        {/* 玻璃微反光层 (左右两侧暗角) */}
        <rect x="0" y="0" width="15%" height="100%" fill="url(#glass-gradient)" opacity="0.3" />
        <rect x="85%" y="0" width="15%" height="100%" fill="url(#glass-gradient)" opacity="0.3" />

        {/* 视野中心的准星/HUD辅助线 */}
        <line x1="48%" y1="50%" x2="49.5%" y2="50%" stroke="rgba(6,182,212,0.4)" strokeWidth="1" />
        <line x1="50.5%" y1="50%" x2="52%" y2="50%" stroke="rgba(6,182,212,0.4)" strokeWidth="1" />
        <circle cx="50%" cy="50%" r="200" stroke="rgba(6,182,212,0.1)" strokeWidth="1" strokeDasharray="10 20" fill="none" />
      </svg>

      {/* --- 底部仪表盘容器 (Bottom Instrument Panel) --- */}
      <div className="relative w-full flex items-end justify-center">
         {/* 仪表盘主体形状 */}
         <div className="relative w-full max-w-4xl h-auto">
             
            {/* 梯形背景 */}
            <div 
                className="absolute inset-0 bg-slate-900/95 border-t border-cyan-500/50 backdrop-blur-xl shadow-2xl z-0"
                style={{
                    clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0% 100%)',
                    boxShadow: '0 -10px 40px rgba(6,182,212,0.2)'
                }}
            ></div>
            
            {/* 装饰发光线 */}
            <div className="absolute top-0 left-[10%] w-[80%] h-[1px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] z-10"></div>

            {/* 内容区域 (允许点击) */}
            <div className="relative z-20 pointer-events-auto px-12 sm:px-24 py-8 pb-12 flex flex-col items-center">
                {children}
            </div>
         </div>
      </div>
    </div>
  );
};
