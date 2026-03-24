'use client'

import React, { createContext, useContext, useState, type ReactNode } from 'react'

interface FocusModeContextType {
  isFocusMode: boolean
  setIsFocusMode: (isEnabled: boolean) => void
  toggleFocusMode: () => void
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined)

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false)

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => !prev)
  }

  return (
    <FocusModeContext.Provider
      value={{ isFocusMode, setIsFocusMode, toggleFocusMode }}
    >
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
