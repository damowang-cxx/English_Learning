'use client'

import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import UserAccountScreen from '@/components/UserAccountScreen'
import { withBasePath } from '@/lib/base-path'
import { FUTURE_TECH_FONT_CLASSNAME } from '@/lib/training-fonts'

type HomeUserWatchPlacement = 'bottom' | 'top-bridge' | 'bottom-keel'

interface HomeUserWatchProps {
  placement?: HomeUserWatchPlacement
}

function getDockDisplayName(name: string | null | undefined, email: string | null | undefined) {
  const trimmedName = name?.trim()
  if (trimmedName) {
    return trimmedName
  }

  const emailPrefix = email?.split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return 'USER'
}

function getDockGlyph(name: string | null | undefined, email: string | null | undefined) {
  const normalizedName = (name || '').replace(/\s+/g, '')
  const nameGlyph = Array.from(normalizedName).slice(0, 2).join('')
  if (nameGlyph) {
    return nameGlyph.toUpperCase()
  }

  const emailPrefix = (email?.split('@')[0] || '').replace(/\s+/g, '')
  const emailGlyph = Array.from(emailPrefix).slice(0, 2).join('')
  if (emailGlyph) {
    return emailGlyph.toUpperCase()
  }

  return 'U'
}

export default function HomeUserWatch({ placement = 'bottom' }: HomeUserWatchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [accountAvatarUrl, setAccountAvatarUrl] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(0)

  const closePanel = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (!isOpen && !isClosing) {
      return
    }

    setIsOpen(false)
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false)
      closeTimerRef.current = null
    }, 430)
  }, [isClosing, isOpen])

  const openPanel = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    setIsClosing(false)
    setIsOpen(true)
  }, [])

  useEffect(() => {
    if (!isOpen && !isClosing) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePanel()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePanel, isOpen, isClosing])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      return
    }

    let isCancelled = false

    const loadAccountAvatar = async () => {
      try {
        const response = await fetch(withBasePath('/api/account/me'), { cache: 'no-store' })
        if (!response.ok || isCancelled) {
          return
        }

        const account = await response.json()
        if (!isCancelled) {
          setAccountAvatarUrl(account?.avatarUrl || null)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load home watch avatar:', error)
        }
      }
    }

    void loadAccountAvatar()

    return () => {
      isCancelled = true
    }
  }, [session?.user?.id])

  const sessionUser = session?.user
  const dockDisplayName = useMemo(
    () => getDockDisplayName(sessionUser?.name ?? null, sessionUser?.email ?? null),
    [sessionUser?.email, sessionUser?.name],
  )
  const dockGlyph = useMemo(
    () => getDockGlyph(sessionUser?.name ?? null, sessionUser?.email ?? null),
    [sessionUser?.email, sessionUser?.name],
  )
  const dockAvatarSrc = useMemo(() => {
    const avatarUrl = accountAvatarUrl || sessionUser?.image?.trim() || null
    if (!avatarUrl) {
      return null
    }

    const src = withBasePath(avatarUrl)
    return accountAvatarUrl && avatarVersion > 0 ? `${src}?v=${avatarVersion}` : src
  }, [accountAvatarUrl, avatarVersion, sessionUser?.image])
  const dockStatus = isOpen ? 'CONSOLE ACTIVE' : 'LINK READY'
  const isDockActive = isOpen || isClosing
  const isPanelMounted = isOpen || isClosing
  const isTopBridgePlacement = placement === 'top-bridge'
  const isBottomKeelPlacement = placement === 'bottom-keel'
  const shouldHideBottomKeelDock = isBottomKeelPlacement && isPanelMounted
  const shouldRenderDock = !shouldHideBottomKeelDock
  let containerClassName =
    'home-user-command-anchor pointer-events-none fixed bottom-3 right-4 z-[96] md:bottom-4 md:right-6'
  let dockWrapClassName = 'pointer-events-auto relative flex items-end justify-end'
  let panelPlacementClassName =
    'absolute bottom-[calc(100%+1rem)] right-0 w-[min(92vw,560px)] origin-bottom-right'

  if (isTopBridgePlacement) {
    containerClassName =
      'home-user-command-anchor home-user-command-anchor--top-bridge pointer-events-none fixed right-2 top-2 z-[96] md:right-5 md:top-3'
    dockWrapClassName = 'pointer-events-auto relative flex items-start justify-end'
    panelPlacementClassName =
      'home-user-command-panel--top-bridge absolute right-0 top-[calc(100%+0.68rem)] w-[min(92vw,520px)] origin-top-right'
  } else if (isBottomKeelPlacement) {
    containerClassName =
      'home-user-command-anchor home-user-command-anchor--bottom-keel pointer-events-none fixed bottom-0 left-1/2 z-[96]'
    dockWrapClassName = 'pointer-events-auto relative flex items-end justify-center'
    panelPlacementClassName =
      'home-user-command-panel--bottom-keel absolute bottom-[calc(100%+0.78rem)] w-[min(92vw,520px)] origin-bottom'
  }

  const panelClassName = `home-user-command-panel ${panelPlacementClassName} ${
    isClosing ? 'is-closing' : 'is-open'
  }`

  if (status === 'loading' || !sessionUser?.id) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`${containerClassName}${shouldHideBottomKeelDock ? ' is-panel-mounted' : ''}`}
    >
      <div className={dockWrapClassName}>
        {isPanelMounted ? (
          <div className={panelClassName}>
            <span className="home-user-command-panel__backplate" aria-hidden="true" />
            <span className="home-user-command-panel__tether" aria-hidden="true" />
            <UserAccountScreen
              sessionUser={sessionUser}
              variant="watch"
              onClose={closePanel}
              onAvatarChange={(avatarUrl) => {
                setAccountAvatarUrl(avatarUrl)
                setAvatarVersion(Date.now())
              }}
            />
          </div>
        ) : null}

        {shouldRenderDock ? (
          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                closePanel()
                return
              }

              openPanel()
            }}
            className={`${FUTURE_TECH_FONT_CLASSNAME} home-user-command-dock ${
              isDockActive ? 'is-active' : ''
            } ${isClosing ? 'is-closing' : ''} ${
              isBottomKeelPlacement ? 'home-user-command-dock--bottom-keel' : ''
            }`}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label="Open personal profile console"
          >
            <span className="home-user-command-dock__halo" aria-hidden="true" />
            <span className="home-user-command-dock__frame" aria-hidden="true" />
            <span className="home-user-command-dock__slab" aria-hidden="true">
              <span className="home-user-command-dock__content">
                <span className="home-user-command-dock__name">{dockDisplayName}</span>
                <span className="home-user-command-dock__status-group">
                  <span className="home-energy-battery home-energy-battery--dock" aria-hidden="true">
                    <span className="home-energy-battery__segment" />
                    <span className="home-energy-battery__segment" />
                    <span className="home-energy-battery__segment" />
                    <span className="home-energy-battery__segment" />
                  </span>
                  <span className="home-user-command-dock__status-text">{dockStatus}</span>
                </span>
              </span>
              <span className="home-user-command-dock__avatar-shell">
                {dockAvatarSrc ? (
                  <Image
                    src={dockAvatarSrc}
                    alt={dockDisplayName}
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="home-user-command-dock__avatar-fallback">{dockGlyph}</span>
                )}
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
