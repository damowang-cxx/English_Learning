'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type CockpitUiContextValue = {
  isMenuOpen: boolean
  openMenu: () => void
  closeMenu: () => void
  toggleMenu: () => void
}

const CockpitUiContext = createContext<CockpitUiContextValue | null>(null)

export function CockpitUiProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const openMenu = useCallback(() => setIsMenuOpen(true), [])
  const closeMenu = useCallback(() => setIsMenuOpen(false), [])
  const toggleMenu = useCallback(() => setIsMenuOpen((current) => !current), [])

  const value = useMemo<CockpitUiContextValue>(
    () => ({
      isMenuOpen,
      openMenu,
      closeMenu,
      toggleMenu,
    }),
    [closeMenu, isMenuOpen, openMenu, toggleMenu],
  )

  return <CockpitUiContext.Provider value={value}>{children}</CockpitUiContext.Provider>
}

export function useCockpitUi() {
  const value = useContext(CockpitUiContext)

  if (!value) {
    throw new Error('useCockpitUi must be used within CockpitUiProvider.')
  }

  return value
}
