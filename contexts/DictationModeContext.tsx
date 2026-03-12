'use client'

import React, { createContext, useContext, useState, type ReactNode } from 'react'

interface DictationModeContextType {
  isDictationMode: boolean
  setIsDictationMode: (isEnabled: boolean) => void
  toggleDictationMode: () => void
}

const DictationModeContext = createContext<DictationModeContextType | undefined>(undefined)

export function DictationModeProvider({ children }: { children: ReactNode }) {
  const [isDictationMode, setIsDictationMode] = useState(false)

  const toggleDictationMode = () => {
    setIsDictationMode((prev) => !prev)
  }

  return (
    <DictationModeContext.Provider
      value={{ isDictationMode, setIsDictationMode, toggleDictationMode }}
    >
      {children}
    </DictationModeContext.Provider>
  )
}

export function useDictationMode() {
  const context = useContext(DictationModeContext)

  if (context === undefined) {
    throw new Error('useDictationMode must be used within a DictationModeProvider')
  }

  return context
}
