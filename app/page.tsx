import Link from 'next/link'
import { prisma } from '@/lib/prisma'

async function getTrainingItems() {
  const items = await prisma.trainingItem.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      sentences: true
    }
  })
  return items
}

export default async function Home() {
  const items = await getTrainingItems()

  return (
    <div className="min-h-screen relative">
      {/* 内容区域 - 限制在半圆形窗户视口范围内 */}
      <div className="container mx-auto py-8 cockpit-viewport" style={{
        position: 'relative',
        zIndex: 10,
        paddingTop: '8vh',
        paddingBottom: '45vh',
        paddingLeft: '2rem',
        paddingRight: '2rem',
        maxHeight: '65vh',
        overflowY: 'auto',
        overflowX: 'visible',
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '75%',
        maxWidth: '1000px'
      }}>
        {/* 上传按钮已集成到仪表盘中 */}

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-8 rounded-lg cyber-empty-state relative overflow-hidden">
              {/* 扫描线效果 */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,255,255,0.1)_50%,transparent_100%)] bg-[length:100%_4px] animate-scan-vertical opacity-50"></div>
              {/* 边框光效 */}
              <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-lg opacity-50"></div>
              <div className="absolute inset-[-2px] border border-cyan-500/20 rounded-lg opacity-30 animate-pulse"></div>
              
              <div className="relative z-10">
                <p className="text-cyan-400 text-lg font-mono mb-4 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]">
                  [ SYSTEM ALERT ]
                </p>
                <p className="text-gray-300 text-base font-mono">
                  数据库为空 | 准备接收训练数据...
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ padding: '16px', overflow: 'visible' }}>
            {items.map((item, index) => {
              // 根据索引选择不同的主题色
              const colors = [
                { primary: 'cyan', secondary: 'rgba(0,255,255,0.3)', glow: 'rgba(0,255,255,0.6)' },
                { primary: 'purple', secondary: 'rgba(168,85,247,0.3)', glow: 'rgba(168,85,247,0.6)' },
                { primary: 'green', secondary: 'rgba(10,255,10,0.3)', glow: 'rgba(10,255,10,0.6)' },
                { primary: 'pink', secondary: 'rgba(255,0,128,0.3)', glow: 'rgba(255,0,128,0.6)' },
                { primary: 'yellow', secondary: 'rgba(255,255,0,0.3)', glow: 'rgba(255,255,0,0.6)' },
              ]
              const colorTheme = colors[index % colors.length]
              
              return (
                <Link
                  key={item.id}
                  href={`/training/${item.id}`}
                  className="block cyber-training-card group relative"
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    '--card-color': colorTheme.secondary,
                    '--card-glow': colorTheme.glow,
                  } as React.CSSProperties}
                >
                  {/* 内部容器 - 控制内容溢出 */}
                  <div className="relative overflow-hidden rounded-lg h-full">
                    {/* 背景网格 */}
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_48%,var(--card-color)_49%,var(--card-color)_51%,transparent_52%),linear-gradient(90deg,transparent_48%,var(--card-color)_49%,var(--card-color)_51%,transparent_52%)] bg-[length:20px_20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* 扫描线效果 */}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,var(--card-color)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 animate-scan-vertical transition-opacity duration-300"></div>
                    
                    {/* 左上角装饰 */}
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-500/50 opacity-60"></div>
                    <div className="absolute top-2 left-2 w-8 h-8 border-t border-l border-cyan-500/30"></div>
                    
                    {/* 右下角装饰 */}
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-500/50 opacity-60"></div>
                    <div className="absolute bottom-2 right-2 w-8 h-8 border-b border-r border-cyan-500/30"></div>
                    
                    {/* 内容区域 */}
                    <div className="relative z-10 p-6">
                    {/* 标题和编号 */}
                    <div className="flex items-start justify-between mb-4 gap-2">
                      <h2 
                        className="text-xl font-bold text-cyan-300 font-mono group-hover:text-cyan-200 transition-colors drop-shadow-[0_0_4px_var(--card-glow)] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                        title={item.title}
                      >
                        {item.title}
                      </h2>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-cyan-400 font-mono font-bold">#{String(index + 1).padStart(3, '0')}</span>
                        <div className="w-8 h-0.5 bg-cyan-500/50"></div>
                      </div>
                    </div>
                    
                    {/* 数据信息 */}
                    <div className="space-y-3 mb-4">
                      {/* 句子数量 */}
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors"></div>
                        <div className="flex-1">
                          <p className="text-gray-300 text-sm font-mono">
                            <span className="text-cyan-400">[ SEGMENTS ]</span> {item.sentences.length}
                          </p>
                          {/* 进度条 */}
                          <div className="mt-1 h-1 bg-gray-800/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500 group-hover:shadow-[0_0_8px_rgba(0,255,255,0.6)]"
                              style={{ width: `${Math.min((item.sentences.length / 20) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 创建时间 */}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                        <p className="text-gray-400 text-xs font-mono">
                          {new Date(item.createdAt).toLocaleDateString('zh-CN', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {/* 底部操作提示 */}
                    <div className="mt-4 pt-4 border-t border-cyan-500/20 group-hover:border-cyan-400/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs font-mono group-hover:text-cyan-400 transition-colors">
                          [ ACCESS ]
                        </span>
                        <span className="text-cyan-500 text-lg font-mono group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </div>
                    </div>
                  </div>
                  
                  {/* 悬停时的光效边框 - 在外部，不会被裁剪 */}
                  <div className="absolute inset-0 border-2 border-cyan-500/0 group-hover:border-cyan-500/50 rounded-lg transition-all duration-300 pointer-events-none"></div>
                  <div className="absolute inset-[-2px] border border-cyan-500/0 group-hover:border-cyan-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none animate-pulse"></div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
