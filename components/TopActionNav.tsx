'use client'

import Link from 'next/link'
import { LoaderCircle, LogIn, Menu as MenuIcon, Shield } from 'lucide-react'
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
  const isIconOnly = isVertical
  const containerClassName = isVertical
    ? 'flex flex-col items-end gap-2.5'
    : 'flex flex-wrap items-center gap-2'
  const actionBaseClass = isIconOnly
    ? 'inline-flex h-11 w-11 items-center justify-center rounded-full border p-0 transition-colors'
    : BASE_BUTTON_CLASS
  const actionClassName = ''
  const actionIconSize = isIconOnly ? 18 : 14

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <button
        type="button"
        onClick={toggleMenu}
        className={`${actionBaseClass} ${actionClassName} border-cyan-500/28 bg-black/25 text-cyan-300/72 hover:border-cyan-400/48 hover:text-cyan-100`}
        aria-label="Open training menu"
        title={isIconOnly ? 'Training menu' : undefined}
      >
        <MenuIcon size={actionIconSize} />
        {isIconOnly ? <span className="sr-only">MENU</span> : 'MENU'}
      </button>

      {status === 'loading' ? (
        <span
          className={`inline-flex items-center justify-center border border-cyan-500/20 font-mono text-[10px] tracking-[0.18em] text-cyan-300/50 ${
            isIconOnly ? 'h-11 w-11 rounded-full p-0' : 'rounded-md px-3 py-2'
          }`}
          aria-label="Authenticating"
          title={isIconOnly ? 'Authenticating' : undefined}
        >
          {isIconOnly ? <LoaderCircle size={18} className="animate-spin" /> : 'AUTH...'}
        </span>
      ) : !session?.user?.id ? (
        <Link
          href="/login"
          className={`${actionBaseClass} ${actionClassName} border-cyan-500/28 bg-cyan-500/[0.06] text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-100`}
          aria-label={isIconOnly ? 'Login' : undefined}
          title={isIconOnly ? 'Login' : undefined}
        >
          {isIconOnly ? <LogIn size={18} /> : 'LOGIN'}
        </Link>
      ) : (
        <>
          {accountEntryMode === 'top-nav' ? (
            <UserAccountMenu
              key={pathname}
              sessionUser={session.user}
              buttonClassName={actionClassName}
              panelPlacement={accountMenuPlacement}
              iconOnly={isIconOnly}
              panelVariant="watch"
            />
          ) : null}
          {isAdmin ? (
            <Link
              href="/admin/users"
              className={`${actionBaseClass} ${actionClassName} border-yellow-500/35 bg-yellow-500/[0.08] text-yellow-200 hover:border-yellow-300/65 hover:text-yellow-100`}
              aria-label={isIconOnly ? 'Manage users' : undefined}
              title={isIconOnly ? 'Manage users' : undefined}
            >
              {isIconOnly ? <Shield size={18} /> : 'MANAGE'}
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}
