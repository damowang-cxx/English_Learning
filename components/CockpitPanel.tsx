'use client'

import Link from 'next/link'
import { ArrowLeft, Home, Keyboard, Languages, MoonStar, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import TopActionNav from '@/components/TopActionNav'
import { useCockpitUi } from '@/contexts/CockpitUiContext'
import { useDictationMode } from '@/contexts/DictationModeContext'
import { useFocusMode } from '@/contexts/FocusModeContext'
import { useTranslation } from '@/contexts/TranslationContext'
import { stripBasePath, withBasePath } from '@/lib/base-path'

interface TrainingItem {
  id: string
  title: string
  createdAt: string
  sentences?: Array<{ id: string }>
  captionsCount?: number
  tag?: string
}

type DockTone = 'cyan' | 'green' | 'amber' | 'slate'

const DOCK_TONE_CLASS: Record<DockTone, { shell: string; label: string }> = {
  cyan: {
    shell: 'border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-200 hover:border-cyan-300/60 hover:text-cyan-100',
    label: 'text-cyan-300/78',
  },
  green: {
    shell: 'border-green-500/30 bg-green-500/[0.08] text-green-200 hover:border-green-300/60 hover:text-green-100',
    label: 'text-green-300/78',
  },
  amber: {
    shell: 'border-amber-400/30 bg-amber-500/[0.08] text-amber-100 hover:border-amber-300/60 hover:text-amber-50',
    label: 'text-amber-200/80',
  },
  slate: {
    shell: 'border-slate-400/30 bg-slate-300/[0.08] text-slate-100 hover:border-slate-200/60 hover:text-slate-50',
    label: 'text-slate-200/80',
  },
}

function DockButton({
  label,
  title,
  icon,
  onClick,
  active = false,
  disabled = false,
  tone,
  layout = 'dock',
}: {
  label: string
  title: string
  icon: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tone: DockTone
  layout?: 'dock' | 'corner'
}) {
  const toneClass = DOCK_TONE_CLASS[tone]
  const isCornerLayout = layout === 'corner'

  if (isCornerLayout) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`training-dock-button training-dock-button-shell inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
          toneClass.shell
        } ${
          active
            ? 'is-active shadow-[0_0_18px_rgba(255,255,255,0.08)]'
            : 'shadow-[0_0_14px_rgba(0,0,0,0.18)]'
        } ${
          label === 'FOCUS' ? 'focus-mode-toggle-shell' : ''
        }`}
        aria-label={title}
      >
        <span className="sr-only">{label}</span>
        {icon}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="training-dock-button group flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`training-dock-button-shell inline-flex items-center justify-center rounded-full border text-sm transition-all duration-200 ${
          'h-12 w-12'
        } ${
          toneClass.shell
        } ${
          active
            ? 'is-active shadow-[0_0_18px_rgba(255,255,255,0.08)]'
            : 'shadow-[0_0_14px_rgba(0,0,0,0.18)]'
        } ${
          label === 'FOCUS' ? 'focus-mode-toggle-shell' : ''
        }`}
      >
        {icon}
      </span>
      <span className={`training-dock-button-label font-mono text-[10px] tracking-[0.16em] ${toneClass.label}`}>
        {label}
      </span>
    </button>
  )
}

function TrainingMenuOverlay({ isVideoDomain }: { isVideoDomain: boolean }) {
  const pathname = usePathname()
  const { isMenuOpen, closeMenu } = useCockpitUi()
  const [loadingItems, setLoadingItems] = useState(false)
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([])

  useEffect(() => {
    closeMenu()
  }, [closeMenu, pathname])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    let isCancelled = false

    const fetchTrainingItems = async () => {
      setLoadingItems(true)

      try {
        const response = await fetch(
          withBasePath(isVideoDomain ? '/api/video-training-items' : '/api/training-items'),
          { cache: 'no-store' },
        )

        if (!response.ok || isCancelled) {
          return
        }

        const data = await response.json()
        setTrainingItems(
          isVideoDomain
            ? data.map((item: TrainingItem) => ({ ...item, sentences: [] }))
            : data,
        )
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching training items:', error)
        }
      } finally {
        if (!isCancelled) {
          setLoadingItems(false)
        }
      }
    }

    void fetchTrainingItems()

    return () => {
      isCancelled = true
    }
  }, [isMenuOpen, isVideoDomain])

  if (!isMenuOpen) {
    return null
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center px-4 py-8">
      <button
        type="button"
        onClick={closeMenu}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close training menu"
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-cyan-500/35 bg-black/95 shadow-[0_0_36px_rgba(34,211,238,0.2)]">
        <div className="flex items-center justify-between border-b border-cyan-500/20 bg-cyan-950/15 px-4 py-4">
          <div>
            <div className="text-xs font-mono tracking-[0.18em] text-cyan-400/72">QUICK MENU</div>
            <h2 className="mt-1 font-mono text-lg text-cyan-100">
              {isVideoDomain ? 'VIDEO TRAINING LIST' : 'TRAINING ITEMS LIST'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            className="rounded border border-cyan-500/18 p-1 text-cyan-300/70 transition-colors hover:border-cyan-300/45 hover:text-cyan-100"
            aria-label="Close training menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loadingItems ? (
            <div className="py-10 text-center font-mono text-sm text-cyan-300/78">LOADING...</div>
          ) : trainingItems.length === 0 ? (
            <div className="rounded-lg border border-cyan-500/14 bg-cyan-950/10 px-4 py-8 text-center font-mono text-sm text-cyan-500/68">
              NO TRAINING ITEMS FOUND
            </div>
          ) : (
            <div className="space-y-2">
              {trainingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={isVideoDomain ? `/video/${item.id}` : `/training/${item.id}`}
                  onClick={closeMenu}
                  className="block rounded-lg border border-cyan-500/16 bg-black/38 px-4 py-4 transition-colors hover:border-cyan-300/36 hover:bg-cyan-950/18"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-cyan-500/72">#{index + 1}</span>
                        <span className="truncate font-mono text-sm text-cyan-100">{item.title}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-cyan-300/60">
                        <span>
                          {isVideoDomain
                            ? `CAPTIONS ${item.captionsCount || 0}`
                            : `SENTENCES ${item.sentences?.length || 0}`}
                        </span>
                        {isVideoDomain && item.tag ? <span>{item.tag}</span> : null}
                        <span>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                    <span className="rounded border border-cyan-500/16 px-2 py-1 font-mono text-[10px] text-cyan-300/72">
                      OPEN
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CockpitPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const appPathname = stripBasePath(pathname || '/')
  const translationContext = useTranslation()
  const { isDictationMode, toggleDictationMode, setIsDictationMode } = useDictationMode()
  const { isFocusMode, toggleFocusMode, setIsFocusMode } = useFocusMode()

  const isHomePage = appPathname === '/' || appPathname === '/video'
  const isAdminUsersPage = appPathname === '/admin/users'
  const isVideoDomain = appPathname === '/video' || appPathname.startsWith('/video/')
  const isListeningTrainingPage = /^\/training\/[^/]+$/.test(appPathname)
  const isVideoTrainingPage = /^\/video\/[^/]+$/.test(appPathname) && appPathname !== '/video/upload'
  const showTrainingDock = isListeningTrainingPage || isVideoTrainingPage
  const useTrainingCornerNav = showTrainingDock
  const isTranslationToggleDisabled = isListeningTrainingPage && isDictationMode

  useEffect(() => {
    if (!isListeningTrainingPage && isDictationMode) {
      setIsDictationMode(false)
    }
  }, [isDictationMode, isListeningTrainingPage, setIsDictationMode])

  useEffect(() => {
    if (!isListeningTrainingPage && isFocusMode) {
      setIsFocusMode(false)
    }
  }, [isFocusMode, isListeningTrainingPage, setIsFocusMode])

  const dockButtons = useMemo(() => {
    if (isListeningTrainingPage) {
      return [
        {
          key: 'translations',
          label: 'TRANSL',
          title: 'Toggle translations',
          tone: 'green' as const,
          active: Boolean(translationContext?.showTranslations) && !isTranslationToggleDisabled,
          disabled: isTranslationToggleDisabled,
          icon: <Languages size={18} />,
          onClick: () => {
            if (!isTranslationToggleDisabled) {
              translationContext.toggleTranslations()
            }
          },
        },
        {
          key: 'dictation',
          label: 'DICT',
          title: 'Toggle dictation mode',
          tone: 'amber' as const,
          active: isDictationMode,
          icon: <Keyboard size={18} />,
          onClick: () => toggleDictationMode(),
        },
        {
          key: 'focus',
          label: 'FOCUS',
          title: 'Toggle focus mode',
          tone: 'slate' as const,
          active: isFocusMode,
          icon: <MoonStar size={18} />,
          onClick: () => toggleFocusMode(),
        },
        {
          key: 'home',
          label: 'HOME',
          title: 'Back to home',
          tone: 'cyan' as const,
          icon: <Home size={18} />,
          onClick: () => router.push('/'),
        },
      ]
    }

    if (isVideoTrainingPage) {
      return [
        {
          key: 'home',
          label: 'HOME',
          title: 'Back to video home',
          tone: 'cyan' as const,
          icon: <Home size={18} />,
          onClick: () => router.push('/video'),
        },
      ]
    }

    return []
  }, [
    isDictationMode,
    isFocusMode,
    isListeningTrainingPage,
    isTranslationToggleDisabled,
    isVideoTrainingPage,
    router,
    toggleDictationMode,
    toggleFocusMode,
    translationContext,
  ])

  return (
    <div className="cockpit-panel pointer-events-none fixed inset-0 z-30">
      {!isHomePage && !useTrainingCornerNav ? (
        isAdminUsersPage ? (
          <div className="pointer-events-auto fixed right-4 top-4 z-[90] flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back()
                  return
                }

                router.push('/')
              }}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-500/28 bg-black/25 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-cyan-300/72 transition-colors hover:border-cyan-400/48 hover:text-cyan-100"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft size={14} />
              BACK
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-cyan-500/28 bg-black/25 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-cyan-300/72 transition-colors hover:border-cyan-400/48 hover:text-cyan-100"
            >
              <Home size={14} />
              HOME
            </Link>
          </div>
        ) : (
          <div
            className="pointer-events-auto fixed right-4 top-4 z-[90]"
          >
            <TopActionNav />
          </div>
        )
      ) : null}

      <TrainingMenuOverlay isVideoDomain={isVideoDomain} />

      {useTrainingCornerNav ? (
        <div className="pointer-events-auto fixed right-4 bottom-5 z-[90] flex flex-col items-end gap-2.5">
          <TopActionNav orientation="vertical" accountMenuPlacement="top" />

          {dockButtons.length > 0 ? (
            <div className="flex flex-col items-end gap-2.5">
              {dockButtons.map((button) => (
                <DockButton
                  key={button.key}
                  label={button.label}
                  title={button.title}
                  tone={button.tone}
                  active={button.active}
                  disabled={button.disabled}
                  icon={button.icon}
                  onClick={button.onClick}
                  layout="corner"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!useTrainingCornerNav && showTrainingDock && dockButtons.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-cyan-500/18 bg-black/72 px-4 py-2.5 shadow-[0_0_28px_rgba(0,0,0,0.24)] backdrop-blur-md">
            {dockButtons.map((button) => (
              <DockButton
                key={button.key}
                label={button.label}
                title={button.title}
                tone={button.tone}
                active={button.active}
                disabled={button.disabled}
                icon={button.icon}
                onClick={button.onClick}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
