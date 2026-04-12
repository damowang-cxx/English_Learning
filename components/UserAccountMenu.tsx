'use client'

import type { Session } from 'next-auth'
import { User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import UserAccountScreen from '@/components/UserAccountScreen'

type SessionUser = Session['user']

type UserAccountMenuPanelPlacement = 'bottom' | 'top'

interface UserAccountMenuProps {
  sessionUser: SessionUser
  buttonClassName?: string
  panelPlacement?: UserAccountMenuPanelPlacement
  iconOnly?: boolean
}

export default function UserAccountMenu({
  sessionUser,
  buttonClassName = '',
  panelPlacement = 'bottom',
  iconOnly = false,
}: UserAccountMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const panelClassName =
    panelPlacement === 'top'
      ? 'absolute right-0 bottom-full z-[120] mb-3 w-[min(92vw,380px)]'
      : 'absolute right-0 top-full z-[120] mt-3 w-[min(92vw,380px)]'

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex items-center justify-center gap-2 border font-mono text-[11px] tracking-[0.18em] transition-colors ${
          iconOnly ? 'h-11 w-11 rounded-full p-0' : 'rounded-md px-3 py-2'
        } ${
          isOpen
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

      {isOpen ? (
        <div className={panelClassName}>
          <UserAccountScreen sessionUser={sessionUser} onClose={() => setIsOpen(false)} />
        </div>
      ) : null}
    </div>
  )
}
