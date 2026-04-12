'use client'

import Link from 'next/link'
import { Menu as MenuIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { isAdminRole } from '@/lib/auth-types'
import { useCockpitUi } from '@/contexts/CockpitUiContext'
import UserAccountMenu from '@/components/UserAccountMenu'

const BASE_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors'

type AccountEntryMode = 'top-nav' | 'none'
type NavOrientation = 'horizontal' | 'vertical'
type AccountMenuPlacement = 'bottom' | 'top'

interface TopActionNavProps {
  className?: string
  accountEntryMode?: AccountEntryMode
  orientation?: NavOrientation
  accountMenuPlacement?: AccountMenuPlacement
}

export default function TopActionNav({
  className = '',
  accountEntryMode = 'top-nav',
  orientation = 'horizontal',
  accountMenuPlacement = 'bottom',
}: TopActionNavProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { toggleMenu } = useCockpitUi()
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)
  const isVertical = orientation === 'vertical'
  const containerClassName = isVertical
    ? 'flex flex-col items-end gap-2.5'
    : 'flex flex-wrap items-center gap-2'
  const actionClassName = isVertical ? 'w-[8.5rem] justify-center rounded-lg px-3.5 py-2.5' : ''

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <button
        type="button"
        onClick={toggleMenu}
        className={`${BASE_BUTTON_CLASS} ${actionClassName} border-cyan-500/28 bg-black/25 text-cyan-300/72 hover:border-cyan-400/48 hover:text-cyan-100`}
        aria-label="Open training menu"
      >
        <MenuIcon size={14} />
        MENU
      </button>

      {status === 'loading' ? (
        <span
          className={`inline-flex items-center rounded-md border border-cyan-500/20 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-cyan-300/50 ${
            isVertical ? 'w-[8.5rem] justify-center rounded-lg px-3.5 py-2.5' : ''
          }`}
        >
          AUTH...
        </span>
      ) : !session?.user?.id ? (
        <Link
          href="/login"
          className={`${BASE_BUTTON_CLASS} ${actionClassName} border-cyan-500/28 bg-cyan-500/[0.06] text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-100`}
        >
          LOGIN
        </Link>
      ) : (
        <>
          {accountEntryMode === 'top-nav' ? (
            <UserAccountMenu
              key={pathname}
              sessionUser={session.user}
              buttonClassName={actionClassName}
              panelPlacement={accountMenuPlacement}
            />
          ) : null}
          {isAdmin ? (
            <Link
              href="/admin/users"
              className={`${BASE_BUTTON_CLASS} ${actionClassName} border-yellow-500/35 bg-yellow-500/[0.08] text-yellow-200 hover:border-yellow-300/65 hover:text-yellow-100`}
            >
              MANAGE
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}
