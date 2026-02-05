import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CockpitFrame } from '@/components/CockpitFrame'
import CockpitButtons from '@/components/CockpitButtons'

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
    <>
      <CockpitFrame>
        {/* 仪表盘内容区域 */}
        <div className="w-full flex flex-col items-center gap-6">
          {/* 状态提示文字 */}
          <div className="text-center mb-4">
            <p className="text-cyan-400/80 text-xs font-mono tracking-[0.2em] mb-2">PILOT INTERFACE ACTIVE</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-cyan-500/60 text-[10px] font-mono">SYSTEM READY</span>
            </div>
          </div>

          {/* 操作按钮组 */}
          <CockpitButtons />

          {/* 训练条目列表或空状态 */}
          {items.length === 0 ? (
            <div className="text-center py-12 mt-8">
              <div className="inline-block p-6 rounded border border-cyan-500/20 bg-slate-800/50 backdrop-blur-sm">
                <p className="text-cyan-400/70 text-sm font-mono mb-2">[ 系统提示 ]</p>
                <p className="text-gray-400 text-xs font-mono">还没有训练条目，开始上传第一个吧！</p>
              </div>
            </div>
          ) : (
            <div className="w-full mt-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/training/${item.id}`}
                    className="block p-4 border border-cyan-500/20 bg-slate-800/50 backdrop-blur-sm hover:border-cyan-500/50 hover:bg-slate-800/70 transition-all group"
                    style={{ 
                      transform: 'skewX(-2deg)',
                      animationDelay: `${index * 0.1}s` 
                    }}
                  >
                    <div className="transform -skew-x-2">
                      <div className="flex items-start justify-between mb-3">
                        <h2 className="text-base font-bold text-cyan-300 font-mono group-hover:text-cyan-200 transition-colors">
                          {item.title}
                        </h2>
                        <span className="text-xs text-cyan-500/60 font-mono">#{index + 1}</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        <p className="text-cyan-400/70 text-xs font-mono">
                          [ 句子片段: {item.sentences.length} ]
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
                          <p className="text-cyan-500/50 text-[10px] font-mono">
                            {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-cyan-500/10">
                        <span className="text-cyan-500/60 text-[10px] font-mono">点击进入 →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </CockpitFrame>
    </>
  )
}
