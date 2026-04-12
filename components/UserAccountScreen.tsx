'use client'

import type { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import { Camera, LogOut, X } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
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
type ScreenVariant = 'menu' | 'watch'

interface AccountPayload {
  id: string
  email: string
  name: string | null
  role: string
  avatarUrl: string | null
}

type HeatmapDay = LearningStatsOverview['heatmapDays'][number]

interface UserAccountScreenProps {
  sessionUser: SessionUser
  variant?: ScreenVariant
  onClose: () => void
}

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
    <div className="user-account-screen__stat-tile rounded-lg border px-3 py-2.5">
      <div className="text-[10px] font-mono tracking-[0.18em] text-cyan-400/70">{label}</div>
      <div className="mt-1 font-mono text-sm text-cyan-100">{value}</div>
    </div>
  )
}

export default function UserAccountScreen({
  sessionUser,
  variant = 'menu',
  onClose,
}: UserAccountScreenProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
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
  }, [])

  const handleSignOut = async () => {
    const result = await signOut({
      redirect: false,
      callbackUrl: withBasePath('/'),
    })

    onClose()
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

  const panelLabel = variant === 'watch' ? 'PROFILE ACCESS' : 'USER CARD'
  const panelSubtitle = variant === 'watch' ? 'BOTTOM HUD // LINKED' : null

  return (
    <>
      <div
        className={`user-account-screen ${
          variant === 'watch' ? 'user-account-screen--watch' : 'user-account-screen--menu'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
      >
        <div className="user-account-screen__decor" aria-hidden="true">
          <span className="user-account-screen__line user-account-screen__line--top" />
          <span className="user-account-screen__line user-account-screen__line--right" />
          <span className="user-account-screen__corner user-account-screen__corner--tl" />
          <span className="user-account-screen__corner user-account-screen__corner--br" />
          {variant === 'watch' ? (
            <>
              <span className="user-account-screen__watch-beam" />
              <span className="user-account-screen__watch-grid" />
            </>
          ) : null}
        </div>

        <div className="user-account-screen__header flex items-center justify-between px-4 py-3">
          <div className="user-account-screen__title-stack">
            <div className="text-xs font-mono tracking-[0.2em] text-cyan-300/78">{panelLabel}</div>
            {panelSubtitle ? (
              <div className="mt-1 text-[10px] font-mono tracking-[0.18em] text-fuchsia-300/55">{panelSubtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="user-account-screen__close rounded border p-1 text-cyan-300/70 transition-colors hover:text-cyan-100"
            aria-label="Close user card"
          >
            <X size={14} />
          </button>
        </div>

        <div className="user-account-screen__body space-y-4 px-4 py-4">
          <div className="user-account-screen__hero flex items-start gap-4">
            <div className="user-account-screen__avatar-shell relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border bg-cyan-950/25">
              {avatarSrc ? (
                <Image src={avatarSrc} alt={displayName} fill sizes="72px" className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_70%)] font-mono text-lg text-cyan-100">
                  {getInitials(displayName)}
                </div>
              )}
            </div>

            <div className="user-account-screen__identity min-w-0 flex-1">
              <div className="truncate font-mono text-sm text-cyan-100">{displayName}</div>
              <div className="mt-1 truncate text-xs text-cyan-300/70">{account?.email || sessionUser.email || 'No email'}</div>
              <div className="user-account-screen__role-chip mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-mono tracking-[0.16em] text-cyan-200/80">
                {account?.role || 'USER'}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isSavingAvatar}
                  className="user-account-screen__action user-account-screen__action--primary inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-mono tracking-[0.14em] transition-colors disabled:opacity-45"
                >
                  <Camera size={12} />
                  {avatarSrc ? 'CHANGE' : 'UPLOAD'}
                </button>
                {avatarSrc ? (
                  <button
                    type="button"
                    onClick={(event) => void handleRemoveAvatar(event)}
                    disabled={isSavingAvatar}
                    className="user-account-screen__action user-account-screen__action--danger rounded-md border px-2.5 py-1.5 text-[10px] font-mono tracking-[0.14em] transition-colors disabled:opacity-45"
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
            <div className="user-account-screen__status rounded-lg border px-3 py-2 text-xs text-cyan-100/80">
              {statusMessage}
            </div>
          ) : null}

          <div className="user-account-screen__stats-grid grid grid-cols-3 gap-2">
            <StatTile label="TODAY" value={formatDurationToClock(overview.todayStudySeconds)} />
            <StatTile label="STREAK" value={`${overview.currentStreakDays}D`} />
            <StatTile label="YEAR" value={`${overview.yearCheckInDays}D`} />
          </div>

          <div className="user-account-screen__heatmap rounded-xl border p-3">
            <div className="user-account-screen__section-head mb-3 flex items-center justify-between">
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
            className="user-account-screen__logout flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-mono tracking-[0.18em] transition-colors"
          >
            <LogOut size={14} />
            LOGOUT
          </button>
        </div>
      </div>

      <ImageCropModal
        isOpen={Boolean(cropSourceFile)}
        file={cropSourceFile}
        preset="avatar"
        title="Crop avatar"
        description="Adjust the square avatar before saving it to your account."
        onCancel={() => setCropSourceFile(null)}
        onConfirm={(file) => handleAvatarConfirm(file)}
      />
    </>
  )
}
