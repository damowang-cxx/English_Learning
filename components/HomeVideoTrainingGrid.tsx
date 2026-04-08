'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getVideoCoverSrc, withBasePath } from '@/lib/base-path'

export interface HomeVideoTrainingCardItem {
  id: string
  title: string
  tag: string
  coverUrl: string | null
  createdAt: string
  captionsCount: number
}

interface HomeVideoTrainingGridProps {
  items: HomeVideoTrainingCardItem[]
}

function formatCreatedDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function HomeVideoTrainingGrid({ items: initialItems }: HomeVideoTrainingGridProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(initialItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const handleDelete = async (item: HomeVideoTrainingCardItem) => {
    if (deletingId) {
      return
    }

    const shouldDelete = window.confirm(`Delete video training "${item.title}"?`)

    if (!shouldDelete) {
      return
    }

    setDeletingId(item.id)
    setDeleteError(null)

    try {
      const response = await fetch(withBasePath(`/api/video-training-items/${item.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }

      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block overflow-hidden rounded-lg border border-cyan-500/30 bg-black/35 p-8 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
          <p className="mb-4 font-mono text-lg text-cyan-300">[ VIDEO ARCHIVE EMPTY ]</p>
          <p className="font-mono text-base text-gray-300">Upload a clip and caption file to begin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deleteError ? (
        <div className="rounded-md border border-red-500/35 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          {deleteError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ padding: '16px', overflow: 'visible' }}>
        {items.map((item, index) => (
          <div key={item.id} className="group relative">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void handleDelete(item)
              }}
              className="absolute right-3 top-3 z-30 rounded-md border border-red-500/35 bg-black/65 px-2 py-1 font-mono text-[10px] text-red-300 opacity-80 transition-colors hover:border-red-400/70 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
              disabled={deletingId === item.id}
              aria-label={`Delete video training "${item.title}"`}
              title={`Delete video training "${item.title}"`}
            >
              {deletingId === item.id ? '...' : 'DEL'}
            </button>

            <Link
              href={`/video/${item.id}`}
              className="block overflow-hidden rounded-lg border border-cyan-500/24 bg-black/45 shadow-[0_0_24px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:border-cyan-400/55 hover:shadow-[0_0_32px_rgba(34,211,238,0.18)]"
            >
              <div className="relative aspect-video overflow-hidden bg-slate-950">
                <div
                  className="h-full w-full bg-cover bg-center opacity-80 transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url("${getVideoCoverSrc(item.coverUrl)}")` }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/18 to-transparent" />
                <div className="absolute left-3 top-3 rounded border border-cyan-300/35 bg-black/55 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-100">
                  {item.tag}
                </div>
                <div className="absolute bottom-3 left-3 font-mono text-xs text-cyan-200/85">
                  #{String(index + 1).padStart(3, '0')}
                </div>
              </div>

              <div className="p-5">
                <h2 className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-lg font-bold text-cyan-200" title={item.title}>
                  {item.title}
                </h2>
                <div className="mt-4 space-y-2 font-mono text-xs text-gray-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-cyan-400/70">[ CAPTIONS ]</span>
                    <span className="text-cyan-100">{item.captionsCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-cyan-400/70">[ CREATED ]</span>
                    <span className="text-cyan-100">{formatCreatedDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="mt-5 border-t border-cyan-500/20 pt-4 font-mono text-xs text-cyan-400/80">
                  [ ACCESS ] →
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
