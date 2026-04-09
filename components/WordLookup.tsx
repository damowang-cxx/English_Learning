'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { withBasePath } from '@/lib/base-path'
import {
  buildVocabularyEntryFromForm,
  getVocabularyEntryKey,
  type VocabularyEntry,
  type VocabularyFormSenseDraft,
} from '@/lib/vocabulary'

export interface WordLookupAnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface WordLookupRequest<TContextId extends string = string> {
  contextId: TContextId
  text: string
  anchorRect: WordLookupAnchorRect
}

interface SelectableEnglishTextProps<TContextId extends string = string> {
  contextId: TContextId
  className?: string
  children: ReactNode
  onLookup: (request: WordLookupRequest<TContextId>) => void
}

interface DictionaryLookupEntry {
  word: string
  phonetic: string
  senses: VocabularyFormSenseDraft[]
}

interface WordLookupPopoverProps {
  request: WordLookupRequest | null
  savedEntryKeys: Set<string>
  theme?: 'green' | 'cyan' | 'slate'
  onSave: (entry: VocabularyEntry) => Promise<void> | void
  onClose: () => void
}

const EDGE_PADDING = 12
const POPOVER_WIDTH = 320

export function normalizeLookupText(value: string) {
  const normalized = value
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^A-Za-z0-9']+/, '')
    .replace(/[^A-Za-z0-9']+$/, '')

  if (!/[A-Za-z]/.test(normalized)) {
    return ''
  }

  return normalized.slice(0, 80).toLowerCase()
}

function getSelectionAnchorRect(container: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode

  if (
    !anchorNode
    || !focusNode
    || !container.contains(anchorNode)
    || !container.contains(focusNode)
  ) {
    return null
  }

  const selectedText = normalizeLookupText(selection.toString())

  if (!selectedText) {
    return null
  }

  const rangeRect = range.getBoundingClientRect()
  const fallbackRect = container.getBoundingClientRect()
  const rect = rangeRect.width > 0 && rangeRect.height > 0 ? rangeRect : fallbackRect

  return {
    text: selectedText,
    anchorRect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  }
}

function getPopoverPosition(anchorRect: WordLookupAnchorRect) {
  if (typeof window === 'undefined') {
    return { left: EDGE_PADDING, top: EDGE_PADDING }
  }

  const preferredLeft = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2
  const left = Math.min(
    window.innerWidth - POPOVER_WIDTH - EDGE_PADDING,
    Math.max(EDGE_PADDING, preferredLeft)
  )
  const topAbove = anchorRect.top - 14
  const top = topAbove > 180 ? topAbove : anchorRect.top + anchorRect.height + 12

  return {
    left,
    top: Math.max(EDGE_PADDING, top),
  }
}

function getThemeClasses(theme: WordLookupPopoverProps['theme']) {
  if (theme === 'cyan') {
    return {
      shell: 'border-cyan-500/38 bg-cyan-950/90 shadow-[0_0_28px_rgba(34,211,238,0.2)]',
      muted: 'text-cyan-300/65',
      text: 'text-cyan-50',
      accent: 'text-cyan-200',
      closeButton: 'border-cyan-400/25 text-cyan-300/65 hover:border-cyan-300/55 hover:text-cyan-100',
      button: 'border-cyan-400/45 bg-cyan-500/[0.12] text-cyan-100 hover:border-cyan-200/70 hover:bg-cyan-500/[0.18]',
    }
  }

  if (theme === 'slate') {
    return {
      shell: 'border-slate-600/70 bg-slate-950/94 shadow-[0_22px_48px_rgba(2,6,23,0.42)]',
      muted: 'text-slate-400/78',
      text: 'text-slate-50',
      accent: 'text-slate-200',
      closeButton: 'border-slate-500/40 text-slate-400/85 hover:border-slate-300/70 hover:text-slate-100',
      button: 'border-slate-400/45 bg-slate-200/[0.08] text-slate-100 hover:border-slate-200/70 hover:bg-slate-200/[0.13]',
    }
  }

  return {
    shell: 'border-green-500/34 bg-[#020c08]/94 shadow-[0_0_28px_rgba(10,255,10,0.14)]',
    muted: 'text-green-400/62',
    text: 'text-green-50',
    accent: 'text-green-200',
    closeButton: 'border-green-400/25 text-green-400/62 hover:border-green-300/55 hover:text-green-100',
    button: 'border-green-400/38 bg-green-500/[0.1] text-green-100 hover:border-green-300/60 hover:bg-green-500/[0.16]',
  }
}

export function SelectableEnglishText<TContextId extends string = string>({
  contextId,
  className,
  children,
  onLookup,
}: SelectableEnglishTextProps<TContextId>) {
  const containerRef = useRef<HTMLDivElement>(null)

  const openFromSelection = () => {
    window.setTimeout(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const result = getSelectionAnchorRect(container)
      if (!result) {
        return
      }

      onLookup({
        contextId,
        text: result.text,
        anchorRect: result.anchorRect,
      })
    }, 0)
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseUp={openFromSelection}
      onDoubleClick={openFromSelection}
    >
      {children}
    </div>
  )
}

export function WordLookupPopover({
  request,
  savedEntryKeys,
  theme = 'green',
  onSave,
  onClose,
}: WordLookupPopoverProps) {
  const [entry, setEntry] = useState<DictionaryLookupEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (!request?.text) {
      return
    }

    const controller = new AbortController()
    setEntry(null)
    setError('')
    setSaveError('')
    setIsLoading(true)

    fetch(withBasePath(`/api/dictionary/entry?word=${encodeURIComponent(request.text)}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))

        if (response.status === 404 || !payload?.entry) {
          setEntry(null)
          setError('NOT FOUND IN LOCAL DICTIONARY')
          return
        }

        if (!response.ok) {
          throw new Error(payload?.error || `Lookup failed: ${response.status}`)
        }

        setEntry(payload.entry)
      })
      .catch((lookupError) => {
        if (lookupError instanceof DOMException && lookupError.name === 'AbortError') {
          return
        }

        setEntry(null)
        setError(lookupError instanceof Error ? lookupError.message : 'Dictionary lookup failed.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [request?.text])

  useEffect(() => {
    if (!request) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-word-lookup-popover="true"]')) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose, request])

  const vocabularyEntry = useMemo(() => {
    if (!entry) {
      return null
    }

    return buildVocabularyEntryFromForm({
      headword: entry.word,
      phonetic: entry.phonetic || '',
      senses: entry.senses.length > 0 ? entry.senses : [],
    })
  }, [entry])

  const isStarred = vocabularyEntry ? savedEntryKeys.has(getVocabularyEntryKey(vocabularyEntry)) : false
  const position = request ? getPopoverPosition(request.anchorRect) : null

  if (!request || !position) {
    return null
  }

  const handleSave = async () => {
    if (!vocabularyEntry || isStarred || isSaving) {
      return
    }

    setIsSaving(true)
    setSaveError('')

    try {
      await onSave(vocabularyEntry)
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      data-word-lookup-popover="true"
      className={`fixed z-[240] w-[320px] overflow-hidden rounded-lg border p-4 backdrop-blur-md ${themeClasses.shell}`}
      style={{
        left: position.left,
        top: position.top,
        transform: position.top < request.anchorRect.top ? 'translateY(-100%)' : undefined,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] cyber-label tracking-[0.22em] ${themeClasses.muted}`}>LOCAL DICTIONARY</div>
          <div className={`mt-1 break-words text-lg font-semibold ${themeClasses.text}`}>
            {entry?.word || request.text}
          </div>
          {entry?.phonetic ? <div className={`mt-1 text-xs ${themeClasses.muted}`}>{entry.phonetic}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded border px-2 py-1 text-[10px] transition-colors ${themeClasses.closeButton}`}
          aria-label="Close word lookup"
        >
          CLOSE
        </button>
      </div>

      <div className="mt-3 min-h-[52px]">
        {isLoading ? (
          <div className={`text-xs cyber-label ${themeClasses.muted}`}>LOOKING UP...</div>
        ) : error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : entry ? (
          <div className="space-y-2">
            {entry.senses.map((sense, index) => (
              <div key={`${entry.word}-${sense.pos}-${index}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                <span className={`mr-2 font-mono text-[11px] ${themeClasses.muted}`}>{sense.pos}</span>
                <span className={`text-sm leading-6 ${themeClasses.accent}`}>{sense.meaning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {saveError ? (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200">
          {saveError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!vocabularyEntry || isStarred || isSaving}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs cyber-button-text transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${themeClasses.button}`}
      >
        <span>{isStarred ? '[*]' : '[ ]'}</span>
        <span>{isStarred ? 'STARRED' : isSaving ? 'SAVING...' : 'ADD TO VOCAB'}</span>
      </button>
    </div>
  )
}
