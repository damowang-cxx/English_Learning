'use client'

import Link from 'next/link'
import { useState } from 'react'
import UploadPermissionDialog from '@/components/UploadPermissionDialog'

interface HomeUploadActionProps {
  href: string
  label: string
  isAdmin: boolean
}

const UPLOAD_BUTTON_CLASS =
  'rounded-md border border-red-500/45 bg-red-500/[0.1] px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-500/[0.16] hover:text-red-200'

export default function HomeUploadAction({ href, label, isAdmin }: HomeUploadActionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (isAdmin) {
    return (
      <Link href={href} className={UPLOAD_BUTTON_CLASS}>
        {label}
      </Link>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setIsDialogOpen(true)} className={UPLOAD_BUTTON_CLASS}>
        {label}
      </button>
      {isDialogOpen ? <UploadPermissionDialog onClose={() => setIsDialogOpen(false)} /> : null}
    </>
  )
}
