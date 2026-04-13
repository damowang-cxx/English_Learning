'use client'

import type { Session } from 'next-auth'
import { User as UserIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import UserAccountScreen from '@/components/UserAccountScreen'

type SessionUser = Session['user']

type UserAccountMenuPanelPlacement = 'bottom' | 'top'
type UserAccountMenuPanelVariant = 'menu' | 'watch'

interface UserAccountMenuProps {
  sessionUser: SessionUser
  buttonClassName?: string
  panelPlacement?: UserAccountMenuPanelPlacement
  iconOnly?: boolean
  panelVariant?: UserAccountMenuPanelVariant
}

export default function UserAccountMenu({
  sessionUser,
  buttonClassName = '',
  panelPlacement = 'bottom',
  iconOnly = false,
  panelVariant = 'menu',
}: UserAccountMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const isWatchPanel = panelVariant === 'watch'
  const isPanelMounted = isWatchPanel ? (isOpen || isClosing) : isOpen
  const isButtonActive = isOpen || (isWatchPanel && isClosing)
  const panelClassName = isWatchPanel
    ? panelPlacement === 'top'
      ? 'absolute right-0 bottom-[calc(100%+1rem)] z-[120] w-[min(92vw,560px)] origin-bottom-right'
      : 'absolute right-0 top-[calc(100%+1rem)] z-[120] w-[min(92vw,560px)] origin-top-right'
    : panelPlacement === 'top'
      ? 'absolute right-0 bottom-full z-[120] mb-3 w-[min(92vw,380px)]'
      : 'absolute right-0 top-full z-[120] mt-3 w-[min(92vw,380px)]'

  const closePanel = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (!isWatchPanel) {
      setIsOpen(false)
      return
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
  }, [isClosing, isOpen, isWatchPanel])

  const openPanel = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (isWatchPanel) {
      setIsClosing(false)
    }

    setIsOpen(true)
  }, [isWatchPanel])

  useEffect(() => {
    if (!isPanelMounted) {
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
  }, [closePanel, isPanelMounted])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closePanel()
            return
          }

          openPanel()
        }}
        className={`inline-flex items-center justify-center gap-2 border font-mono text-[11px] tracking-[0.18em] transition-colors ${
          iconOnly ? 'h-11 w-11 rounded-full p-0' : 'rounded-md px-3 py-2'
        } ${
          isButtonActive
            ? 'border-cyan-300/55 bg-cyan-500/[0.12] text-cyan-100'
            : 'border-cyan-500/28 bg-black/25 text-cyan-300/72 hover:border-cyan-400/48 hover:text-cyan-100'
        } ${buttonClassName}`.trim()}
        aria-label="Open user account"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={iconOnly ? 'User account' : undefined}
      >
        <UserIcon size={iconOnly ? 18 : 14} />
        {iconOnly ? <span className="sr-only">USER</span> : 'USER'}
      </button>

      {isPanelMounted ? (
        <div className={isWatchPanel ? `home-user-command-panel ${panelClassName} ${isClosing ? 'is-closing' : 'is-open'}` : panelClassName}>
          {isWatchPanel ? (
            <>
              <span className="home-user-command-panel__backplate" aria-hidden="true" />
              <span className="home-user-command-panel__tether" aria-hidden="true" />
            </>
          ) : null}
          <UserAccountScreen
            sessionUser={sessionUser}
            variant={panelVariant}
            onClose={closePanel}
          />
        </div>
      ) : null}
    </div>
  )
}
