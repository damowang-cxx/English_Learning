'use client'

import type { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import { Camera, LogOut, User as UserIcon, X } from 'lucide-react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import ImageCropModal from '@/components/video/ImageCropModal'
import { HOME_HEATMAP_DAYS, formatDurationToClock, type LearningStatsOverview } from '@/lib/learning-stats'
import { normalizeAppRouterPath, withBasePath } from '@/lib/base-path'

type SessionUser = Session['user']

interface AccountPayload {
  id: string
  email: string
  name: string | null
  role: string
  avatarUrl: string | null
}

type HeatmapDay = LearningStatsOverview['heatmapDays'][number]

const DEFAULT_OVERVIEW: LearningStatsOverview = {
  todayStudySeconds: 0,
  currentStreakDays: 0,
  yearCheckInDays: 0,
  streakThresholdSeconds: 20 * 60,
  heatmapDays: [],
}

const HEATMAP_LEVEL_CLASS: Record<number, string> = {
  0: 'border-cyan-950/60 bg-slate-950/70',
  1: 'border-cyan-900/80 bg-cyan-900/45',
  2: 'border-cyan-700/70 bg-cyan-700/50',
  3: 'border-cyan-400/80 bg-cyan-400/70',
  4: 'border-cyan-100/85 bg-cyan-100/90',
}

function buildHeatmapColumns(days: LearningStatsOverview['heatmapDays']) {
  const columns: HeatmapDay[][] = []

  for (let index = 0; index < days.length; index += 7) {
    columns.push(days.slice(index, index + 7))
  }

  return columns
}

function getDisplayName(sessionUser: SessionUser, account: AccountPayload | null) {
  const name = account?.name?.trim() || sessionUser.name?.trim()
  if (name) {
    return name
  }

  if (account?.email) {
    return account.email.split('@')[0]
  }

  return sessionUser.email?.split('@')[0] || 'USER'
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'U'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-black/35 px-3 py-2.5">
      <div className="text-[10px] font-mono tracking-[0.18em] text-cyan-400/70">{label}</div>
      <div className="mt-1 font-mono text-sm text-cyan-100">{value}</div>
    </div>
  )
}

export default function UserAccountMenu({ sessionUser }: { sessionUser: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [account, setAccount] = useState<AccountPayload | null>(null)
  const [overview, setOverview] = useState<LearningStatsOverview>(DEFAULT_OVERVIEW)
  const [hasLoadedOverview, setHasLoadedOverview] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(0)

  const displayName = useMemo(() => getDisplayName(sessionUser, account), [account, sessionUser])
  const avatarSrc = useMemo(() => {
    const avatarUrl = account?.avatarUrl
    if (!avatarUrl) {
      return null
    }

    const src = withBasePath(avatarUrl)
    return avatarVersion > 0 ? `${src}?v=${avatarVersion}` : src
  }, [account?.avatarUrl, avatarVersion])
  const heatmapColumns = useMemo(() => buildHeatmapColumns(overview.heatmapDays), [overview.heatmapDays])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || (account && hasLoadedOverview)) {
      return
    }

    let isCancelled = false

    const loadCardData = async () => {
      setIsLoading(true)

      try {
        const [accountResponse, overviewResponse] = await Promise.all([
          fetch(withBasePath('/api/account/me'), { cache: 'no-store' }),
          fetch(withBasePath(`/api/learning-stats/overview?days=${HOME_HEATMAP_DAYS}`), { cache: 'no-store' }),
        ])

        if (!isCancelled && accountResponse.ok) {
          setAccount(await accountResponse.json())
        }

        if (!isCancelled && overviewResponse.ok) {
          setOverview(await overviewResponse.json())
          setHasLoadedOverview(true)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load user account card data:', error)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadCardData()

    return () => {
      isCancelled = true
    }
  }, [account, hasLoadedOverview, isOpen])

  const handleSignOut = async () => {
    const result = await signOut({
      redirect: false,
      callbackUrl: withBasePath('/'),
    })

    setIsOpen(false)
    router.replace(normalizeAppRouterPath(result?.url, '/'))
    router.refresh()
  }

  const submitAvatarForm = async (formData: FormData) => {
    setIsSavingAvatar(true)
    setStatusMessage(null)

    try {
      const response = await fetch(withBasePath('/api/account/me'), {
        method: 'PATCH',
        body: formData,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || `Avatar update failed: ${response.status}`)
      }

      setAccount(data)
      setAvatarVersion(Date.now())
      setStatusMessage(data?.avatarUrl ? 'Avatar updated.' : 'Avatar removed.')
      router.refresh()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Avatar update failed.')
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleAvatarPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    event.target.value = ''

    if (!file) {
      return
    }

    setCropSourceFile(file)
  }

  const handleAvatarConfirm = async (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    await submitAvatarForm(formData)
    setCropSourceFile(null)
  }

  const handleRemoveAvatar = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const formData = new FormData()
    formData.append('removeAvatar', 'true')
    await submitAvatarForm(formData)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors ${
          isOpen
            ? 'border-cyan-300/55 bg-cyan-500/[0.12] text-cyan-100'
            : 'border-cyan-500/28 bg-black/25 text-cyan-300/72 hover:border-cyan-400/48 hover:text-cyan-100'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <UserIcon size={14} />
        USER
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-[120] mt-3 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-cyan-500/35 bg-black/92 shadow-[0_0_36px_rgba(34,211,238,0.18)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
            <div className="text-xs font-mono tracking-[0.2em] text-cyan-300/78">USER CARD</div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-cyan-500/18 p-1 text-cyan-300/70 transition-colors hover:border-cyan-300/45 hover:text-cyan-100"
              aria-label="Close user card"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="flex items-start gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-cyan-500/25 bg-cyan-950/25">
                {avatarSrc ? (
                  <Image src={avatarSrc} alt={displayName} fill sizes="72px" className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_70%)] font-mono text-lg text-cyan-100">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm text-cyan-100">{displayName}</div>
                <div className="mt-1 truncate text-xs text-cyan-300/70">
                  {account?.email || sessionUser.email || 'No email'}
                </div>
                <div className="mt-2 inline-flex rounded-full border border-cyan-500/18 bg-cyan-500/[0.06] px-2.5 py-1 text-[10px] font-mono tracking-[0.16em] text-cyan-200/80">
                  {account?.role || 'USER'}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isSavingAvatar}
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-500/24 bg-black/30 px-2.5 py-1.5 text-[10px] font-mono tracking-[0.14em] text-cyan-300/75 transition-colors hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-45"
                  >
                    <Camera size={12} />
                    {avatarSrc ? 'CHANGE' : 'UPLOAD'}
                  </button>
                  {avatarSrc ? (
                    <button
                      type="button"
                      onClick={(event) => void handleRemoveAvatar(event)}
                      disabled={isSavingAvatar}
                      className="rounded-md border border-red-500/24 bg-black/30 px-2.5 py-1.5 text-[10px] font-mono tracking-[0.14em] text-red-300/75 transition-colors hover:border-red-400/55 hover:text-red-100 disabled:opacity-45"
                    >
                      REMOVE
                    </button>
                  ) : null}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </div>
            </div>

            {statusMessage ? (
              <div className="rounded-lg border border-cyan-500/18 bg-cyan-500/[0.05] px-3 py-2 text-xs text-cyan-100/80">
                {statusMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <StatTile label="TODAY" value={formatDurationToClock(overview.todayStudySeconds)} />
              <StatTile label="STREAK" value={`${overview.currentStreakDays}D`} />
              <StatTile label="YEAR" value={`${overview.yearCheckInDays}D`} />
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-mono tracking-[0.2em] text-cyan-400/72">HEATMAP</div>
                <div className="text-[10px] font-mono text-cyan-500/70">
                  {isLoading && !hasLoadedOverview ? 'LOADING...' : `${HOME_HEATMAP_DAYS / 7}W`}
                </div>
              </div>

              {heatmapColumns.length === 0 ? (
                <div className="rounded-lg border border-cyan-500/12 bg-cyan-950/10 px-3 py-4 text-center text-[11px] font-mono text-cyan-500/65">
                  NO STUDY DATA YET
                </div>
              ) : (
                <div className="grid grid-flow-col auto-cols-max gap-1">
                  {heatmapColumns.map((column, columnIndex) => (
                    <div key={`heatmap-column-${columnIndex}`} className="grid gap-1">
                      {column.map((day) => (
                        <div
                          key={day.dateKey}
                          title={`${day.dateKey}  ${formatDurationToClock(day.seconds)}`}
                          className={`h-3 w-3 rounded-[3px] border ${HEATMAP_LEVEL_CLASS[day.level] || HEATMAP_LEVEL_CLASS[0]}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-xs font-mono tracking-[0.18em] text-red-200 transition-colors hover:border-red-400/55 hover:bg-red-500/[0.12]"
            >
              <LogOut size={14} />
              LOGOUT
            </button>
          </div>
        </div>
      ) : null}

      <ImageCropModal
        isOpen={Boolean(cropSourceFile)}
        file={cropSourceFile}
        preset="avatar"
        title="Crop avatar"
        description="Adjust the square avatar before saving it to your account."
        onCancel={() => setCropSourceFile(null)}
        onConfirm={(file) => handleAvatarConfirm(file)}
      />
    </div>
  )
}
