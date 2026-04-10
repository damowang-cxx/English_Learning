'use client'

import Link from 'next/link'
import { Menu as MenuIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { isAdminRole } from '@/lib/auth-types'
import { useCockpitUi } from '@/contexts/CockpitUiContext'
import UserAccountMenu from '@/components/UserAccountMenu'

const BASE_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors'

interface TopActionNavProps {
  className?: string
}

export default function TopActionNav({ className = '' }: TopActionNavProps) {
  const { data: session, status } = useSession()
  const { toggleMenu } = useCockpitUi()
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={toggleMenu}
        className={`${BASE_BUTTON_CLASS} border-cyan-500/28 bg-black/25 text-cyan-300/72 hover:border-cyan-400/48 hover:text-cyan-100`}
        aria-label="Open training menu"
      >
        <MenuIcon size={14} />
        MENU
      </button>

      {status === 'loading' ? (
        <span className="rounded-md border border-cyan-500/20 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-cyan-300/50">
          AUTH...
        </span>
      ) : !session?.user?.id ? (
        <Link
          href="/login"
          className={`${BASE_BUTTON_CLASS} border-cyan-500/28 bg-cyan-500/[0.06] text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-100`}
        >
          LOGIN
        </Link>
      ) : (
        <>
          <UserAccountMenu sessionUser={session.user} />
          {isAdmin ? (
            <Link
              href="/admin/users"
              className={`${BASE_BUTTON_CLASS} border-yellow-500/35 bg-yellow-500/[0.08] text-yellow-200 hover:border-yellow-300/65 hover:text-yellow-100`}
            >
              MANAGE
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}
