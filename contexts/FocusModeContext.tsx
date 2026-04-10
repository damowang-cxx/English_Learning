'use client'

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type FocusTheme = 'night' | 'warm' | 'pink'

interface FocusModeContextType {
  isFocusMode: boolean
  focusTheme: FocusTheme
  setIsFocusMode: (isEnabled: boolean) => void
  setFocusTheme: (theme: FocusTheme) => void
  toggleFocusMode: () => void
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined)

const FOCUS_THEME_STORAGE_KEY = 'training-focus-theme'

function isFocusTheme(value: string | null): value is FocusTheme {
  return value === 'night' || value === 'warm' || value === 'pink'
}

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [focusTheme, setFocusThemeState] = useState<FocusTheme>(() => {
    if (typeof window === 'undefined') {
      return 'night'
    }

    const storedTheme = window.localStorage.getItem(FOCUS_THEME_STORAGE_KEY)
    return isFocusTheme(storedTheme) ? storedTheme : 'night'
  })

  const setFocusTheme = (theme: FocusTheme) => {
    setFocusThemeState(theme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FOCUS_THEME_STORAGE_KEY, theme)
    }
  }

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => !prev)
  }

  const value = useMemo(
    () => ({ isFocusMode, focusTheme, setIsFocusMode, setFocusTheme, toggleFocusMode }),
    [focusTheme, isFocusMode]
  )

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  )
}

export function useFocusMode() {
  const context = useContext(FocusModeContext)

  if (context === undefined) {
    throw new Error('useFocusMode must be used within a FocusModeProvider')
  }

  return context
}
