/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getVideoCoverSrc, withBasePath } from '@/lib/base-path'

export interface HomeVideoTrainingCardItem {
  id: string
  title: string
  tag: string
  coverUrl: string | null
  coverPositionX: number
  coverPositionY: number
  createdAt: string
  captionsCount: number
}

interface HomeVideoTrainingGridProps {
  items: HomeVideoTrainingCardItem[]
  isAdmin?: boolean
}

interface CoverNaturalSizeState {
  src: string
  width: number
  height: number
}

interface CoverDragState {
  itemId: string
  startClientX: number
  startClientY: number
  startOffsetX: number
  startOffsetY: number
  startPositionX: number
  startPositionY: number
  lastPositionX: number
  lastPositionY: number
  viewportWidth: number
  viewportHeight: number
  scaledWidth: number
  scaledHeight: number
}

function clampCoverPosition(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function formatCreatedDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getPreviewMetrics(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  positionX: number,
  positionY: number
) {
  const scale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight)
  const scaledWidth = naturalWidth * scale
  const scaledHeight = naturalHeight * scale
  const maxOffsetX = viewportWidth - scaledWidth
  const maxOffsetY = viewportHeight - scaledHeight
  const offsetX = scaledWidth <= viewportWidth ? 0 : maxOffsetX * (positionX / 100)
  const offsetY = scaledHeight <= viewportHeight ? 0 : maxOffsetY * (positionY / 100)

  return {
    scaledWidth,
    scaledHeight,
    offsetX,
    offsetY,
  }
}

function getPositionFromOffset(offset: number, viewportSize: number, scaledSize: number) {
  if (scaledSize <= viewportSize) {
    return 50
  }

  return clampCoverPosition((offset / (viewportSize - scaledSize)) * 100)
}

export default function HomeVideoTrainingGrid({ items: initialItems, isAdmin = false }: HomeVideoTrainingGridProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(initialItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [positioningId, setPositioningId] = useState<string | null>(null)
  const [positionSavingId, setPositionSavingId] = useState<string | null>(null)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [coverSizesById, setCoverSizesById] = useState<Record<string, CoverNaturalSizeState>>({})

  const dragStateRef = useRef<CoverDragState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const activeLoads: Array<{ image: HTMLImageElement }> = []
    let cancelled = false

    for (const item of items) {
      if (!item.coverUrl) {
        continue
      }

      const src = getVideoCoverSrc(item.coverUrl)
      const current = coverSizesById[item.id]
      if (current?.src === src) {
        continue
      }

      const image = new window.Image()
      activeLoads.push({ image })
      image.onload = () => {
        if (cancelled) {
          return
        }

        setCoverSizesById((prev) => ({
          ...prev,
          [item.id]: {
            src,
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height,
          },
        }))
      }
      image.src = src
    }

    return () => {
      cancelled = true
      activeLoads.forEach(({ image }) => {
        image.onload = null
      })
    }
  }, [coverSizesById, items])

  useEffect(() => {
    if (!draggingId) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      const nextOffsetX = dragState.startOffsetX + (event.clientX - dragState.startClientX)
      const nextOffsetY = dragState.startOffsetY + (event.clientY - dragState.startClientY)
      const nextPositionX = getPositionFromOffset(nextOffsetX, dragState.viewportWidth, dragState.scaledWidth)
      const nextPositionY = getPositionFromOffset(nextOffsetY, dragState.viewportHeight, dragState.scaledHeight)

      dragState.lastPositionX = nextPositionX
      dragState.lastPositionY = nextPositionY

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === dragState.itemId
            ? { ...entry, coverPositionX: nextPositionX, coverPositionY: nextPositionY }
            : entry
        )
      )
    }

    const handlePointerUp = () => {
      const dragState = dragStateRef.current

      setDraggingId(null)
      dragStateRef.current = null

      if (!dragState) {
        return
      }

      void persistCoverPosition(
        dragState.itemId,
        dragState.lastPositionX,
        dragState.lastPositionY,
        dragState.startPositionX,
        dragState.startPositionY
      )
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [draggingId])

  const handleDelete = async (item: HomeVideoTrainingCardItem) => {
    if (!isAdmin || deletingId) {
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

  const persistCoverPosition = async (
    itemId: string,
    nextX: number,
    nextY: number,
    previousX: number,
    previousY: number
  ) => {
    const normalizedX = clampCoverPosition(nextX)
    const normalizedY = clampCoverPosition(nextY)
    const normalizedPreviousX = clampCoverPosition(previousX)
    const normalizedPreviousY = clampCoverPosition(previousY)

    if (normalizedX === normalizedPreviousX && normalizedY === normalizedPreviousY) {
      return
    }

    setPositionSavingId(itemId)
    setPositionError(null)

    try {
      const response = await fetch(withBasePath(`/api/video-training-items/${itemId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverPositionX: normalizedX,
          coverPositionY: normalizedY,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || `Position update failed: ${response.status}`)
      }

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                coverPositionX: clampCoverPosition(data.coverPositionX),
                coverPositionY: clampCoverPosition(data.coverPositionY),
              }
            : entry
        )
      )
    } catch (error) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                coverPositionX: normalizedPreviousX,
                coverPositionY: normalizedPreviousY,
              }
            : entry
        )
      )
      setPositionError(error instanceof Error ? error.message : 'Position update failed')
    } finally {
      setPositionSavingId(null)
    }
  }

  const handlePreviewPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    item: HomeVideoTrainingCardItem,
    naturalSize: CoverNaturalSizeState
  ) => {
    if (positionSavingId === item.id) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const metrics = getPreviewMetrics(
      naturalSize.width,
      naturalSize.height,
      rect.width,
      rect.height,
      item.coverPositionX,
      item.coverPositionY
    )

    dragStateRef.current = {
      itemId: item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: metrics.offsetX,
      startOffsetY: metrics.offsetY,
      startPositionX: item.coverPositionX,
      startPositionY: item.coverPositionY,
      lastPositionX: item.coverPositionX,
      lastPositionY: item.coverPositionY,
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      scaledWidth: metrics.scaledWidth,
      scaledHeight: metrics.scaledHeight,
    }

    setDraggingId(item.id)
    setPositionError(null)
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
      {positionError ? (
        <div className="rounded-md border border-yellow-500/35 bg-yellow-500/[0.08] px-4 py-3 text-sm text-yellow-100">
          {positionError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ padding: '16px', overflow: 'visible' }}>
        {items.map((item, index) => {
          const coverSrc = getVideoCoverSrc(item.coverUrl)
          const naturalSize = coverSizesById[item.id]
          const previewMetrics = naturalSize
            ? getPreviewMetrics(naturalSize.width, naturalSize.height, 144, 81, item.coverPositionX, item.coverPositionY)
            : null

          return (
            <div key={item.id} className="group relative">
              {isAdmin ? (
                <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setPositionError(null)
                      setPositioningId((current) => current === item.id ? null : item.id)
                    }}
                    className="rounded-md border border-cyan-500/35 bg-black/65 px-2 py-1 font-mono text-[10px] text-cyan-300 opacity-80 transition-colors hover:border-cyan-300/70 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
                    disabled={!item.coverUrl}
                    aria-label={`Adjust card cover position for "${item.title}"`}
                    title={item.coverUrl ? `Adjust cover position for "${item.title}"` : 'No cover image'}
                  >
                    POS
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void handleDelete(item)
                    }}
                    className="rounded-md border border-red-500/35 bg-black/65 px-2 py-1 font-mono text-[10px] text-red-300 opacity-80 transition-colors hover:border-red-400/70 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
                    disabled={deletingId === item.id}
                    aria-label={`Delete video training "${item.title}"`}
                    title={`Delete video training "${item.title}"`}
                  >
                    {deletingId === item.id ? '...' : 'DEL'}
                  </button>
                </div>
              ) : null}

              {isAdmin && positioningId === item.id ? (
                <div
                  className="absolute right-3 top-12 z-30 w-44 rounded-lg border border-cyan-500/35 bg-black/92 p-3 shadow-[0_0_24px_rgba(34,211,238,0.14)] backdrop-blur-md"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-300/80">DRAG COVER</div>
                    <span className="font-mono text-[10px] text-cyan-200/65">
                      {item.coverPositionX}/{item.coverPositionY}
                    </span>
                  </div>

                  {item.coverUrl && naturalSize && previewMetrics ? (
                    <div
                      role="presentation"
                      onPointerDown={(event) => handlePreviewPointerDown(event, item, naturalSize)}
                      className={`relative aspect-video overflow-hidden rounded-md border border-cyan-500/28 bg-slate-950 ${draggingId === item.id ? 'cursor-grabbing' : 'cursor-grab'} touch-none select-none`}
                    >
                      <img
                        src={coverSrc}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute max-w-none"
                        style={{
                          width: `${previewMetrics.scaledWidth}px`,
                          height: `${previewMetrics.scaledHeight}px`,
                          left: `${previewMetrics.offsetX}px`,
                          top: `${previewMetrics.offsetY}px`,
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 border border-cyan-300/35 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14)]" />
                      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-300/20" />
                      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-300/20" />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-md border border-cyan-500/20 bg-black/40 text-[10px] font-mono text-cyan-300/55">
                      LOADING PREVIEW...
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, coverPositionX: 50, coverPositionY: 50 }
                              : entry
                          )
                        )
                        void persistCoverPosition(item.id, 50, 50, item.coverPositionX, item.coverPositionY)
                      }}
                      disabled={positionSavingId === item.id}
                      className="rounded border border-cyan-500/28 px-2 py-1.5 font-mono text-[10px] text-cyan-200 transition-colors hover:border-cyan-300/65 disabled:opacity-40"
                    >
                      CENTER
                    </button>
                    <div className="text-right text-[10px] font-mono text-cyan-300/55">
                      {positionSavingId === item.id ? 'SAVING...' : 'Drag inside preview'}
                    </div>
                  </div>
                </div>
              ) : null}

              <Link
                href={`/video/${item.id}`}
                className="block overflow-hidden rounded-lg border border-cyan-500/24 bg-black/45 shadow-[0_0_24px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:border-cyan-400/55 hover:shadow-[0_0_32px_rgba(34,211,238,0.18)]"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-950">
                  <div
                    className="h-full w-full bg-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `url("${coverSrc}")`,
                      backgroundPosition: `${item.coverPositionX}% ${item.coverPositionY}%`,
                    }}
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
                    [ ACCESS ] -&gt;
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
