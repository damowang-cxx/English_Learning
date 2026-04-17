'use client'

import Link from 'next/link'
import { withBasePath } from '@/lib/base-path'

export interface HomeDialogueScenarioCardItem {
  id: string
  title: string
  description: string
  difficulty: string
  userRole: string
  aiRole: string
  tags: string[]
  coverUrl: string | null
  nodesCount: number
  sessionsCount: number
  updatedAt: string
}

interface HomeDialogueScenarioGridProps {
  items: HomeDialogueScenarioCardItem[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getCoverUrl(coverUrl: string | null) {
  return withBasePath(coverUrl || '/Learnico.png')
}

export default function HomeDialogueScenarioGrid({ items }: HomeDialogueScenarioGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block overflow-hidden rounded-lg border border-cyan-500/30 bg-black/35 p-8 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
          <p className="mb-4 font-mono text-lg text-cyan-300">[ DIALOGUE SCENES EMPTY ]</p>
          <p className="font-mono text-base text-gray-300">Publish a scene graph to begin role-play practice.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" style={{ padding: '12px', overflow: 'visible' }}>
      {items.map((item, index) => (
        <Link
          key={item.id}
          href={`/dialogue/${item.id}`}
          className="group relative min-w-0 overflow-hidden rounded-lg border border-cyan-500/24 bg-black/45 shadow-[0_0_22px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:border-cyan-300/55 hover:shadow-[0_0_30px_rgba(34,211,238,0.16)]"
        >
          <div className="relative h-44 overflow-hidden bg-slate-950">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-65 transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url("${getCoverUrl(item.coverUrl)}")` }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
            <div className="absolute left-3 top-3 rounded border border-cyan-300/35 bg-black/58 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-cyan-100">
              {item.difficulty.toUpperCase()}
            </div>
            <div className="absolute bottom-3 left-3 font-mono text-[11px] text-cyan-200/85">
              #{String(index + 1).padStart(3, '0')} / {item.nodesCount} NODES
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <h2 className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-lg font-bold text-cyan-100" title={item.title}>
                {item.title}
              </h2>
              <p className="mt-2 line-clamp-2 min-h-[3rem] text-sm leading-6 text-cyan-100/68">
                {item.description || 'Practice a real-life English dialogue with a coach.'}
              </p>
            </div>

            <div className="grid gap-2 text-xs text-cyan-100/74 sm:grid-cols-2">
              <div className="rounded-md border border-cyan-500/18 bg-black/30 px-3 py-2">
                <div className="font-mono text-[10px] tracking-[0.16em] text-cyan-400/60">YOUR ROLE</div>
                <div className="mt-1 truncate">{item.userRole || 'Learner'}</div>
              </div>
              <div className="rounded-md border border-cyan-500/18 bg-black/30 px-3 py-2">
                <div className="font-mono text-[10px] tracking-[0.16em] text-cyan-400/60">AI ROLE</div>
                <div className="mt-1 truncate">{item.aiRole || 'Coach'}</div>
              </div>
            </div>

            {item.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {item.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-cyan-500/18 bg-cyan-500/[0.07] px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-cyan-200/74"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-cyan-500/18 pt-3 font-mono text-[11px] text-cyan-300/70">
              <span>UPDATED {formatDate(item.updatedAt)}</span>
              <span>[ START ] -&gt;</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
