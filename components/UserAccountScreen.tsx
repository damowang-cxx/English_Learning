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
import { FUTURE_TECH_FONT_CLASSNAME } from '@/lib/training-fonts'

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
  onAvatarChange?: (avatarUrl: string | null) => void
}

const DEFAULT_OVERVIEW: LearningStatsOverview = {
  todayStudySeconds: 0,
  currentStreakDays: 0,
  yearCheckInDays: 0,
  streakThresholdSeconds: 20 * 60,
  heatmapDays: [],
}

const MENU_HEATMAP_LEVEL_CLASS: Record<number, string> = {
  0: 'border-cyan-950/85 bg-slate-950/95',
  1: 'border-cyan-700/85 bg-cyan-900/85',
  2: 'border-sky-500/85 bg-sky-600/80',
  3: 'border-cyan-300/90 bg-cyan-400/85',
  4: 'border-cyan-50/95 bg-cyan-200/95',
}

const WATCH_HEATMAP_LEVEL_CLASS: Record<number, string> = {
  0: 'border-fuchsia-950/85 bg-slate-950/95',
  1: 'border-violet-700/85 bg-violet-950/85',
  2: 'border-purple-500/85 bg-purple-600/80',
  3: 'border-fuchsia-400/90 bg-fuchsia-500/85',
  4: 'border-pink-100/95 bg-fuchsia-200/95',
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
  const normalizedName = name.replace(/\s+/g, '')
  const glyph = Array.from(normalizedName).slice(0, 2).join('')
  if (glyph) {
    return glyph.toUpperCase()
  }

  const fallback = Array.from(name.trim()).slice(0, 2).join('')
  if (fallback) {
    return fallback.toUpperCase()
  }

  return 'U'
}

function BatteryIndicator({
  className = '',
  isSyncing = false,
}: {
  className?: string
  isSyncing?: boolean
}) {
  return (
    <span className={`home-energy-battery ${isSyncing ? 'is-syncing' : ''} ${className}`.trim()} aria-hidden="true">
      <span className="home-energy-battery__segment" />
      <span className="home-energy-battery__segment" />
      <span className="home-energy-battery__segment" />
      <span className="home-energy-battery__segment" />
    </span>
  )
}

function getHeaderStatusLabel(isWatch: boolean, isLoading: boolean, hasLoadedOverview: boolean) {
  if (!isWatch) {
    return null
  }

  return isLoading && !hasLoadedOverview ? 'SYNCING' : 'LINK READY'
}

function getHeaderStatusMode(isWatch: boolean, isLoading: boolean, hasLoadedOverview: boolean) {
  if (!isWatch) {
    return 'ready'
  }

  return isLoading && !hasLoadedOverview ? 'syncing' : 'ready'
}

function getDisplayNamePlaceholder(name: string) {
  if (!name.trim()) {
    return 'U'
  }

  return getInitials(name)
}

function StatTile({ label, value, variant = 'menu' }: { label: string; value: string; variant?: ScreenVariant }) {
  const isWatch = variant === 'watch'

  return (
    <div className="user-account-screen__stat-tile rounded-lg border px-3 py-3">
      <div
        className={`text-[10px] font-mono tracking-[0.18em] ${
          isWatch ? 'text-[11px] leading-[1.2] tracking-[0.14em] text-fuchsia-200/84' : 'text-cyan-400/70'
        }`}
      >
        {label}
      </div>
      <div className={`mt-2 font-mono ${isWatch ? 'text-[1.2rem] leading-[1.12] text-violet-50' : 'text-sm text-cyan-100'}`}>
        {value}
      </div>
    </div>
  )
}

export default function UserAccountScreen({
  sessionUser,
  variant = 'menu',
  onClose,
  onAvatarChange,
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
  const isWatch = variant === 'watch'
  const avatarSrc = useMemo(() => {
    const avatarUrl = account?.avatarUrl || sessionUser.image
    if (!avatarUrl) {
      return null
    }

    const src = withBasePath(avatarUrl)
    return account?.avatarUrl && avatarVersion > 0 ? `${src}?v=${avatarVersion}` : src
  }, [account?.avatarUrl, avatarVersion, sessionUser.image])
  const menuHeatmapColumns = useMemo(() => buildHeatmapColumns(overview.heatmapDays), [overview.heatmapDays])
  const heatmapLevelClass = isWatch ? WATCH_HEATMAP_LEVEL_CLASS : MENU_HEATMAP_LEVEL_CLASS
  const headerStatus = getHeaderStatusLabel(isWatch, isLoading, hasLoadedOverview)
  const headerStatusMode = getHeaderStatusMode(isWatch, isLoading, hasLoadedOverview)

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
      onAvatarChange?.(data?.avatarUrl || null)
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

  const panelLabel = isWatch ? 'ACCOUNT DOCK' : 'USER CARD'
  const panelSubtitle = null

  return (
    <>
      <div
        className={`${isWatch ? FUTURE_TECH_FONT_CLASSNAME : ''} user-account-screen ${
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
              <span className="user-account-screen__watch-projection" />
              <span className="user-account-screen__watch-noise" />
            </>
          ) : null}
        </div>

        <div className="user-account-screen__header flex items-center justify-between px-4 py-3">
          <div className="user-account-screen__title-stack">
              <div
                className={`font-mono ${isWatch ? 'text-[0.9rem] leading-[1.18] tracking-[0.14em] text-violet-100/92' : 'text-xs tracking-[0.2em] text-cyan-300/78'}`}
              >
                {panelLabel}
              </div>
            {panelSubtitle ? (
              <div className={`mt-1 text-[10px] font-mono tracking-[0.18em] ${isWatch ? 'text-fuchsia-300/82' : 'text-fuchsia-300/55'}`}>
                {panelSubtitle}
              </div>
            ) : null}
          </div>
          <div className="user-account-screen__header-actions flex items-center gap-2.5">
            {headerStatus ? (
              <div
                className={`user-account-screen__header-status inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono ${
                  isWatch ? 'text-[11px] leading-[1.15] tracking-[0.12em]' : 'text-[10px] tracking-[0.18em]'
                } ${headerStatusMode === 'syncing' ? 'is-syncing' : ''}`}
              >
                <BatteryIndicator className="home-energy-battery--status" isSyncing={headerStatusMode === 'syncing'} />
                {headerStatus}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={`user-account-screen__close rounded border p-1 transition-colors ${
                isWatch ? 'text-fuchsia-300/70 hover:text-fuchsia-100' : 'text-cyan-300/70 hover:text-cyan-100'
              }`}
              aria-label={isWatch ? 'Close account dock' : 'Close user card'}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div
          className={`user-account-screen__body ${isWatch ? 'user-account-screen__body--watch' : ''} space-y-4 px-4 py-4`}
        >
          {isWatch ? (
            <>
              <div className="user-account-screen__hero user-account-screen__hero--watch-layout flex items-start gap-4 rounded-[1.15rem] border px-4 py-4">
                <div className="user-account-screen__avatar-shell relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-full border bg-purple-950/65">
                  {avatarSrc ? (
                    <Image src={avatarSrc} alt={displayName} fill sizes="84px" className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.28),transparent_72%)] text-[1.4rem] text-violet-50">
                      {getDisplayNamePlaceholder(displayName)}
                    </div>
                  )}
                </div>

                <div className="user-account-screen__identity min-w-0 flex-1">
                  <div className="truncate font-mono text-[1.3rem] leading-[1.08] text-violet-50">{displayName}</div>
                  <div className="mt-2 truncate text-[0.9rem] leading-snug text-purple-100/88">
                    {account?.email || sessionUser.email || 'No email'}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <div className="user-account-screen__role-chip inline-flex rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] text-violet-50/90">
                      {account?.role || 'USER'}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={isSavingAvatar}
                      className="user-account-screen__action user-account-screen__action--primary inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] tracking-[0.12em] transition-colors disabled:opacity-45"
                    >
                      <Camera size={13} />
                      {avatarSrc ? 'CHANGE AVATAR' : 'UPLOAD AVATAR'}
                    </button>
                    {avatarSrc ? (
                      <button
                        type="button"
                        onClick={(event) => void handleRemoveAvatar(event)}
                        disabled={isSavingAvatar}
                        className="user-account-screen__action user-account-screen__action--danger rounded-md border px-3 py-2 text-[11px] tracking-[0.12em] transition-colors disabled:opacity-45"
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
                <div className="user-account-screen__status rounded-[1rem] border px-4 py-3 text-[0.9rem] leading-snug text-violet-50/90">
                  {statusMessage}
                </div>
              ) : null}

              <div className="user-account-screen__stats-grid grid grid-cols-3 gap-2.5">
                <StatTile label="TODAY" value={formatDurationToClock(overview.todayStudySeconds)} variant={variant} />
                <StatTile label="STREAK" value={`${overview.currentStreakDays}D`} variant={variant} />
                <StatTile label="YEAR" value={`${overview.yearCheckInDays}D`} variant={variant} />
              </div>
            </>
          ) : (
            <div className={`user-account-screen__bridge-grid ${isWatch ? 'user-account-screen__bridge-grid--watch' : ''}`}>
              <div className="user-account-screen__hero flex items-start gap-4">
                <div className="user-account-screen__avatar-shell relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border bg-cyan-950/25">
                  {avatarSrc ? (
                    <Image src={avatarSrc} alt={displayName} fill sizes="72px" className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_70%)] font-mono text-lg text-cyan-100">
                      {getDisplayNamePlaceholder(displayName)}
                    </div>
                  )}
                </div>

                <div className="user-account-screen__identity min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-cyan-100">{displayName}</div>
                  <div className="mt-1 truncate text-xs text-cyan-300/70">
                    {account?.email || sessionUser.email || 'No email'}
                  </div>
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

              <div className="user-account-screen__bridge-side">
                {statusMessage ? (
                  <div className="user-account-screen__status rounded-lg border px-3 py-2 text-xs text-cyan-100/80">
                    {statusMessage}
                  </div>
                ) : null}

                <div className="user-account-screen__stats-grid grid grid-cols-3 gap-2">
                  <StatTile label="TODAY" value={formatDurationToClock(overview.todayStudySeconds)} variant={variant} />
                  <StatTile label="STREAK" value={`${overview.currentStreakDays}D`} variant={variant} />
                  <StatTile label="YEAR" value={`${overview.yearCheckInDays}D`} variant={variant} />
                </div>
              </div>
            </div>
          )}

          <div className="user-account-screen__heatmap rounded-xl border p-3.5 md:p-4">
            <div className="user-account-screen__section-head mb-3 flex items-center justify-between">
              <div
                className={`font-mono ${isWatch ? 'text-[0.82rem] leading-[1.18] tracking-[0.12em] text-violet-100/90' : 'text-[10px] tracking-[0.2em] text-cyan-400/72'}`}
              >
                HEATMAP
              </div>
              <div className={`font-mono ${isWatch ? 'text-[0.82rem] leading-[1.18] text-fuchsia-300/84' : 'text-[10px] text-cyan-500/70'}`}>
                {isLoading && !hasLoadedOverview ? 'LOADING...' : `${HOME_HEATMAP_DAYS / 7}W`}
              </div>
            </div>

            {overview.heatmapDays.length === 0 ? (
              <div
                className={`rounded-lg border px-3 py-4 text-center text-[11px] font-mono ${
                  isWatch
                    ? 'border-fuchsia-300/26 bg-fuchsia-500/12 text-violet-100/78'
                    : 'border-cyan-500/12 bg-cyan-950/10 text-cyan-500/65'
                }`}
              >
                NO STUDY DATA YET
              </div>
            ) : isWatch ? (
              <div className="user-account-screen__heatmap-grid user-account-screen__heatmap-grid--watch">
                {overview.heatmapDays.map((day) => (
                  <div
                    key={day.dateKey}
                    title={`${day.dateKey}  ${formatDurationToClock(day.seconds)}`}
                    className={`user-account-screen__heatmap-cell rounded-[5px] border ${heatmapLevelClass[day.level] || heatmapLevelClass[0]}`}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-flow-col auto-cols-max gap-1">
                {menuHeatmapColumns.map((column, columnIndex) => (
                  <div key={`heatmap-column-${columnIndex}`} className="grid gap-1">
                    {column.map((day) => (
                      <div
                        key={day.dateKey}
                        title={`${day.dateKey}  ${formatDurationToClock(day.seconds)}`}
                        className={`h-3 w-3 rounded-[3px] border ${heatmapLevelClass[day.level] || heatmapLevelClass[0]}`}
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
            className={`user-account-screen__logout flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-mono tracking-[0.18em] transition-colors ${
              isWatch ? 'text-violet-50/84' : ''
            }`}
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
