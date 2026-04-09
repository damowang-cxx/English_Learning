'use client'

import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'
import { withBasePath } from '@/lib/base-path'

export default function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath('/api/auth')}>
      {children}
    </SessionProvider>
  )
}
