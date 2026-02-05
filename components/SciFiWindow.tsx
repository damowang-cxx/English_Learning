import React from 'react';

interface SciFiWindowProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const SciFiWindow: React.FC<SciFiWindowProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`relative group ${className}`}>
      {/* 1. 外层发光容器 */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
      
      {/* 2. 主体背景 */}
      <div className="relative flex flex-col w-full h-full bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-lg overflow-hidden shadow-2xl">
        
        {/* 3. 装饰性角落 (四角的高亮支架) */}
        {/* 左上 */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg z-10"></div>
        {/* 右上 */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg z-10"></div>
        {/* 左下 */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg z-10"></div>
        {/* 右下 */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-lg z-10"></div>

        {/* 4. 标题栏 (如果有标题) */}
        {title && (
          <div className="relative px-6 py-3 border-b border-cyan-500/30 bg-cyan-950/30 flex items-center justify-between">
            {/* 标题文字 */}
            <h3 className="text-cyan-300 font-mono tracking-widest uppercase text-lg font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">
              {title}
            </h3>
            
            {/* 标题栏右侧的装饰点阵 */}
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-cyan-500/50 rounded-full"></div>
              <div className="w-2 h-2 bg-cyan-500/20 rounded-full"></div>
            </div>
          </div>
        )}

        {/* 5. 内部扫描线背景效果 (可选) */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-10" 
             style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
        </div>

        {/* 6. 内容区域 */}
        <div className="relative z-10 p-6 text-cyan-50">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SciFiWindow;