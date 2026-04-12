import Link from 'next/link'
import type { ReactNode } from 'react'
import HomeUploadAction from '@/components/HomeUploadAction'
import TopActionNav from '@/components/TopActionNav'
import HomeBottomHud from '@/components/HomeBottomHud'
import HomeTopHud from '@/components/HomeTopHud'
import HomeUserWatch from '@/components/HomeUserWatch'

type HomeMode = 'listening' | 'video'

interface HomeModeShellProps {
  mode: HomeMode
  isAdmin?: boolean
  children: ReactNode
}

const MODE_LINKS = [
  { mode: 'listening' as const, label: 'LISTENING', href: '/' },
  { mode: 'video' as const, label: 'VIDEO', href: '/video' },
]

export default function HomeModeShell({ mode, isAdmin = false, children }: HomeModeShellProps) {
  const uploadHref = mode === 'video' ? '/video/upload' : '/upload'
  const uploadLabel = mode === 'video' ? 'UPLOAD VIDEO' : 'UPLOAD LISTENING'

  return (
    <>
      <HomeTopHud />
      <HomeBottomHud />
      <HomeUserWatch key={mode} />
      <div
        className="container mx-auto py-8 cockpit-viewport"
      style={{
        position: 'relative',
        zIndex: 10,
        paddingTop: 'clamp(6.4rem, 12vh, 8rem)',
        paddingBottom: '14vh',
        paddingLeft: '2rem',
        paddingRight: '2rem',
        maxHeight: '84vh',
        overflowY: 'auto',
        overflowX: 'visible',
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '75%',
        maxWidth: '1100px',
      }}
    >
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {MODE_LINKS.map((entry) => {
            const isActive = entry.mode === mode

            return (
              <Link
                key={entry.mode}
                href={entry.href}
                className={`rounded-md border px-4 py-2 font-mono text-[11px] tracking-[0.22em] transition-colors ${
                  isActive
                    ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)]'
                    : 'border-cyan-500/24 bg-black/25 text-cyan-300/58 hover:border-cyan-400/45 hover:text-cyan-200'
                }`}
              >
                {entry.label}
              </Link>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <TopActionNav accountEntryMode="none" />
          <Link
            href="/vocabulary"
            className="home-global-vocab-button group inline-flex items-center gap-2 rounded-md px-3 py-2"
            title="Open global vocabulary library"
            aria-label="Open global vocabulary library"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 transition-colors group-hover:bg-cyan-300" />
            <span className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/78 transition-colors group-hover:text-cyan-200">
              GLOBAL VOCAB
            </span>
          </Link>
          <HomeUploadAction href={uploadHref} label={uploadLabel} isAdmin={isAdmin} />
        </div>
      </div>

      {children}
    </div>
    </>
  )
}
