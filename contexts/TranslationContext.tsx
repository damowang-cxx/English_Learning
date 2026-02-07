'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface TranslationContextType {
  showTranslations: boolean
  setShowTranslations: (show: boolean) => void
  toggleTranslations: () => void
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [showTranslations, setShowTranslations] = useState(false)

  const toggleTranslations = () => {
    setShowTranslations(prev => !prev)
  }

  return (
    <TranslationContext.Provider value={{ showTranslations, setShowTranslations, toggleTranslations }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}
