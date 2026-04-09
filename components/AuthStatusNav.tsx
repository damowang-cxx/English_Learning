'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { withBasePath } from '@/lib/base-path'
import { isAdminRole } from '@/lib/auth-types'

export default function AuthStatusNav() {
  const { data: session, status } = useSession()
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)

  if (status === 'loading') {
    return (
      <span className="rounded-md border border-cyan-500/20 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-cyan-300/50">
        AUTH...
      </span>
    )
  }

  if (!session?.user?.id) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-cyan-500/28 bg-cyan-500/[0.06] px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-cyan-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-100"
      >
        LOGIN
      </Link>
    )
  }

  return (
    <>
      {isAdmin ? (
        <Link
          href="/admin/users"
          className="rounded-md border border-yellow-500/35 bg-yellow-500/[0.08] px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-yellow-200 transition-colors hover:border-yellow-300/65 hover:text-yellow-100"
        >
          USERS
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: withBasePath('/') })}
        className="rounded-md border border-cyan-500/24 bg-black/25 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-cyan-300/72 transition-colors hover:border-cyan-400/48 hover:text-cyan-100"
      >
        LOGOUT
      </button>
    </>
  )
}
