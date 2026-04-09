'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { withBasePath } from '@/lib/base-path'

export interface HomeTrainingCardItem {
  id: string
  title: string
  createdAt: string
  sentencesCount: number
}

interface HomeTrainingGridProps {
  items: HomeTrainingCardItem[]
  isAdmin?: boolean
}

const CARD_THEMES = [
  { secondary: 'rgba(0,255,255,0.3)', glow: 'rgba(0,255,255,0.6)' },
  { secondary: 'rgba(168,85,247,0.3)', glow: 'rgba(168,85,247,0.6)' },
  { secondary: 'rgba(10,255,10,0.3)', glow: 'rgba(10,255,10,0.6)' },
  { secondary: 'rgba(255,0,128,0.3)', glow: 'rgba(255,0,128,0.6)' },
  { secondary: 'rgba(255,255,0,0.3)', glow: 'rgba(255,255,0,0.6)' },
]

function formatCreatedDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function HomeTrainingGrid({ items: initialItems, isAdmin = false }: HomeTrainingGridProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(initialItems)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<HomeTrainingCardItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPortalReady, setIsPortalReady] = useState(false)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    setIsPortalReady(true)
    return () => setIsPortalReady(false)
  }, [])

  useEffect(() => {
    if (!pendingDeleteItem) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingId) {
        setPendingDeleteItem(null)
        setDeleteError(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingDeleteItem, deletingId])

  const removingIdSet = useMemo(() => removingIds, [removingIds])

  const handleDeleteCard = async () => {
    if (!isAdmin || !pendingDeleteItem || deletingId) {
      return
    }

    setDeletingId(pendingDeleteItem.id)
    setDeleteError(null)

    try {
      const response = await fetch(withBasePath(`/api/training-items/${pendingDeleteItem.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Delete training item failed:', errorText)
        throw new Error(`Delete failed: ${response.status}`)
      }

      const deletedId = pendingDeleteItem.id
      setRemovingIds((prev) => new Set(prev).add(deletedId))

      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== deletedId))
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(deletedId)
          return next
        })
        setPendingDeleteItem(null)
        setDeletingId(null)

        startTransition(() => {
          router.refresh()
        })
      }, 260)
    } catch (error) {
      console.error('Delete training item error:', error)
      setDeleteError(`Delete failed, please retry: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="cyber-empty-state relative inline-block overflow-hidden rounded-lg p-8">
          <div className="absolute inset-0 animate-scan-vertical bg-[linear-gradient(180deg,transparent_0%,rgba(0,255,255,0.1)_50%,transparent_100%)] bg-[length:100%_4px] opacity-50"></div>
          <div className="absolute inset-0 rounded-lg border-2 border-cyan-500/30 opacity-50"></div>
          <div className="absolute inset-[-2px] animate-pulse rounded-lg border border-cyan-500/20 opacity-30"></div>

          <div className="relative z-10">
            <p className="mb-4 font-mono text-lg text-cyan-400 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]">
              [ SYSTEM ALERT ]
            </p>
            <p className="font-mono text-base text-gray-300">
              Database empty | Awaiting training uploads...
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-500"></div>
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" style={{ animationDelay: '0.2s' }}></div>
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const deleteDialog =
    isPortalReady && pendingDeleteItem
      ? createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center px-4">
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0 bg-transparent"
              onClick={() => {
                if (!deletingId) {
                  setPendingDeleteItem(null)
                  setDeleteError(null)
                }
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Delete training "${pendingDeleteItem.title}"`}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-red-500/35 bg-[linear-gradient(160deg,rgba(18,6,8,0.96),rgba(8,8,10,0.94))] p-5 shadow-[0_0_35px_rgba(255,0,64,0.18),inset_0_0_24px_rgba(255,0,64,0.06)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,0,64,0.06)_50%,transparent_100%)] bg-[length:100%_4px] opacity-40"></div>
              <div className="pointer-events-none absolute left-0 top-0 h-12 w-12 border-l border-t border-red-500/45"></div>
              <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-b border-r border-red-500/45"></div>

              <div className="relative z-20">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="cyber-label text-[10px] tracking-[0.3em] text-red-400/75">DELETE CONFIRM</div>
                    <h3 className="cyber-title mt-2 text-xl text-red-200">DELETE TRAINING</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!deletingId) {
                        setPendingDeleteItem(null)
                        setDeleteError(null)
                      }
                    }}
                    className="relative z-20 rounded-md border border-red-500/22 px-2 py-1 text-[10px] text-red-300/75 transition-colors hover:border-red-400/36 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(deletingId)}
                  >
                    CLOSE
                  </button>
                </div>

                <div className="rounded-lg border border-red-500/18 bg-black/30 p-4">
                  <div className="cyber-font-readable mb-3 break-words text-sm text-red-100">
                    {pendingDeleteItem.title}
                  </div>
                  <div className="cyber-label space-y-2 text-[11px] text-red-300/65">
                    <div className="flex items-center justify-between gap-3">
                      <span>[ SEGMENTS ]</span>
                      <span className="cyber-number text-red-200/85">{pendingDeleteItem.sentencesCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>[ CREATED ]</span>
                      <span className="cyber-number text-red-200/85">{formatCreatedDate(pendingDeleteItem.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="cyber-label mt-4 text-[11px] leading-6 text-red-300/68">
                  Deleting this training removes its audio, all sentence segments, and linked notes. This action
                  cannot be undone.
                </div>

                {deleteError && (
                  <div className="cyber-text mt-4 rounded-md border border-red-500/28 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200/85">
                    {deleteError}
                  </div>
                )}

                <div className="relative z-20 mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!deletingId) {
                        setPendingDeleteItem(null)
                        setDeleteError(null)
                      }
                    }}
                    className="relative z-20 rounded-md border border-red-500/18 bg-black/25 px-4 py-2 text-xs text-red-300/70 transition-colors hover:border-red-400/28 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(deletingId)}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCard()}
                    className="relative z-20 rounded-md border border-red-500/34 bg-red-500/[0.14] px-4 py-2 text-xs text-red-100 transition-all hover:border-red-400/48 hover:bg-red-500/[0.2] active:translate-y-[1px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(deletingId)}
                  >
                    {deletingId ? 'DELETING...' : 'DELETE'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ padding: '16px', overflow: 'visible' }}>
        {items.map((item, index) => {
          const colorTheme = CARD_THEMES[index % CARD_THEMES.length]
          const isRemoving = removingIdSet.has(item.id)

          return (
            <div
              key={item.id}
              className="group relative"
              style={{
                animationDelay: `${index * 0.1}s`,
                ['--card-color' as string]: colorTheme.secondary,
                ['--card-glow' as string]: colorTheme.glow,
              } as CSSProperties}
            >
              {isAdmin ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setDeleteError(null)
                    setPendingDeleteItem(item)
                  }}
                  className={`home-card-delete-button absolute bottom-[0.65rem] right-[0.65rem] z-30 ${
                    isRemoving || deletingId === item.id
                      ? 'pointer-events-none opacity-0'
                      : 'opacity-45 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100'
                  }`}
                  title={`Delete training "${item.title}"`}
                  aria-label={`Delete training "${item.title}"`}
                >
                  <span className="home-card-delete-button__scan" aria-hidden="true"></span>
                  <span className="home-card-delete-button__edge" aria-hidden="true"></span>
                  <svg
                    className="home-card-delete-button__icon h-3.5 w-3.5 translate-y-[2px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
                    />
                  </svg>
                </button>
              ) : null}

              <Link
                href={`/training/${item.id}`}
                className={`block cyber-training-card relative ${isRemoving ? 'is-removing' : ''}`}
              >
                <div className="relative h-full overflow-hidden rounded-lg">
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_48%,var(--card-color)_49%,var(--card-color)_51%,transparent_52%),linear-gradient(90deg,transparent_48%,var(--card-color)_49%,var(--card-color)_51%,transparent_52%)] bg-[length:20px_20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="absolute inset-0 animate-scan-vertical bg-[linear-gradient(180deg,transparent_0%,var(--card-color)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                  <div className="absolute left-0 top-0 h-12 w-12 border-l-2 border-t-2 border-cyan-500/50 opacity-60"></div>
                  <div className="absolute left-2 top-2 h-8 w-8 border-l border-t border-cyan-500/30"></div>
                  <div className="absolute bottom-0 right-0 h-12 w-12 border-b-2 border-r-2 border-cyan-500/50 opacity-60"></div>
                  <div className="absolute bottom-2 right-2 h-8 w-8 border-b border-r border-cyan-500/30"></div>

                  <div className="relative z-10 p-6">
                    <div className="mb-4 flex items-start justify-between gap-2 pr-8">
                      <h2
                        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xl font-bold text-cyan-300 transition-colors drop-shadow-[0_0_4px_var(--card-glow)] group-hover:text-cyan-200"
                        title={item.title}
                      >
                        {item.title}
                      </h2>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-bold text-cyan-400">#{String(index + 1).padStart(3, '0')}</span>
                        <div className="h-0.5 w-8 bg-cyan-500/50"></div>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-cyan-500/50 transition-colors group-hover:bg-cyan-400"></div>
                        <div className="flex-1">
                          <p className="font-mono text-sm text-gray-300">
                            <span className="text-cyan-400">[ SEGMENTS ]</span> {item.sentencesCount}
                          </p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-800/50">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500 group-hover:shadow-[0_0_8px_rgba(0,255,255,0.6)]"
                              style={{ width: `${Math.min((item.sentencesCount / 20) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500"></span>
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" style={{ animationDelay: '0.2s' }}></span>
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                        <p className="font-mono text-xs text-gray-400">{formatCreatedDate(item.createdAt)}</p>
                      </div>
                    </div>

                    <div className="home-card-access-rail mt-4 border-t border-cyan-500/20 pt-4 pr-12 transition-colors group-hover:border-cyan-400/40">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-gray-400 transition-colors group-hover:text-cyan-400">
                          [ ACCESS ]
                        </span>
                        <span className="font-mono text-lg text-cyan-500 transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-cyan-500/0 transition-all duration-300 group-hover:border-cyan-500/50"></div>
                <div className="pointer-events-none absolute inset-[-2px] animate-pulse rounded-lg border border-cyan-500/0 opacity-0 transition-opacity duration-300 group-hover:border-cyan-500/30 group-hover:opacity-100"></div>
              </Link>
            </div>
          )
        })}
      </div>

      {deleteDialog}
    </>
  )
}
