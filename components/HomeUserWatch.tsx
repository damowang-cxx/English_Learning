'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import UserAccountScreen from '@/components/UserAccountScreen'

function getReactorLabel(name: string | null | undefined, email: string | null | undefined) {
  const value = (name || email || 'ID').trim()
  if (!value) {
    return 'ID'
  }

  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

export default function HomeUserWatch() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)

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

  const sessionUser = session?.user
  const reactorLabel = useMemo(
    () => getReactorLabel(sessionUser?.name ?? null, sessionUser?.email ?? null),
    [sessionUser?.email, sessionUser?.name],
  )
  const reactorStatus = isOpen ? 'LINKED' : 'READY'

  if (status === 'loading' || !sessionUser?.id) {
    return null
  }

  return (
    <div ref={containerRef} className="pointer-events-none fixed bottom-3 right-4 z-[96] md:bottom-4 md:right-6">
      <div className="pointer-events-auto relative flex items-end justify-end">
        {isOpen ? (
          <div className="home-user-reactor-panel absolute bottom-[calc(100%+0.9rem)] right-0 w-[min(92vw,420px)] origin-bottom-right">
            <UserAccountScreen sessionUser={sessionUser} variant="watch" onClose={() => setIsOpen(false)} />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={`home-user-reactor-trigger ${isOpen ? 'is-active' : ''}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Open personal profile console"
        >
          <span className="home-user-reactor-trigger__arm" aria-hidden="true" />
          <span className="home-user-reactor-trigger__arm-glow" aria-hidden="true" />
          <span className="home-user-reactor-trigger__brace" aria-hidden="true" />
          <span className="home-user-reactor-trigger__dock" aria-hidden="true">
            <span className="home-user-reactor-trigger__bulkhead" />
            <span className="home-user-reactor-trigger__plate home-user-reactor-trigger__plate--left" />
            <span className="home-user-reactor-trigger__plate home-user-reactor-trigger__plate--right" />
            <span className="home-user-reactor-trigger__vent home-user-reactor-trigger__vent--top" />
            <span className="home-user-reactor-trigger__vent home-user-reactor-trigger__vent--bottom" />
            <span className="home-user-reactor-trigger__microtag">
              <span className="home-user-reactor-trigger__eyebrow">PROFILE</span>
              <span className="home-user-reactor-trigger__meta">{`${reactorLabel} // ${reactorStatus}`}</span>
            </span>
            <span className="home-user-reactor-trigger__core">
              <span className="home-user-reactor-trigger__core-frame" />
              <span className="home-user-reactor-trigger__core-ring" />
              <span className="home-user-reactor-trigger__core-glow" />
              <span className="home-user-reactor-trigger__core-cell" />
            </span>
            <span className="home-user-reactor-trigger__lock">
              <span className="home-user-reactor-trigger__lock-pin" />
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
