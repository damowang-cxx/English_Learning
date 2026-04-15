'use client'

import Link from 'next/link'
import { HelpCircle, LoaderCircle, LogIn, Menu as MenuIcon, Shield } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { withBasePath } from '@/lib/base-path'
import { isAdminRole } from '@/lib/auth-types'
import { useCockpitUi } from '@/contexts/CockpitUiContext'
import UserAccountMenu from '@/components/UserAccountMenu'
import UserHelpGuide from '@/components/UserHelpGuide'

const BASE_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11px] tracking-[0.18em] transition-colors'

type AccountEntryMode = 'top-nav' | 'none'
type NavOrientation = 'horizontal' | 'vertical'
type AccountMenuPlacement = 'bottom' | 'top'

interface HelpGuideStateResponse {
  seen: boolean
  userGuideSeenAt: string | null
}

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
  const sessionUserId = session?.user?.id ?? null
  const canShowUserHelp = status === 'authenticated' && Boolean(sessionUserId) && !isAdmin
  const isVertical = orientation === 'vertical'
  const isIconOnly = isVertical
  const [isHelpGuideOpen, setIsHelpGuideOpen] = useState(false)
  const [isHelpGuideSeen, setIsHelpGuideSeen] = useState(true)
  const [isHelpGuideStateLoaded, setIsHelpGuideStateLoaded] = useState(false)
  const [isMarkingHelpGuideSeen, setIsMarkingHelpGuideSeen] = useState(false)
  const [helpGuideError, setHelpGuideError] = useState<string | null>(null)
  const containerClassName = isVertical
    ? 'flex flex-col items-end gap-2.5'
    : 'flex flex-wrap items-center gap-2'
  const actionBaseClass = isIconOnly
    ? 'inline-flex h-11 w-11 items-center justify-center rounded-full border p-0 transition-colors'
    : BASE_BUTTON_CLASS
  const actionClassName = ''
  const actionIconSize = isIconOnly ? 18 : 14

  useEffect(() => {
    if (!canShowUserHelp) {
      setIsHelpGuideOpen(false)
      setIsHelpGuideSeen(true)
      setIsHelpGuideStateLoaded(false)
      setHelpGuideError(null)
      return
    }

    const controller = new AbortController()

    async function loadHelpGuideState() {
      try {
        const response = await fetch(withBasePath('/api/account/help-guide'), {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load help guide state.')
        }

        const data = (await response.json()) as HelpGuideStateResponse
        if (controller.signal.aborted) {
          return
        }

        setIsHelpGuideSeen(data.seen)
        setIsHelpGuideStateLoaded(true)
        setHelpGuideError(null)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to load help guide state:', error)
        setIsHelpGuideSeen(false)
        setIsHelpGuideStateLoaded(true)
        setHelpGuideError('暂时无法读取引导状态。点击 GOT IT 时会重新保存已读状态。')
      }
    }

    loadHelpGuideState()

    return () => {
      controller.abort()
    }
  }, [canShowUserHelp, sessionUserId])

  const openHelpGuide = useCallback(() => {
    setIsHelpGuideOpen(true)
  }, [])

  const closeHelpGuide = useCallback(() => {
    setIsHelpGuideOpen(false)
  }, [])

  const markHelpGuideSeen = useCallback(async () => {
    setIsMarkingHelpGuideSeen(true)
    setHelpGuideError(null)

    try {
      const response = await fetch(withBasePath('/api/account/help-guide'), {
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error('Failed to update help guide state.')
      }

      const data = (await response.json()) as HelpGuideStateResponse
      setIsHelpGuideSeen(data.seen)
      setIsHelpGuideStateLoaded(true)
      setIsHelpGuideOpen(false)
    } catch (error) {
      console.error('Failed to update help guide state:', error)
      setHelpGuideError('保存已读状态失败。你仍然可以关闭窗口，NEW 提示会保留。')
    } finally {
      setIsMarkingHelpGuideSeen(false)
    }
  }, [])

  const showHelpGuideNewBadge = canShowUserHelp && isHelpGuideStateLoaded && !isHelpGuideSeen

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

      {canShowUserHelp ? (
        <button
          type="button"
          onClick={openHelpGuide}
          className={`${actionBaseClass} ${actionClassName} relative border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200/80 hover:border-emerald-300/58 hover:text-emerald-50`}
          aria-label="Open help guide"
          aria-expanded={isHelpGuideOpen}
          aria-haspopup="dialog"
          title={isIconOnly ? 'Help guide' : undefined}
        >
          <HelpCircle size={actionIconSize} />
          {isIconOnly ? (
            <span className="sr-only">HELP</span>
          ) : (
            <>
              <span>HELP</span>
              {showHelpGuideNewBadge ? (
                <span className="rounded border border-emerald-200/45 bg-emerald-300/[0.14] px-1.5 py-0.5 text-[9px] tracking-[0.16em] text-emerald-50">
                  NEW
                </span>
              ) : null}
            </>
          )}
          {isIconOnly && showHelpGuideNewBadge ? (
            <span className="absolute -right-1 -top-1 rounded-full border border-emerald-100/65 bg-emerald-300 px-1.5 py-0.5 text-[8px] font-bold leading-none text-black shadow-[0_0_12px_rgba(110,231,183,0.45)]">
              NEW
            </span>
          ) : null}
        </button>
      ) : null}

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

      {canShowUserHelp ? (
        <UserHelpGuide
          isOpen={isHelpGuideOpen}
          isSeen={isHelpGuideSeen}
          isMarkingSeen={isMarkingHelpGuideSeen}
          errorMessage={helpGuideError}
          onClose={closeHelpGuide}
          onMarkSeen={markHelpGuideSeen}
        />
      ) : null}
    </div>
  )
}
