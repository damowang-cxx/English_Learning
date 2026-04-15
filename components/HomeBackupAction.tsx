'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { withBasePath } from '@/lib/base-path'

interface TrainingBackupCounts {
  listeningItems: number
  listeningSentences: number
  videoItems: number
  videoCaptions: number
  videoCharacters: number
  files: number
  totalFileBytes: number
}

interface TrainingBackupSnapshotSummary {
  id: string
  kind: 'manual' | 'safety'
  createdAt: string
  dataHash: string
  counts: TrainingBackupCounts
  missingFiles: string[]
}

interface TrainingBackupStatusResponse {
  backupDir: string
  current: {
    dataHash: string
    counts: TrainingBackupCounts
    missingFiles: string[]
  }
  snapshots: TrainingBackupSnapshotSummary[]
  latestSnapshot: TrainingBackupSnapshotSummary | null
  isCurrentBackedUp: boolean
}

interface TrainingBackupCreateResponse {
  status: 'created' | 'noop'
  snapshot: TrainingBackupSnapshotSummary | null
  message: string
}

interface TrainingBackupRestorePreview {
  snapshot: TrainingBackupSnapshotSummary
  current: {
    dataHash: string
    counts: TrainingBackupCounts
    missingFiles: string[]
  }
  restore: {
    dataHash: string
    counts: TrainingBackupCounts
    missingFiles: string[]
    objectProblems: Array<{ publicPath: string; objectSha256: string; reason: string }>
  }
  canRestore: boolean
}

const BACKUP_BUTTON_CLASS =
  'rounded-md border border-amber-400/42 bg-amber-400/[0.1] px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-amber-200 transition-colors hover:border-amber-300/70 hover:bg-amber-400/[0.16] hover:text-amber-100'

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatCounts(counts: TrainingBackupCounts) {
  return `${counts.listeningItems} listening / ${counts.videoItems} video / ${counts.files} files / ${formatBytes(counts.totalFileBytes)}`
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data && typeof data.error === 'string' ? data.error : `Request failed: ${response.status}`
    throw new Error(message)
  }

  return data as T
}

export default function HomeBackupAction({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<TrainingBackupStatusResponse | null>(null)
  const [preview, setPreview] = useState<TrainingBackupRestorePreview | null>(null)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const manualSnapshots = useMemo(
    () => (status?.snapshots || []).filter((snapshot) => snapshot.kind === 'manual'),
    [status?.snapshots]
  )

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(withBasePath('/api/admin/training-backups'), { cache: 'no-store' })
      const data = await readJsonResponse<TrainingBackupStatusResponse>(response)
      setStatus(data)

      if (!selectedSnapshotId && data.snapshots.length > 0) {
        setSelectedSnapshotId(data.snapshots[0].id)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load backup status.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedSnapshotId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadStatus()
  }, [isOpen, loadStatus])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const createBackup = useCallback(async () => {
    setIsWorking(true)
    setError(null)
    setMessage(null)
    setPreview(null)

    try {
      const response = await fetch(withBasePath('/api/admin/training-backups'), { method: 'POST' })
      const data = await readJsonResponse<TrainingBackupCreateResponse>(response)
      setMessage(data.message || (data.status === 'noop' ? 'No changes found.' : 'Backup created.'))
      await loadStatus()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create backup.')
    } finally {
      setIsWorking(false)
    }
  }, [loadStatus])

  const loadRestorePreview = useCallback(async (snapshotId: string) => {
    if (!snapshotId) {
      return
    }

    setIsWorking(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(withBasePath('/api/admin/training-backups/restore/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      })
      const data = await readJsonResponse<TrainingBackupRestorePreview>(response)
      setPreview(data)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to preview restore.')
    } finally {
      setIsWorking(false)
    }
  }, [])

  const restoreSelectedSnapshot = useCallback(async () => {
    if (!preview?.snapshot.id || !preview.canRestore) {
      return
    }

    setIsWorking(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(withBasePath('/api/admin/training-backups/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: preview.snapshot.id, confirmed: true }),
      })
      await readJsonResponse(response)
      setMessage('Restore completed. Current page data has been refreshed.')
      setPreview(null)
      await loadStatus()
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to restore backup.')
    } finally {
      setIsWorking(false)
    }
  }, [loadStatus, preview?.canRestore, preview?.snapshot.id, router])

  if (!isAdmin) {
    return null
  }

  return (
    <>
      <button type="button" className={BACKUP_BUTTON_CLASS} onClick={() => setIsOpen(true)}>
        BACKUP
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[340] flex items-center justify-center px-4 py-5 pointer-events-auto">
              <button
                type="button"
                className="absolute inset-0 bg-black/62 backdrop-blur-[3px]"
                aria-label="Close backup panel"
                onClick={() => setIsOpen(false)}
              />

              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="training-backup-title"
                className="relative z-10 flex max-h-[min(92vh,780px)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-300/42 bg-[linear-gradient(160deg,rgba(18,14,5,0.97),rgba(5,10,14,0.96)_54%,rgba(6,12,15,0.95))] shadow-[0_0_48px_rgba(251,191,36,0.18),inset_0_0_28px_rgba(251,191,36,0.06)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(251,191,36,0.045)_50%,transparent_100%)] bg-[length:100%_5px] opacity-55" />
                <div className="pointer-events-none absolute left-0 top-0 h-14 w-14 border-l border-t border-amber-300/55" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 border-b border-r border-cyan-300/45" />

                <div className="relative z-10 flex items-start justify-between gap-4 border-b border-amber-400/18 px-5 py-4">
                  <div>
                    <div className="text-[10px] cyber-label tracking-[0.28em] text-amber-200/70">TRAINING CONTENT BACKUP</div>
                    <h2 id="training-backup-title" className="mt-2 text-2xl cyber-title text-amber-50">
                      BACKUP / RESTORE
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-50/70">
                      Back up listening and video training data with the referenced audio, video, cover, and character image files.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-black/24 text-amber-100/75 transition-colors hover:border-amber-200/60 hover:text-amber-50"
                    aria-label="Close backup panel"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="relative z-10 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(251,191,36,0.55)_rgba(8,15,20,0.72)] [scrollbar-width:thin]">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                    <section className="rounded-md border border-amber-400/20 bg-amber-400/[0.045] p-4">
                      <div className="text-[10px] cyber-label tracking-[0.22em] text-amber-200/70">CURRENT STATUS</div>
                      {isLoading && !status ? (
                        <p className="mt-3 text-sm text-amber-50/65">Loading backup status...</p>
                      ) : status ? (
                        <div className="mt-3 space-y-3 text-sm leading-6 text-amber-50/72">
                          <p>{status.isCurrentBackedUp ? 'Current training content is backed up.' : 'Current training content has changes or no backup yet.'}</p>
                          <p>{formatCounts(status.current.counts)}</p>
                          <p className="break-all text-xs text-amber-100/55">Directory: {status.backupDir}</p>
                          {status.current.missingFiles.length > 0 ? (
                            <p className="rounded-md border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-red-100/80">
                              Missing referenced files: {status.current.missingFiles.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-amber-50/65">No status loaded.</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={createBackup}
                          disabled={isWorking}
                          className="rounded-md border border-emerald-300/42 bg-emerald-400/[0.12] px-4 py-2 text-xs font-mono tracking-[0.16em] text-emerald-100 transition-colors hover:border-emerald-200/70 hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {isWorking ? 'WORKING...' : 'BACKUP NOW'}
                        </button>
                        <button
                          type="button"
                          onClick={loadStatus}
                          disabled={isWorking || isLoading}
                          className="rounded-md border border-amber-400/28 bg-black/25 px-4 py-2 text-xs font-mono tracking-[0.16em] text-amber-100/75 transition-colors hover:border-amber-200/55 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          REFRESH
                        </button>
                      </div>
                    </section>

                    <section className="rounded-md border border-cyan-400/18 bg-cyan-400/[0.035] p-4">
                      <div className="text-[10px] cyber-label tracking-[0.22em] text-cyan-200/70">RESTORE POINTS</div>
                      {manualSnapshots.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          <select
                            value={selectedSnapshotId}
                            onChange={(event) => {
                              setSelectedSnapshotId(event.target.value)
                              setPreview(null)
                            }}
                            className="w-full rounded-md border border-cyan-400/24 bg-black/55 px-3 py-2 text-sm text-cyan-50 outline-none transition-colors focus:border-cyan-300/60"
                          >
                            {manualSnapshots.map((snapshot) => (
                              <option key={snapshot.id} value={snapshot.id}>
                                {formatDate(snapshot.createdAt)} - {snapshot.id}
                              </option>
                            ))}
                          </select>

                          <div className="text-sm leading-6 text-cyan-50/70">
                            {manualSnapshots.slice(0, 4).map((snapshot) => (
                              <div key={snapshot.id} className="border-b border-cyan-400/10 py-2 last:border-b-0">
                                <div className="font-mono text-[11px] tracking-[0.12em] text-cyan-100">{snapshot.id}</div>
                                <div className="mt-1 text-xs text-cyan-50/58">{formatCounts(snapshot.counts)}</div>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => loadRestorePreview(selectedSnapshotId)}
                            disabled={!selectedSnapshotId || isWorking}
                            className="rounded-md border border-cyan-300/36 bg-cyan-400/[0.1] px-4 py-2 text-xs font-mono tracking-[0.16em] text-cyan-100 transition-colors hover:border-cyan-200/65 hover:bg-cyan-400/[0.16] disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            RESTORE PREVIEW
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-cyan-50/65">No manual backup snapshots yet.</p>
                      )}
                    </section>
                  </div>

                  {preview ? (
                    <section className="mt-4 rounded-md border border-red-400/24 bg-red-500/[0.045] p-4">
                      <div className="text-[10px] cyber-label tracking-[0.22em] text-red-200/70">RESTORE PREVIEW</div>
                      <div className="mt-3 grid gap-3 text-sm leading-6 text-red-50/72 md:grid-cols-2">
                        <div>
                          <div className="font-mono text-[11px] tracking-[0.16em] text-red-100/80">CURRENT</div>
                          <p className="mt-1">{formatCounts(preview.current.counts)}</p>
                        </div>
                        <div>
                          <div className="font-mono text-[11px] tracking-[0.16em] text-red-100/80">WILL RESTORE</div>
                          <p className="mt-1">{formatCounts(preview.restore.counts)}</p>
                        </div>
                      </div>
                      {preview.restore.objectProblems.length > 0 || preview.restore.missingFiles.length > 0 ? (
                        <p className="mt-3 rounded-md border border-red-300/30 bg-red-500/[0.1] px-3 py-2 text-sm text-red-100/82">
                          This snapshot is incomplete or corrupted and cannot be restored.
                        </p>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-red-50/70">
                          Restore will replace current listening and video training records. A safety snapshot is created first.
                        </p>
                      )}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={restoreSelectedSnapshot}
                          disabled={!preview.canRestore || isWorking}
                          className="rounded-md border border-red-300/45 bg-red-500/[0.14] px-4 py-2 text-xs font-mono tracking-[0.16em] text-red-100 transition-colors hover:border-red-200/70 hover:bg-red-500/[0.22] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          CONFIRM RESTORE
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {message ? (
                    <p className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-400/[0.08] px-3 py-2 text-sm leading-6 text-emerald-100/80">
                      {message}
                    </p>
                  ) : null}

                  {error ? (
                    <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-sm leading-6 text-red-100/80">
                      {error}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
