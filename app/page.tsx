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
      <div className="container mx-auto px-4 py-8 cockpit-viewport" style={{
        position: 'relative',
        zIndex: 10,
        paddingTop: '8vh',
        paddingBottom: '15vh',
        maxHeight: '65vh',
        overflowY: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '85%',
        maxWidth: '1200px'
      }}>
        {/* 上传按钮已集成到仪表盘中 */}

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-8 rounded-lg" style={{
              background: 'rgba(232, 244, 255, 0.02)',
              border: '1px solid rgba(232, 244, 255, 0.08)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(232, 244, 255, 0.05)'
            }}>
              <p className="text-gray-400 text-lg font-mono mb-4 opacity-70">[ 系统提示 ]</p>
              <p className="text-gray-500 text-base opacity-80">还没有训练条目，开始上传第一个吧！</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <Link
                key={item.id}
                href={`/training/${item.id}`}
                className="block cyber-card p-6 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-200 font-mono group-hover:text-white transition-colors">
                    {item.title}
                  </h2>
                  <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-gray-300 text-sm font-mono">
                    [ 句子片段: {item.sentences.length} ]
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                    <p className="text-gray-400 text-xs font-mono">
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-600/30">
                  <span className="text-gray-400 text-xs font-mono">点击进入 →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
