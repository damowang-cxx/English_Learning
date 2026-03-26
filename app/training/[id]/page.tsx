'use client'

import { type ReactNode, useEffect, useEffectEvent, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/TranslationContext'
import { useDictationMode } from '@/contexts/DictationModeContext'
import { useFocusMode } from '@/contexts/FocusModeContext'
import { getAudioSrc, withBasePath } from '@/lib/base-path'
import { toLocalDateKey } from '@/lib/learning-stats'
import {
  buildDictationSentenceModel,
  createEmptyDictationInputs,
  evaluateDictationSentence,
  isDictationSentenceComplete,
  sanitizeDictationInput,
  type DictationSentenceModel,
  type DictationSentenceResult,
} from '@/lib/dictation'
import {
  areVocabularyListsEqual,
  buildVocabularyBook,
  buildVocabularyEntryFromForm,
  createEmptyVocabularyFormState,
  createEmptyVocabularySenseDraft,
  formatVocabularyEntry,
  getVocabularyEntryKey,
  isVocabularyEntryStructured,
  isVocabularyFormSubmittable,
  mergeVocabularyWords,
  parseVocabularyWords,
  serializeVocabularyWords,
  type VocabularyEntry,
  type VocabularyFormSenseDraft,
  type VocabularyFormState,
} from '@/lib/vocabulary'
import {
  DEFAULT_TRAINING_SENTENCE_FONT_ID,
  getTrainingSentenceFontOption,
  isTrainingSentenceFontId,
  TRAINING_SENTENCE_FONT_OPTIONS,
  TRAINING_SENTENCE_FONT_STORAGE_KEY,
  type TrainingSentenceFontId,
} from '@/lib/training-fonts'

interface Sentence {
  id: string
  text: string
  translation: string | null
  startTime: number
  endTime: number
  order: number
}

interface EditSentence {
  text: string
  translation: string
  startTime: number
  endTime: number
}

interface TrainingItem {
  id: string
  title: string
  audioUrl: string
  sentences: Sentence[]
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SentenceVocabularyState {
  items: VocabularyEntry[]
  form: VocabularyFormState
  saveStatus: SaveStatus
  lookup: SentenceVocabularyLookupState
}

interface VocabularySuggestion {
  word: string
  phonetic: string
  translationPreview: string
}

interface SentenceVocabularyLookupState {
  suggestions: VocabularySuggestion[]
  isLoading: boolean
  isHydrating: boolean
  isOpen: boolean
}

interface SentenceDictationState {
  inputs: string[]
  submittedResult: DictationSentenceResult | null
  revealModes: DictationRevealMode[]
}

type DictationRevealMode = 'hidden' | 'initial' | 'full'

const createEmptySentenceVocabularyLookupState = (): SentenceVocabularyLookupState => ({
  suggestions: [],
  isLoading: false,
  isHydrating: false,
  isOpen: false,
})

const createEmptySentenceVocabularyState = (): SentenceVocabularyState => ({
  items: [],
  form: createEmptyVocabularyFormState(),
  saveStatus: 'idle',
  lookup: createEmptySentenceVocabularyLookupState(),
})

const VOCABULARY_POS_OPTIONS = [
  { value: 'n.', label: 'N.' },
  { value: 'v.', label: 'V.' },
  { value: 'adj.', label: 'ADJ.' },
  { value: 'adv.', label: 'ADV.' },
  { value: 'prep.', label: 'PREP.' },
  { value: 'pron.', label: 'PRON.' },
  { value: 'conj.', label: 'CONJ.' },
  { value: 'phr.', label: 'PHR.' },
] as const

const PLAYER_VISUALIZER_BARS = [28, 46, 34, 58, 42, 66, 38, 62, 36, 54, 30, 48]

function createEmptyDictationRevealModes(model: DictationSentenceModel): DictationRevealMode[] {
  return model.words.map(() => 'hidden')
}

interface SentenceHighlightRange {
  start: number
  end: number
  label: string
  key: string
}

function escapeHighlightRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSentenceHighlightPattern(headword: string) {
  const trimmed = headword.trim()

  if (!trimmed) {
    return null
  }

  const escaped = escapeHighlightRegExp(trimmed)
    .replace(/\s+/g, '\\s+')
    .replace(/['’]/g, "['’]?")

  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi')
}

function getSentenceHighlightRanges(sentenceText: string, entries: VocabularyEntry[]): SentenceHighlightRange[] {
  const ranges: SentenceHighlightRange[] = []
  const structuredEntries = entries
    .filter((entry) => isVocabularyEntryStructured(entry) && entry.headword.trim().length > 0)
    .sort((left, right) => right.headword.length - left.headword.length)

  for (const entry of structuredEntries) {
    const pattern = buildSentenceHighlightPattern(entry.headword)
    const label = formatVocabularyEntry(entry).trim()

    if (!pattern || !label) {
      continue
    }

    let match = pattern.exec(sentenceText)

    while (match) {
      const start = match.index
      const end = start + match[0].length
      const isOverlapping = ranges.some((range) => start < range.end && end > range.start)

      if (!isOverlapping) {
        ranges.push({
          start,
          end,
          label,
          key: `${entry.headwordKey}-${start}-${end}`,
        })
      }

      match = pattern.exec(sentenceText)
    }
  }

  return ranges.sort((left, right) => left.start - right.start)
}

function renderSentenceTextWithHighlights(sentenceText: string, entries: VocabularyEntry[], shouldHighlight: boolean): ReactNode {
  if (!shouldHighlight) {
    return sentenceText
  }

  const ranges = getSentenceHighlightRanges(sentenceText, entries)

  if (ranges.length === 0) {
    return sentenceText
  }

  const nodes: ReactNode[] = []
  let cursor = 0

  for (const range of ranges) {
    if (cursor < range.start) {
      nodes.push(sentenceText.slice(cursor, range.start))
    }

    nodes.push(
      <span
        key={range.key}
        className="training-future-word-highlight"
        title={range.label}
      >
        {sentenceText.slice(range.start, range.end)}
      </span>
    )

    cursor = range.end
  }

  if (cursor < sentenceText.length) {
    nodes.push(sentenceText.slice(cursor))
  }

  return nodes
}

function scrollSentenceWithinContainer(
  container: HTMLDivElement,
  target: HTMLDivElement,
  behavior: ScrollBehavior = 'smooth'
) {
  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const visiblePadding = 24
  const isOutsideVisibleBand =
    targetRect.top < containerRect.top + visiblePadding
    || targetRect.bottom > containerRect.bottom - visiblePadding

  if (!isOutsideVisibleBand) {
    return
  }

  const targetTop = targetRect.top - containerRect.top + container.scrollTop
  const centeredTop = targetTop - (container.clientHeight - target.offsetHeight) / 2
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextScrollTop = Math.min(maxScrollTop, Math.max(0, centeredTop))

  container.scrollTo({
    top: nextScrollTop,
    behavior,
  })
}

export default function TrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<TrainingItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1)
  const { showTranslations, setShowTranslations } = useTranslation()
  const { isDictationMode, setIsDictationMode } = useDictationMode()
  const { isFocusMode, setIsFocusMode } = useFocusMode()
  const [expandedTranslations, setExpandedTranslations] = useState<Set<string>>(new Set())
  const [collapsedGlobalTranslations, setCollapsedGlobalTranslations] = useState<Set<string>>(new Set())
  const [repeatMode, setRepeatMode] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [sentenceVocabulary, setSentenceVocabulary] = useState<Record<string, SentenceVocabularyState>>({})
  const [sentenceDictation, setSentenceDictation] = useState<Record<string, SentenceDictationState>>({})
  const [isVocabularyBookExpanded, setIsVocabularyBookExpanded] = useState(false)
  const [activeVocabularyModalSentenceId, setActiveVocabularyModalSentenceId] = useState<string | null>(null)
  const [selectedSentenceFontId, setSelectedSentenceFontId] = useState<TrainingSentenceFontId>(
    DEFAULT_TRAINING_SENTENCE_FONT_ID
  )

  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null)
  const [editSentences, setEditSentences] = useState<EditSentence[]>([])
  const [editCurrentSentence, setEditCurrentSentence] = useState<EditSentence>({
    text: '',
    translation: '',
    startTime: 0,
    endTime: 0
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<number | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const dictationInputRefs = useRef<Record<string, Array<HTMLInputElement | null>>>({})
  const vocabularySaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const vocabularySaveResetTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingVocabularySaveRef = useRef<Record<string, VocabularyEntry[]>>({})
  const vocabularySaveInFlightRef = useRef<Record<string, boolean>>({})
  const vocabularySuggestTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const vocabularySuggestRequestIdsRef = useRef<Record<string, number>>({})
  const vocabularySuggestBlurTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const heartbeatLastTickAtRef = useRef<number | null>(null)
  const heartbeatInFlightRef = useRef(false)
  const isPlayingRef = useRef(false)
  const isDictationModeRef = useRef(false)
  const lastDictationInputAtRef = useRef(0)

  useEffect(() => {
    fetchTrainingItem()
  }, [params.id])

  useEffect(() => {
    setIsFocusMode(false)
  }, [params.id, setIsFocusMode])

  useEffect(() => {
    if (item) {
      fetchUserNotes()
    }
  }, [item])

  useEffect(() => {
    setExpandedTranslations(new Set())
    setCollapsedGlobalTranslations(new Set())
    setActiveVocabularyModalSentenceId(null)
  }, [item?.id])

  useEffect(() => {
    if (showTranslations) {
      setCollapsedGlobalTranslations(new Set())
    }
  }, [showTranslations])

  useEffect(() => {
    if (!item) {
      setSentenceDictation({})
      dictationInputRefs.current = {}
      return
    }

    const nextSentenceIds = new Set(item.sentences.map((sentence) => sentence.id))

    dictationInputRefs.current = Object.fromEntries(
      Object.entries(dictationInputRefs.current).filter(([sentenceId]) => nextSentenceIds.has(sentenceId))
    )

    setSentenceDictation((prev) => {
      const nextState: Record<string, SentenceDictationState> = {}

      for (const sentence of item.sentences) {
        const model = buildDictationSentenceModel(sentence.text)
        const existing = prev[sentence.id]
        const nextInputs =
          existing && existing.inputs.length === model.words.length
            ? existing.inputs
            : createEmptyDictationInputs(model)
        const nextRevealModes =
          existing && existing.revealModes.length === model.words.length
            ? existing.revealModes
            : createEmptyDictationRevealModes(model)
        const nextSubmittedResult =
          existing?.submittedResult && existing.submittedResult.entries.length === model.words.length
            ? existing.submittedResult
            : null

        nextState[sentence.id] = {
          inputs: nextInputs,
          submittedResult: nextSubmittedResult,
          revealModes: nextRevealModes,
        }
      }

      return nextState
    })
  }, [item])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    isDictationModeRef.current = isDictationMode
  }, [isDictationMode])

  const pushLearningHeartbeat = useEffectEvent(async () => {
    if (!item || heartbeatInFlightRef.current) {
      return
    }

    const now = Date.now()
    const lastTickAt = heartbeatLastTickAtRef.current ?? now
    const elapsedSeconds = Math.floor((now - lastTickAt) / 1000)
    heartbeatLastTickAtRef.current = now

    if (elapsedSeconds <= 0 || document.hidden) {
      return
    }

    const isAudioActive = isPlayingRef.current
    const isDictationActive =
      isDictationModeRef.current
      && (now - lastDictationInputAtRef.current) <= 8000

    if (!isAudioActive && !isDictationActive) {
      return
    }

    heartbeatInFlightRef.current = true
    try {
      await fetch(withBasePath('/api/learning-stats/heartbeat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateKey: toLocalDateKey(new Date()),
          studyDeltaSec: elapsedSeconds,
          audioDeltaSec: isAudioActive ? elapsedSeconds : 0,
          dictationDeltaSec: isDictationActive ? elapsedSeconds : 0,
        }),
      })
    } catch (error) {
      console.error('Failed to push learning heartbeat:', error)
    } finally {
      heartbeatInFlightRef.current = false
    }
  })

  useEffect(() => {
    if (!item) {
      return
    }

    heartbeatLastTickAtRef.current = Date.now()

    const timer = window.setInterval(() => {
      void pushLearningHeartbeat()
    }, 10000)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        heartbeatLastTickAtRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      heartbeatLastTickAtRef.current = null
    }
  }, [item?.id])

  useEffect(() => (
    () => {
      Object.values(vocabularySaveTimersRef.current).forEach((timer) => clearTimeout(timer))
      Object.values(vocabularySaveResetTimersRef.current).forEach((timer) => clearTimeout(timer))
      Object.values(vocabularySuggestTimersRef.current).forEach((timer) => clearTimeout(timer))
      Object.values(vocabularySuggestBlurTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  ), [])

  useEffect(() => {
    const storedFontId = window.localStorage.getItem(TRAINING_SENTENCE_FONT_STORAGE_KEY)

    if (storedFontId && isTrainingSentenceFontId(storedFontId)) {
      setSelectedSentenceFontId(storedFontId)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(TRAINING_SENTENCE_FONT_STORAGE_KEY, selectedSentenceFontId)
  }, [selectedSentenceFontId])

  // 鍏ㄥ睆妯″紡涓嬮殣钘忎华琛ㄧ洏
  useEffect(() => {
    const cockpitPanel = document.querySelector('.cockpit-panel') as HTMLElement
    if (cockpitPanel) {
      cockpitPanel.dataset.trainingFullscreen = isFullscreen ? 'true' : 'false'
    }
    return () => {
      if (cockpitPanel) {
        delete cockpitPanel.dataset.trainingFullscreen
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    if (isDictationMode) {
      setShowTranslations(false)
    }
  }, [isDictationMode, setShowTranslations])

  useEffect(() => {
    document.body.dataset.trainingPage = 'true'
    document.body.dataset.trainingFocusMode = isFocusMode ? 'true' : 'false'

    return () => {
      delete document.body.dataset.trainingPage
      delete document.body.dataset.trainingFocusMode
    }
  }, [isFocusMode])

  useEffect(() => {
    return () => {
      setIsDictationMode(false)
    }
  }, [setIsDictationMode])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    
    return () => {
      // 鎭㈠鍘熷鏍峰紡
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeVocabularyModalSentenceId) {
        e.preventDefault()
        setActiveVocabularyModalSentenceId(null)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handlePlayPause()
          break
        case 'Escape':
          if (isEditing) {
            setIsEditing(false)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, duration, isEditing, activeVocabularyModalSentenceId])

  const handleTrainingShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement
      || event.target instanceof HTMLSelectElement
      || (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return
    }

    const hasSentences = Boolean(item?.sentences.length)
    const currentSentence =
      item && currentSentenceIndex >= 0 && currentSentenceIndex < item.sentences.length
        ? item.sentences[currentSentenceIndex]
        : null

    switch (event.key) {
      case 'ArrowUp':
        if (!hasSentences) {
          return
        }
        event.preventDefault()
        jumpToSentenceByIndex(
          currentSentenceIndex >= 0 ? Math.max(0, currentSentenceIndex - 1) : 0
        )
        return
      case 'ArrowDown':
        if (!hasSentences || !item) {
          return
        }
        event.preventDefault()
        jumpToSentenceByIndex(
          currentSentenceIndex >= 0
            ? Math.min(item.sentences.length - 1, currentSentenceIndex + 1)
            : 0
        )
        return
      case 'r':
      case 'R':
        if (isDictationMode || currentSentenceIndex < 0) {
          return
        }
        event.preventDefault()
        handleRepeatClick(currentSentenceIndex)
        return
      case 't':
      case 'T':
        if (isDictationMode) {
          return
        }
        event.preventDefault()
        setShowTranslations(!showTranslations)
        return
      case 'd':
      case 'D':
        if (isDictationMode || !currentSentence) {
          return
        }
        event.preventDefault()
        toggleSentenceTranslation(currentSentence.id)
        return
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleTrainingShortcut)
    return () => window.removeEventListener('keydown', handleTrainingShortcut)
  }, [])

  // 鎾斁閫熷害鎺у埗
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // 鑷姩婊氬姩鍒板綋鍓嶆挱鏀剧殑鍙ュ瓙
  useEffect(() => {
    if (isDictationMode) {
      return
    }

    if (currentSentenceIndex >= 0 && sentenceRefs.current[currentSentenceIndex] && contentRef.current) {
      const sentenceElement = sentenceRefs.current[currentSentenceIndex]
      const container = contentRef.current
      
      const containerRect = container.getBoundingClientRect()
      const sentenceRect = sentenceElement.getBoundingClientRect()
      
      if (sentenceRect.top < containerRect.top || sentenceRect.bottom > containerRect.bottom) {
        scrollSentenceWithinContainer(container, sentenceElement, 'smooth')
      }
    }
  }, [currentSentenceIndex, isDictationMode])

  // 閫氱煡鑷姩娑堝け
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  useEffect(() => {
    const flushPendingVocabularySaves = () => {
      for (const [sentenceId, items] of Object.entries(pendingVocabularySaveRef.current)) {
        const timer = vocabularySaveTimersRef.current[sentenceId]
        if (timer) {
          clearTimeout(timer)
          delete vocabularySaveTimersRef.current[sentenceId]
        }

        const body = JSON.stringify({
          sentenceId,
          words: serializeVocabularyWords(items),
          notes: '',
          userId: 'default',
        })

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const sent = navigator.sendBeacon(
            withBasePath('/api/user-notes'),
            new Blob([body], { type: 'application/json' })
          )

          if (sent) {
            continue
          }
        }

        void fetch(withBasePath('/api/user-notes'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        })
      }
    }

    const handlePageHide = () => {
      flushPendingVocabularySaves()
    }

    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      flushPendingVocabularySaves()
      Object.values(vocabularySaveTimersRef.current).forEach((timer) => clearTimeout(timer))
      Object.values(vocabularySaveResetTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const fetchTrainingItem = async () => {
    try {
      const response = await fetch(withBasePath(`/api/training-items/${params.id}`))
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setItem(data)
    } catch (error) {
      console.error('Error fetching training item:', error)
      setNotification({ type: 'error', message: '加载失败，请刷新页面重试' })
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = () => {
    if (!item) return
    setEditTitle(item.title)
    setEditSentences(item.sentences.map(s => ({
      text: s.text,
      translation: s.translation || '',
      startTime: s.startTime,
      endTime: s.endTime
    })))
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: item.sentences.length > 0 ? item.sentences[item.sentences.length - 1].endTime : 0,
      endTime: item.sentences.length > 0 ? item.sentences[item.sentences.length - 1].endTime : 0
    })
    setEditAudioFile(null)
    setEditingSentenceIndex(null)
    setIsEditing(true)
  }

  const handleEditAddSentence = () => {
    if (!editCurrentSentence.text.trim()) {
      setNotification({ type: 'error', message: '请填写英语句子' })
      return
    }
    if (editCurrentSentence.startTime < 0 || editCurrentSentence.endTime <= editCurrentSentence.startTime) {
      setNotification({ type: 'error', message: '请填写有效的开始时间和结束时间（结束时间必须大于开始时间）' })
      return
    }
    
    if (editingSentenceIndex !== null) {
      // 鏇存柊宸插瓨鍦ㄧ殑鍙ュ瓙
      const updatedSentences = [...editSentences]
      updatedSentences[editingSentenceIndex] = { ...editCurrentSentence }
      setEditSentences(updatedSentences)
      setEditingSentenceIndex(null)
    } else {
      // Sentence draft is appended below so the reset uses the current end time.
    }
    
    // 娓呯┖琛ㄥ崟
    if (editingSentenceIndex === null) {
      setEditSentences((prev) => [...prev, { ...editCurrentSentence }])
    }

    const lastEndTime = editCurrentSentence.endTime
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: lastEndTime,
      endTime: lastEndTime
    })
  }

  const handleEditSentence = (index: number) => {
    if (editingSentenceIndex !== null && editingSentenceIndex !== index) {
      handleCancelEdit()
    }
    const sentence = editSentences[index]
    setEditCurrentSentence({
      text: sentence.text,
      translation: sentence.translation,
      startTime: sentence.startTime,
      endTime: sentence.endTime
    })
    setEditingSentenceIndex(index)
  }

  const handleCancelEdit = () => {
    setEditingSentenceIndex(null)
    const lastEndTime = editSentences.length > 0 
      ? editSentences[editSentences.length - 1].endTime 
      : 0
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: lastEndTime,
      endTime: lastEndTime
    })
  }

  const handleEditRemoveSentence = (index: number) => {
    const sentence = editSentences[index]
    const confirmDelete = window.confirm(`确定要删除句子 "${sentence.text.substring(0, 30)}${sentence.text.length > 30 ? '...' : ''}" 吗？`)
    if (!confirmDelete) return

    setEditSentences(editSentences.filter((_, i) => i !== index))
    if (editingSentenceIndex === index) {
      handleCancelEdit()
    } else if (editingSentenceIndex !== null && editingSentenceIndex > index) {
      setEditingSentenceIndex(editingSentenceIndex - 1)
    }
    setNotification({ type: 'info', message: '句子已删除' })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const hasUnsaved = editCurrentSentence.text.trim() && 
                       editCurrentSentence.startTime >= 0 && 
                       editCurrentSentence.endTime > editCurrentSentence.startTime
    
    let finalSentences = [...editSentences]

    if (editingSentenceIndex !== null) {
      if (!editCurrentSentence.text.trim()) {
        setNotification({ type: 'error', message: '请填写英语句子' })
        return
      }
      if (editCurrentSentence.startTime < 0 || editCurrentSentence.endTime <= editCurrentSentence.startTime) {
        setNotification({ type: 'error', message: '请填写有效的开始时间和结束时间（结束时间必须大于开始时间）' })
        return
      }
      finalSentences[editingSentenceIndex] = { ...editCurrentSentence }
    }
    
    if (editingSentenceIndex === null && hasUnsaved) {
      const shouldAdd = window.confirm("检测到未保存的句子分段，是否先添加到列表？\n\n如果选择“取消”，将只提交已保存的句子。")
      if (shouldAdd) {
        if (!editCurrentSentence.text.trim()) {
          setNotification({ type: 'error', message: '请填写英语句子' })
          return
        }
        if (editCurrentSentence.startTime < 0 || editCurrentSentence.endTime <= editCurrentSentence.startTime) {
          setNotification({ type: 'error', message: '请填写有效的开始时间和结束时间（结束时间必须大于开始时间）' })
          return
        }
        finalSentences = [...editSentences, { ...editCurrentSentence }]
      }
    }
    
    if (!editTitle.trim() || finalSentences.length === 0) {
      setNotification({ type: 'error', message: '请填写标题和至少一个句子分段' })
      return
    }

    setIsUpdating(true)
    try {
      const formData = new FormData()
      formData.append('title', editTitle.trim())
      if (editAudioFile) {
        formData.append('audio', editAudioFile)
      }
      formData.append('sentences', JSON.stringify(finalSentences))

      const response = await fetch(withBasePath(`/api/training-items/${params.id}`), {
        method: 'PUT',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Update failed:', errorText)
        throw new Error(`更新失败: ${response.status}`)
      }

      const data = await response.json()
      setItem(data)
      setIsEditing(false)
      setNotification({ type: 'success', message: '更新成功！' })
    } catch (error) {
      console.error('Update error:', error)
      setNotification({ type: 'error', message: `更新失败，请重试: ${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteTrainingItem = async () => {
    if (!item || isDeleting) {
      return
    }

    const confirmDelete = window.confirm(
      `确定要删除整篇训练 "${item.title}" 吗？\n\n这会同时删除音频、全部句子和该训练下的生词笔记，且无法恢复。`
    )

    if (!confirmDelete) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(withBasePath(`/api/training-items/${params.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Delete failed:', errorText)
        throw new Error(`删除失败: ${response.status}`)
      }

      window.location.href = withBasePath('/')
    } catch (error) {
      console.error('Delete error:', error)
      setNotification({
        type: 'error',
        message: `删除失败，请重试: ${error instanceof Error ? error.message : '未知错误'}`,
      })
      setIsDeleting(false)
    }
  }

  const hasUnsavedEditSentence = editCurrentSentence.text.trim() && 
                                  editCurrentSentence.startTime >= 0 && 
                                  editCurrentSentence.endTime > editCurrentSentence.startTime

  const updateSentenceVocabularyState = (
    sentenceId: string,
    updater: (current: SentenceVocabularyState) => SentenceVocabularyState
  ) => {
    setSentenceVocabulary((prev) => {
      const current = prev[sentenceId] || createEmptySentenceVocabularyState()
      return {
        ...prev,
        [sentenceId]: updater(current),
      }
    })
  }

  const setSentenceVocabularySaveStatus = (sentenceId: string, saveStatus: SaveStatus) => {
    const resetTimer = vocabularySaveResetTimersRef.current[sentenceId]
    if (resetTimer) {
      clearTimeout(resetTimer)
      delete vocabularySaveResetTimersRef.current[sentenceId]
    }

    updateSentenceVocabularyState(sentenceId, (current) => ({
      ...current,
      saveStatus,
    }))

    if (saveStatus === 'saved') {
      vocabularySaveResetTimersRef.current[sentenceId] = setTimeout(() => {
        updateSentenceVocabularyState(sentenceId, (current) => (
          current.saveStatus === 'saved'
            ? { ...current, saveStatus: 'idle' }
            : current
        ))
        delete vocabularySaveResetTimersRef.current[sentenceId]
      }, 1200)
    }
  }

  const runVocabularySave = async (sentenceId: string) => {
    const itemsToSave = pendingVocabularySaveRef.current[sentenceId] || []

    if (vocabularySaveInFlightRef.current[sentenceId]) {
      return
    }

    const pendingTimer = vocabularySaveTimersRef.current[sentenceId]
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      delete vocabularySaveTimersRef.current[sentenceId]
    }

    vocabularySaveInFlightRef.current[sentenceId] = true
    setSentenceVocabularySaveStatus(sentenceId, 'saving')

    const serializedItems = serializeVocabularyWords(itemsToSave)
    let shouldSaveLatestSnapshot = false

    try {
      const response = await fetch(withBasePath('/api/user-notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceId,
          words: serializedItems,
          notes: '',
          userId: 'default',
        }),
        keepalive: true,
      })

      if (!response.ok) {
        throw new Error(`Failed to save vocabulary for sentence ${sentenceId}`)
      }

      const latestPendingItems = pendingVocabularySaveRef.current[sentenceId] || []
      shouldSaveLatestSnapshot = !areVocabularyListsEqual(latestPendingItems, itemsToSave)

      if (!shouldSaveLatestSnapshot) {
        delete pendingVocabularySaveRef.current[sentenceId]
        setSentenceVocabularySaveStatus(sentenceId, 'saved')
      }
    } catch (error) {
      console.error('Error saving user notes:', error)
      setSentenceVocabularySaveStatus(sentenceId, 'error')
      setNotification({ type: 'error', message: '保存生词失败，请重试' })
    } finally {
      vocabularySaveInFlightRef.current[sentenceId] = false

      if (shouldSaveLatestSnapshot) {
        void runVocabularySave(sentenceId)
      }
    }
  }

  const queueVocabularySave = (
    sentenceId: string,
    items: VocabularyEntry[],
    options?: { immediate?: boolean }
  ) => {
    pendingVocabularySaveRef.current[sentenceId] = items

    const existingTimer = vocabularySaveTimersRef.current[sentenceId]
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    if (options?.immediate) {
      void runVocabularySave(sentenceId)
      return
    }

    vocabularySaveTimersRef.current[sentenceId] = setTimeout(() => {
      void runVocabularySave(sentenceId)
    }, 400)
  }

  const fetchUserNotes = async () => {
    if (!item) return

    Object.values(vocabularySaveTimersRef.current).forEach((timer) => clearTimeout(timer))
    Object.values(vocabularySaveResetTimersRef.current).forEach((timer) => clearTimeout(timer))
    Object.values(vocabularySuggestTimersRef.current).forEach((timer) => clearTimeout(timer))
    Object.values(vocabularySuggestBlurTimersRef.current).forEach((timer) => clearTimeout(timer))
    vocabularySaveTimersRef.current = {}
    vocabularySaveResetTimersRef.current = {}
    pendingVocabularySaveRef.current = {}
    vocabularySaveInFlightRef.current = {}
    vocabularySuggestTimersRef.current = {}
    vocabularySuggestRequestIdsRef.current = {}
    vocabularySuggestBlurTimersRef.current = {}

    const vocabularyEntries = await Promise.all(
      item.sentences.map(async (sentence) => {
        try {
          const response = await fetch(
            withBasePath(`/api/user-notes?sentenceId=${sentence.id}&userId=default`)
          )

          if (!response.ok) {
            throw new Error(`Failed to fetch vocabulary for sentence ${sentence.id}`)
          }

          const data = await response.json()
          return [
            sentence.id,
            {
              ...createEmptySentenceVocabularyState(),
              items: parseVocabularyWords(data.words || ''),
              saveStatus: 'idle' as const,
            },
          ] as const
        } catch (error) {
          console.error('Error fetching user notes:', error)
          return [sentence.id, createEmptySentenceVocabularyState()] as const
        }
      })
    )

    setSentenceVocabulary(Object.fromEntries(vocabularyEntries))
  }

  const toggleNotes = (sentenceId: string) => {
    const newExpanded = new Set(expandedNotes)
    if (newExpanded.has(sentenceId)) {
      newExpanded.delete(sentenceId)
    } else {
      newExpanded.add(sentenceId)
    }
    setExpandedNotes(newExpanded)
  }

  const openVocabularyEntryModal = (sentenceId: string) => {
    clearVocabularySuggestBlurTimer(sentenceId)
    setActiveVocabularyModalSentenceId(sentenceId)
  }

  const closeVocabularyEntryModal = () => {
    if (activeVocabularyModalSentenceId) {
      clearVocabularySuggestTimer(activeVocabularyModalSentenceId)
      clearVocabularySuggestBlurTimer(activeVocabularyModalSentenceId)
      closeVocabularySuggestions(activeVocabularyModalSentenceId)
    }

    setActiveVocabularyModalSentenceId(null)
  }

  const openVocabularyBook = () => {
    setIsVocabularyBookExpanded(true)
  }

  const closeVocabularyBook = () => {
    setIsVocabularyBookExpanded(false)
  }

  const toggleVocabularyBook = () => {
    setIsVocabularyBookExpanded((prev) => !prev)
  }

  const toggleSentenceTranslation = (sentenceId: string) => {
    if (showTranslations) {
      setCollapsedGlobalTranslations((prev) => {
        const next = new Set(prev)
        if (next.has(sentenceId)) {
          next.delete(sentenceId)
        } else {
          next.add(sentenceId)
        }
        return next
      })
      return
    }

    setExpandedTranslations((prev) => {
      const next = new Set(prev)
      if (next.has(sentenceId)) {
        next.delete(sentenceId)
      } else {
        next.add(sentenceId)
      }
      return next
    })
  }

  const updateVocabularyLookupState = (
    sentenceId: string,
    updater: (lookup: SentenceVocabularyLookupState) => SentenceVocabularyLookupState
  ) => {
    updateSentenceVocabularyState(sentenceId, (current) => ({
      ...current,
      lookup: updater(current.lookup),
    }))
  }

  const clearVocabularySuggestTimer = (sentenceId: string) => {
    const timer = vocabularySuggestTimersRef.current[sentenceId]
    if (timer) {
      clearTimeout(timer)
      delete vocabularySuggestTimersRef.current[sentenceId]
    }
  }

  const clearVocabularySuggestBlurTimer = (sentenceId: string) => {
    const timer = vocabularySuggestBlurTimersRef.current[sentenceId]
    if (timer) {
      clearTimeout(timer)
      delete vocabularySuggestBlurTimersRef.current[sentenceId]
    }
  }

  const closeVocabularySuggestions = (sentenceId: string) => {
    clearVocabularySuggestBlurTimer(sentenceId)
    updateVocabularyLookupState(sentenceId, (lookup) => ({
      ...lookup,
      isOpen: false,
    }))
  }

  const fetchVocabularySuggestions = async (sentenceId: string, query: string) => {
    const trimmedQuery = query.trim()

    clearVocabularySuggestTimer(sentenceId)

    if (!trimmedQuery) {
      updateVocabularyLookupState(sentenceId, () => createEmptySentenceVocabularyLookupState())
      return
    }

    const requestId = (vocabularySuggestRequestIdsRef.current[sentenceId] || 0) + 1
    vocabularySuggestRequestIdsRef.current[sentenceId] = requestId

    updateVocabularyLookupState(sentenceId, (lookup) => ({
      ...lookup,
      isLoading: true,
      isOpen: true,
    }))

    vocabularySuggestTimersRef.current[sentenceId] = setTimeout(async () => {
      try {
        const response = await fetch(withBasePath(`/api/dictionary/suggest?q=${encodeURIComponent(trimmedQuery)}`))

        if (!response.ok) {
          throw new Error(`Failed to fetch dictionary suggestions for ${trimmedQuery}`)
        }

        const data = await response.json() as { suggestions?: VocabularySuggestion[] }

        if (vocabularySuggestRequestIdsRef.current[sentenceId] !== requestId) {
          return
        }

        updateVocabularyLookupState(sentenceId, (lookup) => ({
          ...lookup,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          isLoading: false,
          isOpen: true,
        }))
      } catch (error) {
        console.error('Error fetching dictionary suggestions:', error)

        if (vocabularySuggestRequestIdsRef.current[sentenceId] !== requestId) {
          return
        }

        updateVocabularyLookupState(sentenceId, () => ({
          suggestions: [],
          isLoading: false,
          isHydrating: false,
          isOpen: false,
        }))
      }
    }, 140)
  }

  const autofillVocabularyEntry = async (sentenceId: string, word: string) => {
    clearVocabularySuggestTimer(sentenceId)
    clearVocabularySuggestBlurTimer(sentenceId)

    updateVocabularyLookupState(sentenceId, (lookup) => ({
      ...lookup,
      isHydrating: true,
      isLoading: false,
      isOpen: false,
    }))

    try {
      const response = await fetch(withBasePath(`/api/dictionary/entry?word=${encodeURIComponent(word)}`))

      if (!response.ok) {
        throw new Error(`Failed to fetch dictionary entry for ${word}`)
      }

      const data = await response.json() as {
        entry?: {
          word: string
          phonetic: string
          senses: VocabularyFormSenseDraft[]
        } | null
      }

      if (!data.entry) {
        throw new Error(`Dictionary entry missing for ${word}`)
      }

      updateSentenceVocabularyState(sentenceId, (current) => ({
        ...current,
        form: {
          headword: data.entry?.word || word,
          phonetic: data.entry?.phonetic || '',
          senses: data.entry?.senses?.length
            ? data.entry.senses
            : [createEmptyVocabularySenseDraft()],
        },
        saveStatus: 'idle',
        lookup: {
          ...current.lookup,
          suggestions: [],
          isHydrating: false,
          isLoading: false,
          isOpen: false,
        },
      }))
    } catch (error) {
      console.error('Error hydrating dictionary entry:', error)
      updateVocabularyLookupState(sentenceId, (lookup) => ({
        ...lookup,
        isHydrating: false,
        isLoading: false,
        isOpen: false,
      }))
      setNotification({ type: 'error', message: 'Offline dictionary lookup failed for this word.' })
    }
  }

  const addVocabularyItemsToSentence = (
    sentenceId: string,
    nextEntries: VocabularyEntry[],
    options?: { immediate?: boolean; resetForm?: boolean }
  ) => {
    const current = sentenceVocabulary[sentenceId] || createEmptySentenceVocabularyState()
    const mergedItems = mergeVocabularyWords(current.items, nextEntries)
    const didChange = !areVocabularyListsEqual(current.items, mergedItems)

    updateSentenceVocabularyState(sentenceId, () => ({
      ...current,
      items: mergedItems,
      form: options?.resetForm ? createEmptyVocabularyFormState() : current.form,
      saveStatus: 'idle',
      lookup: options?.resetForm ? createEmptySentenceVocabularyLookupState() : current.lookup,
    }))

    if (didChange) {
      queueVocabularySave(sentenceId, mergedItems, { immediate: options?.immediate })
    }
  }

  const updateVocabularyFormState = (
    sentenceId: string,
    updater: (form: VocabularyFormState) => VocabularyFormState
  ) => {
    updateSentenceVocabularyState(sentenceId, (current) => ({
      ...current,
      form: updater(current.form),
      saveStatus: 'idle',
    }))
  }

  const handleVocabularyHeadwordChange = (sentenceId: string, value: string) => {
    updateVocabularyFormState(sentenceId, (form) => ({
      ...form,
      headword: value,
      phonetic: '',
    }))

    void fetchVocabularySuggestions(sentenceId, value)
  }

  const handleVocabularyPhoneticChange = (sentenceId: string, value: string) => {
    updateVocabularyFormState(sentenceId, (form) => ({
      ...form,
      phonetic: value,
    }))
  }

  const handleVocabularyHeadwordFocus = (sentenceId: string) => {
    clearVocabularySuggestBlurTimer(sentenceId)
    const current = sentenceVocabulary[sentenceId] || createEmptySentenceVocabularyState()

    if (current.lookup.suggestions.length === 0) {
      return
    }

    updateVocabularyLookupState(sentenceId, (lookup) => ({
      ...lookup,
      isOpen: true,
    }))
  }

  const handleVocabularyHeadwordBlur = (sentenceId: string) => {
    clearVocabularySuggestBlurTimer(sentenceId)
    vocabularySuggestBlurTimersRef.current[sentenceId] = setTimeout(() => {
      closeVocabularySuggestions(sentenceId)
    }, 120)
  }

  const handleVocabularyHeadwordKeyDown = (
    sentenceId: string,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const current = sentenceVocabulary[sentenceId] || createEmptySentenceVocabularyState()

    if (event.key === 'Escape' && current.lookup.isOpen) {
      event.preventDefault()
      closeVocabularySuggestions(sentenceId)
      return
    }

    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      current.lookup.suggestions.length > 0
    ) {
      event.preventDefault()
      void autofillVocabularyEntry(sentenceId, current.lookup.suggestions[0].word)
    }
  }

  const handleVocabularySenseChange = (
    sentenceId: string,
    index: number,
    field: keyof VocabularyFormSenseDraft,
    value: string
  ) => {
    updateVocabularyFormState(sentenceId, (form) => ({
      ...form,
      senses: form.senses.map((sense, senseIndex) => (
        senseIndex === index
          ? { ...sense, [field]: value }
          : sense
      )),
    }))
  }

  const handleVocabularyAddSense = (sentenceId: string) => {
    updateVocabularyFormState(sentenceId, (form) => ({
      ...form,
      senses: [...form.senses, createEmptyVocabularySenseDraft()],
    }))
  }

  const handleVocabularyRemoveSense = (sentenceId: string, index: number) => {
    updateVocabularyFormState(sentenceId, (form) => {
      const nextSenses = form.senses.filter((_, senseIndex) => senseIndex !== index)

      return {
        ...form,
        senses: nextSenses.length > 0 ? nextSenses : [createEmptyVocabularySenseDraft()],
      }
    })
  }

  const handleVocabularySubmit = (sentenceId: string) => {
    const current = sentenceVocabulary[sentenceId] || createEmptySentenceVocabularyState()
    const nextEntry = buildVocabularyEntryFromForm(current.form)

    if (!nextEntry) {
      setNotification({ type: 'error', message: 'Please enter a headword, part of speech, and meaning.' })
      return false
    }

    addVocabularyItemsToSentence(sentenceId, [nextEntry], {
      immediate: true,
      resetForm: true,
    })

    return true
  }

  const handleVocabularyModalSubmit = (sentenceId: string) => {
    const didSubmit = handleVocabularySubmit(sentenceId)

    if (didSubmit) {
      closeVocabularyEntryModal()
    }
  }

  const handleVocabularyRemove = (sentenceId: string, entry: VocabularyEntry) => {
    const targetKey = getVocabularyEntryKey(entry)
    const current = sentenceVocabulary[sentenceId] || createEmptySentenceVocabularyState()
    const nextItems = current.items.filter((item) => getVocabularyEntryKey(item) !== targetKey)
    const didChange = !areVocabularyListsEqual(current.items, nextItems)

    updateSentenceVocabularyState(sentenceId, () => ({
      ...current,
      items: nextItems,
      saveStatus: 'idle',
    }))

    if (didChange) {
      queueVocabularySave(sentenceId, nextItems, { immediate: true })
    }
  }

  const getSentenceDictationState = (
    sentenceId: string,
    model: DictationSentenceModel
  ): SentenceDictationState => (
    sentenceDictation[sentenceId] || {
      inputs: createEmptyDictationInputs(model),
      submittedResult: null,
      revealModes: createEmptyDictationRevealModes(model),
    }
  )

  const updateSentenceDictationState = (
    sentenceId: string,
    model: DictationSentenceModel,
    updater: (current: SentenceDictationState) => SentenceDictationState
  ) => {
    setSentenceDictation((prev) => {
      const current = prev[sentenceId] || {
        inputs: createEmptyDictationInputs(model),
        submittedResult: null,
        revealModes: createEmptyDictationRevealModes(model),
      }

      return {
        ...prev,
        [sentenceId]: updater(current),
      }
    })
  }

  const setDictationInputRef = (
    sentenceId: string,
    wordIndex: number,
    element: HTMLInputElement | null
  ) => {
    if (!dictationInputRefs.current[sentenceId]) {
      dictationInputRefs.current[sentenceId] = []
    }

    dictationInputRefs.current[sentenceId][wordIndex] = element
  }

  const focusDictationInput = (
    sentenceId: string,
    wordIndex: number,
    placement: 'start' | 'end' = 'end'
  ) => {
    const input = dictationInputRefs.current[sentenceId]?.[wordIndex]

    if (!input) {
      return
    }

    input.focus()

    const cursorPosition = placement === 'start' ? 0 : input.value.length
    window.requestAnimationFrame(() => {
      input.setSelectionRange(cursorPosition, cursorPosition)
    })
  }

  const toggleDictationRevealMode = (
    sentenceId: string,
    model: DictationSentenceModel,
    wordIndex: number,
    nextMode: Exclude<DictationRevealMode, 'hidden'>
  ) => {
    updateSentenceDictationState(sentenceId, model, (current) => {
      const nextRevealModes = [...current.revealModes]
      nextRevealModes[wordIndex] = current.revealModes[wordIndex] === nextMode ? 'hidden' : nextMode

      return {
        ...current,
        revealModes: nextRevealModes,
      }
    })

    focusDictationInput(sentenceId, wordIndex)
  }

  const handleDictationInputChange = (
    sentenceId: string,
    model: DictationSentenceModel,
    wordIndex: number,
    value: string
  ) => {
    lastDictationInputAtRef.current = Date.now()

    const word = model.words[wordIndex]

    if (!word) {
      return
    }

    const sanitizedValue = sanitizeDictationInput(value).slice(0, word.maxLength)

    updateSentenceDictationState(sentenceId, model, (current) => {
      const nextInputs = [...current.inputs]
      nextInputs[wordIndex] = sanitizedValue

      return {
        ...current,
        inputs: nextInputs,
        submittedResult: null,
      }
    })
  }

  const handleDictationKeyDown = (
    sentenceId: string,
    model: DictationSentenceModel,
    wordIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    lastDictationInputAtRef.current = Date.now()

    const word = model.words[wordIndex]

    if (!word) {
      return
    }

    const loweredKey = event.key.toLowerCase()

    if (event.ctrlKey && !event.metaKey && !event.altKey) {
      if (loweredKey === 'i') {
        event.preventDefault()
        toggleDictationRevealMode(sentenceId, model, wordIndex, 'initial')
        return
      }

      if (loweredKey === 'l') {
        event.preventDefault()
        toggleDictationRevealMode(sentenceId, model, wordIndex, 'full')
        return
      }
    }

    const currentValue = sanitizeDictationInput(event.currentTarget.value)
    const isCharacterKey =
      event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey

    if (event.key === 'Backspace' && currentValue.length === 0 && wordIndex > 0) {
      event.preventDefault()
      focusDictationInput(sentenceId, wordIndex - 1)
      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      if (currentValue.length >= word.maxLength && wordIndex < model.words.length - 1) {
        focusDictationInput(sentenceId, wordIndex + 1, 'start')
      }
      return
    }

    if (isCharacterKey && !/^[a-zA-Z0-9]$/.test(event.key)) {
      event.preventDefault()
      return
    }

    if (
      isCharacterKey
      && /^[a-zA-Z0-9]$/.test(event.key)
      && currentValue.length >= word.maxLength
      && event.currentTarget.selectionStart === event.currentTarget.selectionEnd
    ) {
      event.preventDefault()
    }
  }

  const handleDictationSubmit = (
    sentenceId: string,
    model: DictationSentenceModel
  ) => {
    updateSentenceDictationState(sentenceId, model, (state) => ({
      ...state,
      submittedResult: evaluateDictationSentence(model, state.inputs),
    }))
  }

  const getDictationWordWidth = (displayText: string, maxLength: number) => {
    const visibleLength = Math.max(displayText.length, maxLength)
    return `${Math.min(220, Math.max(52, visibleLength * 13 + 22))}px`
  }

  const scrollToSentence = (sentenceId: string) => {
    if (!item) return

    setExpandedNotes((prev) => {
      const next = new Set(prev)
      next.add(sentenceId)
      return next
    })

    const sentenceIndex = item.sentences.findIndex((sentence) => sentence.id === sentenceId)
    if (sentenceIndex === -1) {
      return
    }

    const sentenceElement = sentenceRefs.current[sentenceIndex]
    const container = contentRef.current

    if (sentenceElement && container) {
      scrollSentenceWithinContainer(container, sentenceElement, 'smooth')
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current || !item) return
    const time = audioRef.current.currentTime

    if (repeatMode !== null && item.sentences[repeatMode]) {
      const sentence = item.sentences[repeatMode]
      if (time >= sentence.endTime) {
        audioRef.current.currentTime = sentence.startTime
      }
    }

    setCurrentTime(time)

    const index = item.sentences.findIndex(
      (s) => time >= s.startTime && time < s.endTime
    )
    setCurrentSentenceIndex(index)
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = parseFloat(e.target.value)
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const jumpToSentenceByIndex = (
    index: number,
    options?: { preserveRepeat?: boolean; scrollBehavior?: ScrollBehavior }
  ) => {
    if (!item || index < 0 || index >= item.sentences.length) {
      return
    }

    const sentence = item.sentences[index]

    if (!options?.preserveRepeat && repeatMode !== null && repeatMode !== index) {
      setRepeatMode(null)
    }

    if (audioRef.current) {
      audioRef.current.currentTime = sentence.startTime
      audioRef.current.play()
      setIsPlaying(true)
    }

    setCurrentSentenceIndex(index)

    const sentenceElement = sentenceRefs.current[index]
    const container = contentRef.current

    if (sentenceElement && container) {
      scrollSentenceWithinContainer(container, sentenceElement, options?.scrollBehavior || 'smooth')
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleSentenceClick = (sentence: Sentence) => {
    if (!item) {
      return
    }

    const sentenceIndex = item.sentences.findIndex((candidate) => candidate.id === sentence.id)

    if (sentenceIndex !== -1) {
      jumpToSentenceByIndex(sentenceIndex)
    }
  }

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate)
  }

  const handleRepeatClick = (index: number) => {
    if (repeatMode === index) {
      setRepeatMode(null)
    } else {
      setRepeatMode(index)
      jumpToSentenceByIndex(index, { preserveRepeat: true })
    }
  }

  const vocabularyBook = item
    ? buildVocabularyBook(item.sentences, sentenceVocabulary)
    : []
  const totalVocabularyEntries = item
    ? item.sentences.reduce(
        (total, sentence) => (
          total
          + (
            sentenceVocabulary[sentence.id]?.items.filter((entry) => formatVocabularyEntry(entry).trim().length > 0).length
            || 0
          )
        ),
        0
      )
    : 0
  const activeSentenceLabel =
    item && currentSentenceIndex >= 0
      ? `S${item.sentences[currentSentenceIndex].order + 1}`
      : null
  const dictationModels: Record<string, DictationSentenceModel> = item
    ? Object.fromEntries(
        item.sentences.map((sentence) => [sentence.id, buildDictationSentenceModel(sentence.text)])
      )
    : {}
  const selectedSentenceFont = getTrainingSentenceFontOption(selectedSentenceFontId)
  const activeVocabularyModalSentence = item && activeVocabularyModalSentenceId
    ? item.sentences.find((sentence) => sentence.id === activeVocabularyModalSentenceId) || null
    : null
  const activeVocabularyModalState = activeVocabularyModalSentence
    ? sentenceVocabulary[activeVocabularyModalSentence.id] || createEmptySentenceVocabularyState()
    : null
  const activeVocabularyModalLookup = activeVocabularyModalState?.lookup || createEmptySentenceVocabularyLookupState()
  const isActiveVocabularyModalFormReady = activeVocabularyModalState
    ? isVocabularyFormSubmittable(activeVocabularyModalState.form)
    : false
  const isModernFocusLayout = isFocusMode
  const trainingShellClassName = isFullscreen
    ? isModernFocusLayout
      ? 'training-focus-shell relative z-10 flex h-full flex-col gap-6 px-6 py-6 md:gap-8 md:px-8 md:py-8 xl:gap-10 xl:px-10 xl:py-10'
      : 'relative z-10 flex h-full flex-col gap-6 px-10 py-8 md:gap-7 md:px-12 md:py-9 xl:gap-8 xl:px-16 xl:py-12'
    : isModernFocusLayout
      ? 'training-focus-shell relative z-10 flex flex-col gap-6 px-5 py-5 md:gap-7 md:px-7 md:py-7 xl:gap-8 xl:px-8 xl:py-8'
      : 'relative z-10 flex flex-col gap-5 px-8 py-6 md:gap-6 md:px-10 md:py-7 xl:gap-7 xl:px-12 xl:py-8'
  const trainingOuterInsetClassName = isModernFocusLayout
    ? ''
    : isFullscreen
      ? 'mx-4 md:mx-6 xl:mx-8'
      : 'mx-2 md:mx-3 xl:mx-4'
  const headerPanelClassName = isModernFocusLayout
    ? 'training-focus-header px-5 py-5 md:px-6 md:py-6 xl:px-7'
    : `training-future-commanddeck ${trainingOuterInsetClassName} px-4 py-3 md:px-5 md:py-4`
  const contentPanelClassName = `${isModernFocusLayout ? 'training-focus-content' : 'training-future-content'} ${trainingOuterInsetClassName} training-hud-content min-h-0 ${
    isFullscreen ? 'flex-1' : ''
  }`
  const contentInnerClassName = isModernFocusLayout
    ? 'relative px-5 py-5 md:px-6 md:py-6 xl:px-7 xl:py-7'
    : 'relative px-4 py-4 md:px-5 md:py-5 xl:px-6 xl:py-6'
  const hudPanelClassName = isModernFocusLayout ? 'training-focus-panel' : 'training-future-panel'
  const hudPanelHeaderClassName = isModernFocusLayout ? 'training-focus-panel-header' : 'training-future-panel-header'
  const controlShellClassName = isModernFocusLayout ? 'training-focus-control-shell' : 'training-future-control-shell'
  const toolbarButtonClassName = isModernFocusLayout ? 'training-focus-toolbar-button' : 'training-future-toolbar-button'
  const selectClassName = isModernFocusLayout ? 'training-focus-select' : 'training-future-select'
  const streamHeaderClassName = isModernFocusLayout
    ? 'training-focus-stream-header mb-8 flex flex-col gap-4 pb-6 md:mb-9 md:flex-row md:items-end md:justify-between'
    : 'training-future-stream-header mb-6 flex flex-col gap-3 pb-5 md:mb-7 md:flex-row md:items-end md:justify-between'
  const mainGridClassName = isModernFocusLayout
    ? 'flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.12fr)_320px] xl:items-start xl:gap-10'
    : 'flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start'
  const sidebarClassName = isModernFocusLayout
    ? 'order-1 xl:order-2 xl:sticky xl:top-0 training-focus-sidebar'
    : 'order-1 xl:order-2 xl:sticky xl:top-0'
  const mainSectionClassName = isModernFocusLayout
    ? 'order-2 min-w-0 xl:order-1 training-focus-main'
    : 'order-2 min-w-0 xl:order-1'
  const sentenceListClassName = isModernFocusLayout
    ? 'space-y-6 md:space-y-8 xl:space-y-9'
    : 'pl-5 md:pl-5 xl:pl-5 space-y-6 md:space-y-7 xl:space-y-8'
  const sentenceCardClassName = isModernFocusLayout ? 'training-focus-sentence-card' : 'training-future-sentence-card'
  const sentenceGlowClassName = isModernFocusLayout ? 'training-focus-sentence-glow' : 'training-future-sentence-glow'
  const sentenceRailClassName = isModernFocusLayout ? 'training-focus-sentence-rail' : 'training-future-sentence-rail'
  const sentenceDividerClassName = isModernFocusLayout ? 'training-focus-sentence-divider' : 'training-future-sentence-divider'
  const sentenceBodyClassName = isModernFocusLayout
    ? 'relative z-10 px-6 py-5 md:px-7 md:py-6 xl:px-8 xl:py-7'
    : 'relative z-10 pr-4 pl-5 py-[14px] md:pr-[18px] md:pl-6 md:py-4 xl:pr-5 xl:pl-7 xl:py-[18px]'
  const readingSurfaceClassName = isModernFocusLayout ? 'training-focus-reading-surface' : 'training-future-reading-surface'
  const dictationSurfaceClassName = isModernFocusLayout ? 'training-focus-dictation-surface' : 'training-future-dictation-surface'
  const insetClassName = isModernFocusLayout ? 'training-focus-inset' : 'training-future-inset'
  const denseInsetClassName = isModernFocusLayout
    ? 'training-focus-inset training-focus-inset--dense'
    : 'training-future-inset training-future-inset--dense'
  const warningInsetClassName = isModernFocusLayout
    ? 'training-focus-inset training-focus-inset--warning'
    : 'training-future-inset training-future-inset--warning'
  const reviewInsetClassName = isModernFocusLayout
    ? 'training-focus-inset training-focus-inset--review'
    : 'training-future-inset training-future-inset--review'
  const formInsetClassName = isModernFocusLayout
    ? 'training-focus-inset training-focus-inset--form'
    : 'training-future-inset training-future-inset--form'
  const recordClassName = isModernFocusLayout ? 'training-focus-record' : 'training-future-record'
  const statBoxClassName = isModernFocusLayout ? 'training-focus-stat-box' : 'training-future-stat-box'
  const miniButtonClassName = isModernFocusLayout ? 'training-focus-mini-button' : 'training-future-mini-button'
  const streamCountBadgeClassName = isModernFocusLayout
    ? 'training-focus-pill'
    : 'rounded-full border border-green-500/[0.16] bg-black/20 px-2.5 py-1'
  const activeSentenceBadgeClassName = isModernFocusLayout
    ? 'training-focus-pill training-focus-pill--active'
    : 'rounded-full border border-green-400/[0.18] bg-green-500/[0.08] px-2.5 py-1 text-green-300/80'
  const sentenceTimeBadgeClassName = isModernFocusLayout
    ? 'training-focus-meta-pill'
    : 'rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2.5 py-1 text-green-500/[0.58]'
  const vocabularyCountBadgeClassName = isModernFocusLayout
    ? 'training-focus-meta-pill text-[10px]'
    : 'rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-[10px] cyber-label text-green-500/[0.6]'
  const getSentenceOrderBadgeClassName = (isActive: boolean) =>
    isModernFocusLayout
      ? `training-focus-order-pill ${isActive ? 'is-active' : ''}`
      : `inline-flex min-w-[3.25rem] justify-center rounded-full border px-2 py-1 ${
          isActive
            ? 'border-green-400/35 bg-green-500/15 text-green-200'
            : 'border-green-500/20 bg-black/30 text-green-400/70'
        }`
  const getVocabularySaveStatusMeta = (saveStatus: SaveStatus) => {
    switch (saveStatus) {
      case 'saving':
        return {
          label: '[SAVING...]',
          className: 'text-amber-300/80',
        }
      case 'saved':
        return {
          label: '[SAVED]',
          className: 'text-green-300/80',
        }
      case 'error':
        return {
          label: '[ERROR]',
          className: 'text-red-300/80',
        }
      default:
        return null
    }
  }

  const renderDictationReview = (
    model: DictationSentenceModel,
    result: DictationSentenceResult
  ) => (
    <div className={`${reviewInsetClassName} mt-3 px-4 py-3`}>
      <div className={`mb-2 text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-500/85' : 'text-green-500/40'}`}>
        {isModernFocusLayout ? 'Checked line' : 'VERIFIED SENTENCE'}
      </div>
      <div className={`max-w-[46rem] text-[15px] leading-[1.9] ${isModernFocusLayout ? 'text-slate-100' : 'text-green-100/92'}`}>
        {model.segments.map((segment, segmentIndex) => (
          <span key={`review-segment-${segmentIndex}`}>
            {segmentIndex > 0 ? ' ' : null}
            {segment.tokens.map((token, tokenIndex) => {
              if (token.type !== 'word') {
                return (
                  <span key={`review-token-${segmentIndex}-${tokenIndex}`} className={isModernFocusLayout ? 'text-slate-400/85' : 'text-green-300/80'}>
                    {token.value}
                  </span>
                )
              }

              const reviewEntry = result.entries[token.wordIndex]

              if (!reviewEntry) {
                return (
                  <span key={`review-token-${segmentIndex}-${tokenIndex}`} className={isModernFocusLayout ? 'text-slate-100' : 'text-green-100/92'}>
                    {token.displayText}
                  </span>
                )
              }

              return (
                <span
                  key={`review-token-${segmentIndex}-${tokenIndex}`}
                  className={
                    reviewEntry.isCorrect
                      ? isModernFocusLayout
                        ? 'text-slate-100'
                        : 'text-green-100/92'
                      : 'text-red-300 underline decoration-red-400/70 decoration-dotted underline-offset-4'
                  }
                  title={reviewEntry.isCorrect ? undefined : `你写的是 ${reviewEntry.actual || '空白'}`}
                >
                  {token.displayText}
                </span>
              )
            })}
          </span>
        ))}
      </div>
    </div>
  )


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyan-400 cyber-title text-xl animate-pulse cyber-neon">[ 加载中... ]</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 cyber-title text-xl">[ 未找到训练条目 ]</div>
      </div>
    )
  }

  return (
    <div 
      data-training-page
      data-focus-mode={isFocusMode ? 'true' : 'false'}
      className={`min-h-screen relative flex items-center justify-center transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-[100] training-fullscreen' : ''
      } ${
        isFocusMode ? 'training-focus-mode' : ''
      }`}
      style={isFullscreen ? {} : { paddingBottom: '45vh', paddingTop: '10vh' }}
    >
        {/* HUD灞忓箷瀹瑰櫒 - 璧涘崥鏈嬪厠缁胯壊涓婚 */}
        <div 
          className={`mx-auto relative transition-all duration-300 ${
            isFullscreen ? 'w-[98%] h-[98vh]' : 'w-[95%] max-w-6xl'
          }`}
          style={{ zIndex: isFullscreen ? 100 : 50 }}
        >
          {/* 涓籋UD灞忓箷 - 鍗婇€忔槑 */}
          <div
            data-training-frame
            className={`relative rounded-lg overflow-hidden transition-all duration-300 ${
            isFocusMode
              ? 'training-focus-frame border border-slate-700/70 bg-[#0d1217]/95 backdrop-blur-sm'
              : 'backdrop-blur-md border-2 border-green-500/50 shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)]'
          } ${
            isFullscreen
              ? isFocusMode ? 'h-full bg-[#0b1014]/96' : 'bg-black/30 h-full'
              : isFocusMode ? 'bg-[#0d1217]/94' : 'bg-black/40'
          }`}
            style={{
            boxShadow: isFocusMode
              ? '0 14px 42px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.02)'
              : '0 0 40px rgba(10,255,10,0.25), inset 0 0 30px rgba(10,255,10,0.1), 0 0 60px rgba(10,255,10,0.15)'
          }}
          >
            {!isFocusMode && (
              <>
                {/* 杈规鍙戝厜鏁堟灉 */}
                <div className="absolute inset-0 border-2 border-green-400/20 rounded-lg pointer-events-none animate-pulse" style={{
                  boxShadow: 'inset 0 0 15px rgba(10,255,10,0.2), 0 0 20px rgba(10,255,10,0.15)'
                }}></div>
                
                {/* 鑳介噺娉㈠姩鏁堟灉 */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(10,255,10,0.04)_40%,transparent_70%)] animate-pulse" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,transparent_0%,rgba(10,255,10,0.03)_30%,transparent_60%)] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
                </div>

                {/* 绮掑瓙鑳屾櫙鏁堟灉 */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-green-400/20 rounded-full animate-pulse"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${2 + Math.random() * 2}s`,
                        boxShadow: '0 0 3px rgba(10,255,10,0.4)'
                      }}
                    ></div>
                  ))}
                </div>
                {/* HUD缃戞牸鑳屾櫙 - 澧炲己鐗?*/}
                <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>
                
                {/* 缃戞牸鍏夌偣鏁堟灉 */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => {
                    const x = (i % 5) * 25 + 12.5
                    const y = Math.floor(i / 5) * 20 + 10
                    return (
                      <div
                        key={i}
                        className="absolute w-0.5 h-0.5 bg-green-400/25 rounded-full animate-pulse"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          animationDelay: `${i * 0.2}s`,
                          animationDuration: '2s',
                          boxShadow: '0 0 2px rgba(10,255,10,0.5)'
                        }}
                      ></div>
                    )
                  })}
                </div>

                {/* 鎵弿绾挎晥鏋?- 澶氬眰 */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.02),rgba(10,255,10,0.01),rgba(10,255,10,0.02))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-30"></div>
                
                {/* 鍨傜洿鎵弿绾?*/}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(10,255,10,0.05)_50%,transparent_100%)] bg-[length:100%_4px] pointer-events-none opacity-20 animate-scan-vertical" style={{ animationDuration: '3s' }}></div>
                
                {/* 姘村钩鎵弿绾?*/}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(10,255,10,0.04)_50%,transparent_100%)] bg-[length:4px_100%] pointer-events-none opacity-15 animate-shimmer" style={{ animationDuration: '4s' }}></div>

                {/* 瑙掕惤瑁呴グ - 澧炲己鐗?*/}
                {/* 宸︿笂瑙?*/}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50 pointer-events-none">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-green-400/40"></div>
                  <div className="absolute top-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
                  <div className="absolute top-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
                  <div className="absolute top-0 left-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
                </div>
                
                {/* 鍙充笂瑙?*/}
                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50 pointer-events-none">
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-green-400/40"></div>
                  <div className="absolute top-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
                  <div className="absolute top-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
                  <div className="absolute top-0 right-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
                </div>
                
                {/* 宸︿笅瑙?*/}
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50 pointer-events-none">
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-green-400/40"></div>
                  <div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
                  <div className="absolute bottom-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
                </div>
                
                {/* 鍙充笅瑙?*/}
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50 pointer-events-none">
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-green-400/40"></div>
                  <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
                  <div className="absolute bottom-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
                  <div className="absolute bottom-0 right-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
                </div>
                
                {/* 杈圭紭鍏夋晥 */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
                <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
                <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
              </>
            )}

          {/* 閫氱煡鎻愮ず */}
          {notification && (
            <div className={`fixed top-4 right-4 z-[300] px-6 py-4 rounded-lg border-2 shadow-lg backdrop-blur-md transition-all ${
              notification.type === 'success' 
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : notification.type === 'error'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            }`}>
              <div className="flex items-center gap-3">
                <span className="cyber-button-text text-sm">{notification.message}</span>
                <button
                  onClick={() => setNotification(null)}
                  className="text-current hover:opacity-70 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className={trainingShellClassName}>
            <div className={headerPanelClassName}>
              <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className={`${isModernFocusLayout ? 'training-focus-kicker text-slate-400/85' : 'training-future-kicker text-green-400/75'} inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] cyber-label tracking-[0.28em]`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isModernFocusLayout ? 'bg-slate-300/80 shadow-[0_0_0_3px_rgba(148,163,184,0.08)]' : 'bg-green-400/70 shadow-[0_0_4px_rgba(10,255,10,0.45)]'}`}></span>
                    <span>{isModernFocusLayout ? 'FOCUSED SESSION' : 'TRAINING MODULE'}</span>
                  </div>
                  <h1 className={`mt-3 max-w-4xl break-words text-2xl leading-tight cyber-title md:text-3xl xl:text-[2rem] ${
                    isModernFocusLayout ? 'training-focus-title text-slate-50' : 'text-green-100'
                  }`}>
                    {item.title}
                  </h1>
                  <div className={`mt-2 text-[11px] cyber-label tracking-[0.18em] ${
                    isModernFocusLayout ? 'training-focus-subtitle text-slate-400/80' : 'text-green-500/45'
                  }`}>
                    {isModernFocusLayout
                      ? 'A quieter reading space for deliberate listening, review and repetition.'
                      : 'FOCUSED LISTENING SESSION'}
                  </div>
                </div>
                <div className={`${isModernFocusLayout ? 'training-focus-toolbar' : 'training-future-toolbar'} flex flex-wrap items-center gap-2 xl:max-w-[52%] xl:justify-end`}>
                  <div className={`${controlShellClassName} relative flex items-center gap-2 px-3 py-1.5 text-xs ${isModernFocusLayout ? 'text-slate-300/85 shadow-none' : 'text-green-400/70 shadow-[0_0_12px_rgba(10,255,10,0.05)]'}`}>
                    <span className={`text-[10px] cyber-label tracking-[0.22em] ${isModernFocusLayout ? 'text-slate-400/78' : 'text-green-400/70'}`}>
                      READ FONT
                    </span>
                    <div className="relative min-w-[168px]">
                      <select
                        value={selectedSentenceFontId}
                        onChange={(event) => {
                          const nextFontId = event.target.value
                          if (isTrainingSentenceFontId(nextFontId)) {
                            setSelectedSentenceFontId(nextFontId)
                          }
                        }}
                        className={`training-font-select ${selectClassName} h-7 w-full appearance-none rounded px-2.5 pr-8 text-[12px] outline-none transition-all ${
                          isModernFocusLayout ? 'text-slate-100' : 'text-green-100'
                        }`}
                        aria-label="Training sentence font"
                        title="Change English sentence font"
                      >
                        {TRAINING_SENTENCE_FONT_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                          isModernFocusLayout ? 'text-slate-400/75' : 'text-green-400/75'
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 011.08 1.04l-4.25 4.512a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className={`${toolbarButtonClassName} group/btn relative flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${isModernFocusLayout ? 'text-slate-300/85 hover:text-slate-50' : 'text-green-400/70 hover:text-green-300'} transition-all`}
                    style={{ zIndex: 100 }}
                  >
                    <div className={`absolute inset-0 rounded opacity-0 transition-opacity group-hover/btn:opacity-100 ${
                      isModernFocusLayout
                        ? 'bg-gradient-to-r from-transparent via-slate-300/8 to-transparent'
                        : 'bg-gradient-to-r from-transparent via-green-500/6 to-transparent'
                    }`}></div>
                    <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="relative z-10 cyber-button-text">EDIT</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTrainingItem}
                    disabled={isDeleting}
                    className={`${toolbarButtonClassName} group/btn relative flex items-center gap-2 px-3 py-1.5 text-xs transition-all ${
                      isDeleting
                        ? 'cursor-not-allowed text-red-300/45'
                        : isModernFocusLayout
                          ? 'cursor-pointer text-red-300/78 hover:text-red-200'
                          : 'cursor-pointer text-red-300/70 hover:text-red-200'
                    }`}
                    style={{ zIndex: 100 }}
                    title={isDeleting ? 'Deleting training...' : 'Delete this training article'}
                  >
                    <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-red-500/8 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100"></div>
                    <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                    <span className="relative z-10 cyber-button-text">{isDeleting ? 'DELETING' : 'DELETE'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`${toolbarButtonClassName} group/btn relative flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${isModernFocusLayout ? 'text-slate-300/85 hover:text-slate-50' : 'text-green-400/70 hover:text-green-300'} transition-all`}
                    style={{ zIndex: 100 }}
                    title={isFullscreen ? '缩小' : '全屏'}
                  >
                    <div className={`absolute inset-0 rounded opacity-0 transition-opacity group-hover/btn:opacity-100 ${
                      isModernFocusLayout
                        ? 'bg-gradient-to-r from-transparent via-slate-300/8 to-transparent'
                        : 'bg-gradient-to-r from-transparent via-green-500/6 to-transparent'
                    }`}></div>
                    {isFullscreen ? (
                      <>
                        <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                        <span className="relative z-10 cyber-button-text">MINIMIZE</span>
                      </>
                    ) : (
                      <>
                        <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span className="relative z-10 cyber-button-text">MAXIMIZE</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className={`${toolbarButtonClassName} group/btn relative cursor-pointer px-3 py-1.5 text-xs ${isModernFocusLayout ? 'text-slate-300/85 hover:text-slate-50' : 'text-green-400/70 hover:text-green-300'} transition-all`}
                    style={{ zIndex: 100 }}
                  >
                    <div className={`absolute inset-0 rounded opacity-0 transition-opacity group-hover/btn:opacity-100 ${
                      isModernFocusLayout
                        ? 'bg-gradient-to-r from-transparent via-slate-300/8 to-transparent'
                        : 'bg-gradient-to-r from-transparent via-green-500/6 to-transparent'
                    }`}></div>
                    <span className="relative z-10 cyber-button-text">← BACK</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 鍐呭鍖哄煙 - 甯﹁嚜瀹氫箟婊氬姩鏉★紙浠呭湪HUD灞忓箷鍙充晶锛?*/}
            <div
              ref={contentRef}
              className={`${contentPanelClassName} relative`}
              style={{
                maxHeight: isFullscreen ? undefined : '75vh',
              }}
            >
              <div className={contentInnerClassName}>
                <div className={mainGridClassName}>
              <aside className={sidebarClassName}>
                <div className="space-y-6">
                  <div className={`${hudPanelClassName} ${isModernFocusLayout ? '' : 'training-vocabulary-book-panel'} p-4 md:p-5`}>
                    {!isModernFocusLayout && (
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,255,10,0.05)_0%,transparent_55%)] opacity-60"></div>
                    )}
                    <div className={hudPanelHeaderClassName}>
                      <div className="flex items-center gap-3">
                        <div className={`h-4 w-1 ${isModernFocusLayout ? 'bg-slate-300/70' : 'bg-green-500/80'}`}></div>
                        <div>
                          <h3 className={`text-sm cyber-label tracking-[0.28em] ${isModernFocusLayout ? 'text-slate-100' : 'text-green-300'}`}>
                            {isModernFocusLayout ? 'Audio player' : 'AUDIO PLAYER'}
                          </h3>
                          <div className={`mt-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80 tracking-[0.16em]' : 'text-green-500/50'}`}>
                            {isModernFocusLayout ? 'Timeline, playback and speed' : 'TIMELINE / PLAYBACK / SPEED'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <audio
                      ref={audioRef}
                      src={getAudioSrc(item.audioUrl)}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onLoadedData={() => setAudioLoaded(true)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />

                    {!audioLoaded ? (
                      <div className="relative z-10 py-8 text-center">
                        <div className={`inline-flex items-center gap-2 text-sm cyber-text ${isModernFocusLayout ? 'text-slate-400/80' : 'text-green-400/70'}`}>
                          <div className={`h-2 w-2 rounded-full ${isModernFocusLayout ? 'bg-slate-300' : 'bg-green-400 animate-pulse'}`}></div>
                          <span>{isModernFocusLayout ? 'Loading audio...' : '[ LOADING AUDIO... ]'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10 space-y-4">
                        <div className="relative">
                          <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className={`audio-slider h-2 w-full cursor-pointer appearance-none rounded-lg ${isModernFocusLayout ? 'bg-slate-800/80' : 'bg-black/60'}`}
                            style={{
                              background: isModernFocusLayout
                                ? `linear-gradient(to right, rgba(148,163,184,0.88) 0%, rgba(148,163,184,0.88) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(51,65,85,0.82) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(51,65,85,0.82) 100%)`
                                : `linear-gradient(to right, rgba(10,255,10,0.58) 0%, rgba(10,255,10,0.58) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) 100%)`
                            }}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                          <button
                            type="button"
                            onClick={handlePlayPause}
                            className={`training-focus-play-button flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all ${
                              isModernFocusLayout
                                ? 'border-slate-500/40 bg-slate-200/[0.04] hover:border-slate-400/70 hover:bg-slate-200/[0.08]'
                                : 'border-green-500/45 bg-green-500/10 hover:border-green-500/70 hover:bg-green-500/20'
                            }`}
                            style={{ boxShadow: isModernFocusLayout ? '0 8px 18px rgba(0,0,0,0.18)' : '0 0 15px rgba(10,255,10,0.25)' }}
                            title="播放/暂停 (空格)"
                          >
                            {isPlaying ? (
                              <svg className={`h-6 w-6 ${isModernFocusLayout ? 'text-slate-100' : 'text-green-400'}`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                              </svg>
                            ) : (
                              <svg className={`ml-1 h-6 w-6 ${isModernFocusLayout ? 'text-slate-100' : 'text-green-400'}`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            )}
                          </button>

                          <div className="grid grid-cols-3 gap-2">
                            <div className={`${statBoxClassName} rounded-lg px-2 py-2 text-center`}>
                              <div className={`mb-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/55'}`}>{isModernFocusLayout ? 'Current' : 'CURRENT'}</div>
                              <div className={`text-sm cyber-number cyber-tabular ${isModernFocusLayout ? 'text-slate-100' : 'text-green-300'}`}>{formatTime(currentTime)}</div>
                            </div>
                            <div className={`${statBoxClassName} rounded-lg px-2 py-2 text-center`}>
                              <div className={`mb-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/55'}`}>{isModernFocusLayout ? 'Total' : 'TOTAL'}</div>
                              <div className={`text-sm cyber-number cyber-tabular ${isModernFocusLayout ? 'text-slate-300/90' : 'text-green-300/80'}`}>{formatTime(duration)}</div>
                            </div>
                            <div className={`${statBoxClassName} rounded-lg px-2 py-2 text-center`}>
                              <div className={`mb-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/55'}`}>{isModernFocusLayout ? 'Progress' : 'PROGRESS'}</div>
                              <div className={`text-sm cyber-number cyber-tabular ${isModernFocusLayout ? 'text-slate-100' : 'text-green-300'}`}>
                                {duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`border-t pt-3 ${isModernFocusLayout ? 'border-slate-700/70' : 'border-green-500/15'}`}>
                          <div className={`mb-2 text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/50'}`}>
                            {isModernFocusLayout ? 'Speed' : 'SPEED CONTROL'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 0.75, 1, 1.25, 1.5].map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => handleSpeedChange(rate)}
                                className={`${miniButtonClassName} rounded px-3 py-1 text-xs cyber-button-text transition-all ${
                                  playbackRate === rate
                                    ? isModernFocusLayout
                                      ? 'border-slate-300/60 bg-slate-200/[0.1] text-slate-50'
                                      : 'border-green-500/70 bg-green-500/25 text-green-200'
                                    : isModernFocusLayout
                                      ? 'border-slate-700/60 bg-slate-950/35 text-slate-400 hover:border-slate-500/70 hover:bg-slate-800/45 hover:text-slate-200'
                                      : 'border-green-500/25 bg-black/35 text-green-400/70 hover:border-green-500/45 hover:bg-green-500/10'
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={`${insetClassName} rounded-lg px-3 py-2`}>
                          <div className="flex h-4 items-end gap-1">
                            {PLAYER_VISUALIZER_BARS.map((height, index) => (
                              <div
                                key={index}
                                className={`flex-1 rounded-t transition-all duration-150 ${isModernFocusLayout ? 'bg-slate-300/35' : 'bg-green-500/35'}`}
                                style={{
                                  height: `${height}%`,
                                  opacity: isPlaying ? 0.95 : 0.45,
                                  boxShadow: isPlaying
                                    ? isModernFocusLayout
                                      ? '0 0 6px rgba(148,163,184,0.16)'
                                      : '0 0 5px rgba(10,255,10,0.35)'
                                    : 'none',
                                }}
                              ></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`${hudPanelClassName} p-4 md:p-5`}>
                    {isDictationMode && (
                      <>
                        <div className={`${hudPanelHeaderClassName} mb-0`}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-4 w-1 bg-amber-400/80"></div>
                            <div className="min-w-0">
                              <div className={`text-sm cyber-label tracking-[0.28em] ${isModernFocusLayout ? 'text-amber-100' : 'text-amber-200'}`}>{isModernFocusLayout ? 'Dictation lock' : 'DICTATION LOCK'}</div>
                              <div className={`mt-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-amber-300/55'}`}>
                                Vocabulary and translations stay hidden while dictation mode is active.
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={`${warningInsetClassName} mt-4 rounded-lg px-4 py-5 text-center`}>
                          <div className={`text-sm cyber-text ${isModernFocusLayout ? 'text-slate-200/88' : 'text-amber-100/80'}`}>Listen first. Reveal notes after you finish the line.</div>
                          <div className={`mt-2 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-amber-300/55'}`}>
                            Turn off dictation mode to reopen the vocabulary book.
                          </div>
                        </div>
                      </>
                    )}
                    {!isDictationMode && (
                      <>
                    <div className={`${hudPanelHeaderClassName} training-vocabulary-book-header mb-0`}>
                      <button
                        type="button"
                        onClick={toggleVocabularyBook}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-expanded={isVocabularyBookExpanded}
                        aria-label={isVocabularyBookExpanded ? 'Hide vocabulary book' : 'Show vocabulary book'}
                      >
                        <div className={`h-4 w-1 ${isModernFocusLayout ? 'bg-slate-300/70' : 'bg-green-500/80'}`}></div>
                        <div className="min-w-0">
                          <div className={`text-sm cyber-label tracking-[0.28em] ${isModernFocusLayout ? 'text-slate-100' : 'text-green-300'}`}>{isModernFocusLayout ? 'Vocabulary notebook' : 'VOCABULARY BOOK'}</div>
                          <div className={`mt-1 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80 tracking-[0.16em]' : 'text-green-500/50'}`}>
                            {vocabularyBook.length} UNIQUE / {totalVocabularyEntries} TOTAL
                          </div>
                        </div>
                      </button>
                      <div className="training-vocabulary-book-actions flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={isVocabularyBookExpanded ? closeVocabularyBook : openVocabularyBook}
                          className={`training-vocabulary-book-toggle ${miniButtonClassName} flex items-center rounded px-2 py-1 text-[10px] cyber-button-text transition-colors ${
                            isModernFocusLayout ? 'text-slate-300/80 hover:text-slate-100' : 'text-green-300/80 hover:border-green-500/30 hover:text-green-200'
                          }`}
                          aria-expanded={isVocabularyBookExpanded}
                          aria-label={isVocabularyBookExpanded ? 'Hide vocabulary book' : 'Show vocabulary book'}
                          title={isVocabularyBookExpanded ? 'Hide vocabulary book' : 'Show vocabulary book'}
                        >
                          {isVocabularyBookExpanded ? 'HIDE' : 'SHOW'}
                        </button>
                        <button
                          type="button"
                          onClick={isVocabularyBookExpanded ? closeVocabularyBook : openVocabularyBook}
                          className={`training-vocabulary-book-toggle ${miniButtonClassName} flex h-7 w-7 items-center justify-center rounded transition-colors ${
                            isModernFocusLayout ? 'text-slate-300/80 hover:text-slate-100' : 'text-green-300/80 hover:border-green-500/30 hover:text-green-200'
                          }`}
                          aria-expanded={isVocabularyBookExpanded}
                          aria-label={isVocabularyBookExpanded ? 'Collapse vocabulary book' : 'Expand vocabulary book'}
                          title={isVocabularyBookExpanded ? 'Collapse vocabulary book' : 'Expand vocabulary book'}
                        >
                          <svg
                            className="h-3.5 w-3.5 transition-transform duration-200"
                            style={{ transform: isVocabularyBookExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isVocabularyBookExpanded && (
                      <div className="training-vocabulary-book-body mt-4 animate-fade-in">
                        {vocabularyBook.length === 0 ? (
                          <div className={`${insetClassName} mt-0 rounded-lg border-dashed px-4 py-5 text-center`}>
                            <div className={`text-sm cyber-text ${isModernFocusLayout ? 'text-slate-300/80' : 'text-green-300/75'}`}>No vocabulary recorded on this page yet.</div>
                            <div className={`mt-2 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/50'}`}>
                              Add structured entries under any sentence to build the notebook.
                            </div>
                          </div>
                        ) : (
                          <div className="training-vocabulary-book-scroll training-subpanel-scroll max-h-[320px] space-y-3 overflow-y-auto pr-1 xl:max-h-[360px]">
                            {vocabularyBook.map((entry) => (
                              <div
                                key={entry.normalizedKey}
                                className={`training-vocabulary-book-record ${recordClassName} rounded-lg px-4 py-3`}
                              >
                                <div className="flex flex-col gap-3">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSentence(entry.sentences[0].sentenceId)}
                                    className={`text-left transition-colors ${isModernFocusLayout ? 'hover:text-slate-50' : 'hover:text-green-200'}`}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-sm cyber-font-readable font-bold ${isModernFocusLayout ? 'text-slate-100' : 'text-green-200'}`}>{entry.label}</span>
                                      <span className={`text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/70'}`}>[x{entry.count}]</span>
                                    </div>
                                    {entry.phonetic && (
                                      <div className={`mt-1 text-[11px] ${isModernFocusLayout ? 'text-slate-400/82' : 'text-green-300/66'}`}>
                                        {entry.phonetic}
                                      </div>
                                    )}
                                  </button>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.sentences.map((source) => (
                                      <button
                                        type="button"
                                        key={`${entry.normalizedKey}-${source.sentenceId}`}
                                        onClick={() => scrollToSentence(source.sentenceId)}
                                        title={source.sentenceText}
                                        className={`rounded border px-2 py-1 text-[10px] cyber-button-text transition-colors ${
                                          isModernFocusLayout
                                            ? 'border-slate-700/70 bg-slate-900/55 text-slate-300/85 hover:border-slate-500/75 hover:bg-slate-800/60 hover:text-slate-100'
                                            : 'border-green-500/25 bg-green-500/5 text-green-300/80 hover:border-green-500/45 hover:bg-green-500/10'
                                        }`}
                                      >
                                        S{source.sentenceOrder}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                      </>
                    )}
                  </div>
                </div>
              </aside>

              <section className={mainSectionClassName}>
                <div className="pt-2 pb-6 md:pt-3 md:pb-8">
                  <div className={streamHeaderClassName}>
                    <div>
                      <div className={`text-[10px] cyber-label tracking-[0.3em] ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-400/72'}`}>
                        {isModernFocusLayout ? 'Transcript' : 'SENTENCE STREAM'}
                      </div>
                      <div className={`mt-1 text-[11px] cyber-label ${isModernFocusLayout ? 'text-slate-500/76' : 'text-green-500/45'}`}>
                        {isDictationMode
                          ? 'Listen first, type what you hear, then reveal the line.'
                          : isModernFocusLayout
                            ? 'Read like a normal article and keep the rhythm of the passage.'
                            : 'Read line by line. Let the English stay in front.'}
                      </div>
                    </div>
                    <div className={`flex flex-wrap gap-2 text-[10px] cyber-label ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/60'}`}>
                      <span className={streamCountBadgeClassName}>
                        {item.sentences.length} SEGMENTS
                      </span>
                      {activeSentenceLabel && (
                        <span className={activeSentenceBadgeClassName}>
                          ACTIVE {activeSentenceLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={sentenceListClassName}>
                    {item.sentences.map((sentence, index) => {
                      const isActive = currentSentenceIndex === index
                      const isRepeating = repeatMode === index
                      const isNotesExpanded = expandedNotes.has(sentence.id)
                      const vocabularyState =
                        sentenceVocabulary[sentence.id] || createEmptySentenceVocabularyState()
                      const vocabularyLookup = vocabularyState.lookup
                      const vocabularyCount = vocabularyState.items.length
                      const isVocabularyFormReady = isVocabularyFormSubmittable(vocabularyState.form)
                      const saveStatusMeta = getVocabularySaveStatusMeta(vocabularyState.saveStatus)
                      const highlightedSentenceText = renderSentenceTextWithHighlights(
                        sentence.text,
                        vocabularyState.items,
                        isNotesExpanded && vocabularyCount > 0
                      )
                      const dictationModel = dictationModels[sentence.id] || buildDictationSentenceModel(sentence.text)
                      const dictationState = getSentenceDictationState(sentence.id, dictationModel)
                      const isDictationSentenceCompleteState = isDictationSentenceComplete(dictationModel, dictationState.inputs)
                      const dictationResult = dictationState.submittedResult
                      const hasAnyDictationInput = dictationState.inputs.some((value) => sanitizeDictationInput(value).length > 0)
                      const hasTranslation = Boolean(sentence.translation)
                      const canToggleSentenceTranslation =
                        hasTranslation && (!isDictationMode || Boolean(dictationResult))
                      const isTranslationVisible =
                        canToggleSentenceTranslation &&
                        (showTranslations
                          ? !collapsedGlobalTranslations.has(sentence.id)
                          : expandedTranslations.has(sentence.id))

                      return (
                        <div
                          key={sentence.id}
                          ref={(el) => {
                            sentenceRefs.current[index] = el
                          }}
                          className={`${sentenceCardClassName}${isActive ? ' is-active' : ''}`}
                        >
                          {!isModernFocusLayout && <div className={`${sentenceGlowClassName} absolute inset-0`}></div>}
                          {isActive && (
                            <div className={`${sentenceRailClassName} absolute inset-y-6 left-0 w-[2px] rounded-r-full`}></div>
                          )}
                          <div
                            className={`${sentenceDividerClassName} pointer-events-none absolute bottom-0 left-8 right-6 h-px ${
                              isActive ? 'is-active opacity-75' : 'opacity-40'
                            }`}
                          ></div>

                          <div className={sentenceBodyClassName}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                <span
                                  className={getSentenceOrderBadgeClassName(isActive)}
                                >
                                  S{sentence.order + 1}
                                </span>
                                <span className={sentenceTimeBadgeClassName}>
                                  {sentence.startTime.toFixed(2)}s - {sentence.endTime.toFixed(2)}s
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => canToggleSentenceTranslation && toggleSentenceTranslation(sentence.id)}
                                  disabled={!canToggleSentenceTranslation}
                                  className={`flex items-center justify-center rounded-md border px-2 py-1.5 text-xs transition-all ${
                                    canToggleSentenceTranslation
                                      ? isTranslationVisible
                                        ? isModernFocusLayout
                                          ? 'border-slate-300/40 bg-slate-200/[0.08] text-slate-50'
                                          : 'border-green-400/[0.24] bg-green-500/[0.09] text-green-200'
                                        : isModernFocusLayout
                                          ? 'border-slate-700/70 bg-slate-900/45 text-slate-300/90 hover:border-slate-500/75 hover:bg-slate-800/55 hover:text-slate-100'
                                          : 'border-green-500/[0.16] bg-black/[0.16] text-green-300/90 hover:border-green-500/[0.28] hover:bg-green-500/[0.05] hover:text-green-200'
                                      : isDictationMode && hasTranslation
                                      ? 'cursor-not-allowed border-amber-400/[0.14] bg-black/[0.12] text-amber-200/35'
                                      : isModernFocusLayout
                                        ? 'cursor-not-allowed border-slate-700/60 bg-slate-950/35 text-slate-500/45'
                                        : 'cursor-not-allowed border-green-500/[0.08] bg-black/[0.1] text-green-500/[0.3]'
                                  }`}
                                  title={
                                    !hasTranslation
                                      ? 'No translation'
                                      : isDictationMode && !dictationResult
                                      ? 'Submit this line to unlock translation'
                                      : 'Toggle translation'
                                  }
                                  aria-label={
                                    !hasTranslation
                                      ? 'No translation for this sentence'
                                      : isDictationMode && !dictationResult
                                      ? 'Submit this sentence to unlock translation'
                                      : 'Toggle translation for this sentence'
                                  }
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M4 5h10" />
                                    <path d="M9 3v2c0 4-1.8 7.4-5 10" />
                                    <path d="M6 11c1.4 0 3.5.5 5.5 2.5" />
                                    <path d="M14 13h6" />
                                    <path d="M17 7l4 10" />
                                    <path d="M13 17l4-10" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRepeatClick(index)}
                                  className={`rounded-md border px-2 py-1.5 text-xs cyber-button-text transition-all ${
                                    isRepeating
                                      ? 'border-red-400/50 bg-red-500/20 text-red-300'
                                      : isModernFocusLayout
                                        ? 'border-slate-700/70 bg-slate-900/45 text-slate-300/90 hover:border-slate-500/75 hover:bg-slate-800/55 hover:text-slate-100'
                                        : 'border-green-500/[0.16] bg-black/[0.16] text-green-300/90 hover:border-green-500/[0.28] hover:bg-green-500/[0.05] hover:text-green-200'
                                  }`}
                                title="单句重复播放"
                              >
                                🔁
                              </button>
                              </div>
                            </div>

                            {isDictationMode ? (
                              <div className={`mt-3.5 border-t pt-3 ${isModernFocusLayout ? 'border-slate-700/70' : 'border-amber-400/[0.08]'}`}>
                                <div
                                  onClick={() => handleSentenceClick(sentence)}
                                  className={`${dictationSurfaceClassName} rounded-xl px-4 py-4 transition-all ${
                                    isActive
                                      ? 'is-active'
                                      : ''
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className={`text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-500/85' : 'text-amber-200/75'}`}>
                                      {isModernFocusLayout ? 'Dictation' : 'DICTATION GRID'}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-slate-400' : 'rounded-full border border-amber-400/18 bg-black/20 px-2 py-0.5 text-amber-200/75'}`}>
                                        {dictationModel.words.length} WORDS
                                      </span>
                                      {dictationResult && (
                                        <span className={`${isModernFocusLayout ? 'training-focus-pill training-focus-pill--active !text-slate-50' : 'rounded-full border border-amber-400/22 bg-amber-500/[0.08] px-2 py-0.5 text-amber-100'}`}>
                                          {dictationResult.correctCount}/{dictationResult.totalCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-3">
                                    {dictationModel.segments.map((segment, segmentIndex) => (
                                      <div key={`${sentence.id}-dictation-segment-${segmentIndex}`} className="flex items-end gap-1.5">
                                        {segment.tokens.map((token, tokenIndex) => {
                                          if (token.type !== 'word') {
                                            return (
                                              <span
                                                key={`${sentence.id}-symbol-${segmentIndex}-${tokenIndex}`}
                                                className={`pb-2 text-sm font-bold ${
                                                  isModernFocusLayout
                                                    ? token.type === 'hyphen'
                                                      ? 'text-slate-400/85'
                                                      : 'text-slate-500/85'
                                                    : token.type === 'hyphen'
                                                      ? 'text-green-300/80'
                                                      : 'text-green-400/60'
                                                }`}
                                              >
                                                {token.value}
                                              </span>
                                            )
                                          }

                                          const wordInputValue = dictationState.inputs[token.wordIndex] || ''
                                          const revealMode = dictationState.revealModes[token.wordIndex] || 'hidden'
                                          const revealText =
                                            revealMode === 'initial'
                                              ? token.answerText.charAt(0)
                                              : revealMode === 'full'
                                                ? token.answerText
                                                : ''
                                          const isRevealVisible = revealMode !== 'hidden'
                                          const normalizedInputLength = sanitizeDictationInput(wordInputValue).length
                                          const isWordFilled = normalizedInputLength >= token.maxLength

                                          return (
                                            <div
                                              key={`${sentence.id}-word-${token.wordIndex}`}
                                              className="group/word relative"
                                              style={{ width: getDictationWordWidth(token.displayText, token.maxLength) }}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                focusDictationInput(sentence.id, token.wordIndex)
                                              }}
                                            >
                                              <div
                                                className={`absolute inset-0 rounded-lg border transition-all duration-200 ${
                                                  isRevealVisible
                                                    ? isModernFocusLayout
                                                      ? 'border-slate-400/55 bg-slate-200/[0.06] shadow-[0_10px_22px_rgba(15,23,42,0.18)]'
                                                      : 'border-cyan-300/35 bg-cyan-500/[0.06] shadow-[0_0_14px_rgba(34,211,238,0.08)]'
                                                    : isWordFilled
                                                    ? isModernFocusLayout
                                                      ? 'border-slate-500/55 bg-slate-100/[0.05] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]'
                                                      : 'border-amber-300/30 bg-amber-500/[0.06] shadow-[0_0_12px_rgba(251,191,36,0.08)]'
                                                    : isModernFocusLayout
                                                      ? 'border-slate-700/70 bg-slate-950/45 group-hover/word:border-slate-500/70 group-hover/word:bg-slate-900/60'
                                                      : 'border-green-500/18 bg-black/25 group-hover/word:border-green-400/30 group-hover/word:bg-green-500/[0.04]'
                                                }`}
                                              ></div>
                                              <div className={`pointer-events-none absolute inset-x-2 bottom-1 h-px bg-gradient-to-r from-transparent ${isModernFocusLayout ? 'via-slate-400/18' : 'via-green-500/18'} to-transparent`}></div>
                                              {isRevealVisible && (
                                                <div
                                                  className={`pointer-events-none absolute inset-x-1.5 inset-y-1.5 z-20 flex items-center justify-center rounded-md text-center text-[15px] font-semibold tracking-[0.08em] ${
                                                    isModernFocusLayout
                                                      ? 'bg-slate-950/78 text-slate-100'
                                                      : 'bg-[#081416]/78 text-cyan-100'
                                                  }`}
                                                >
                                                  <span className="truncate px-2">
                                                    {revealText}
                                                  </span>
                                                </div>
                                              )}
                                              <input
                                                ref={(element) => setDictationInputRef(sentence.id, token.wordIndex, element)}
                                                value={wordInputValue}
                                                onFocus={() => {
                                                  lastDictationInputAtRef.current = Date.now()
                                                }}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => handleDictationInputChange(sentence.id, dictationModel, token.wordIndex, event.target.value)}
                                                onKeyDown={(event) => handleDictationKeyDown(sentence.id, dictationModel, token.wordIndex, event)}
                                                maxLength={token.maxLength}
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                readOnly={isRevealVisible}
                                                className={`relative z-10 h-11 w-full rounded-lg border border-transparent bg-transparent px-2.5 pb-1 pt-2 text-center text-[15px] font-semibold tracking-[0.08em] outline-none transition-all ${
                                                  isModernFocusLayout
                                                    ? `${isRevealVisible ? 'text-transparent caret-transparent' : 'text-slate-100 caret-slate-200'} focus:border-slate-400/35 focus:bg-slate-200/[0.03] focus:shadow-[0_0_0_1px_rgba(255,255,255,0.02)]`
                                                    : `${isRevealVisible ? 'text-transparent caret-transparent' : 'text-green-100 caret-amber-300'} focus:border-amber-300/28 focus:bg-amber-500/[0.03] focus:shadow-[0_0_12px_rgba(251,191,36,0.12)]`
                                                }`}
                                                aria-label={`Dictation input for ${token.displayText}`}
                                                title={
                                                  revealMode === 'initial'
                                                    ? 'First-letter hint visible. Press Ctrl+I to hide or Ctrl+L to reveal the full word.'
                                                    : revealMode === 'full'
                                                      ? 'Full-word hint visible. Press Ctrl+L to hide.'
                                                      : 'Press Ctrl+I for the first letter or Ctrl+L for the full word.'
                                                }
                                              />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ))}
                                  </div>

                                    <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 ${isModernFocusLayout ? 'border-slate-700/70' : 'border-amber-400/[0.08]'}`}>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-slate-400' : 'rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-green-400/75'}`}>
                                        NO PUNCTUATION INPUT
                                      </span>
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-slate-400' : 'rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-green-400/75'}`}>
                                        SPACE JUMPS WHEN FULL
                                      </span>
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-slate-400' : 'rounded-full border border-cyan-400/[0.16] bg-cyan-500/[0.05] px-2 py-0.5 text-cyan-200/75'}`}>
                                        CTRL+I FIRST LETTER
                                      </span>
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-slate-400' : 'rounded-full border border-cyan-400/[0.16] bg-cyan-500/[0.05] px-2 py-0.5 text-cyan-200/75'}`}>
                                        CTRL+L FULL WORD
                                      </span>
                                      <span className={`${isModernFocusLayout ? 'training-focus-meta-pill text-amber-200/80' : 'rounded-full border border-amber-400/[0.16] bg-amber-500/[0.05] px-2 py-0.5 text-amber-200/70'}`}>
                                        EMPTY SUBMIT OK
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        handleDictationSubmit(sentence.id, dictationModel)
                                      }}
                                      className={`rounded border px-3 py-1.5 text-xs cyber-button-text transition-all ${
                                        dictationResult
                                          ? isModernFocusLayout
                                            ? 'border-slate-300/60 bg-slate-200/[0.1] text-slate-50 hover:border-slate-200/70 hover:bg-slate-200/[0.12]'
                                            : 'border-amber-300/45 bg-amber-500/[0.12] text-amber-100 hover:border-amber-200/60 hover:bg-amber-500/[0.16]'
                                          : isDictationSentenceCompleteState
                                          ? isModernFocusLayout
                                            ? 'border-slate-400/35 bg-slate-200/[0.06] text-slate-100 hover:border-slate-300/55 hover:bg-slate-200/[0.1]'
                                            : 'border-amber-400/35 bg-amber-500/[0.08] text-amber-100 hover:border-amber-300/55 hover:bg-amber-500/[0.14]'
                                          : hasAnyDictationInput
                                          ? isModernFocusLayout
                                            ? 'border-slate-500/30 bg-slate-200/[0.04] text-slate-100/90 hover:border-slate-400/45 hover:bg-slate-200/[0.08]'
                                            : 'border-amber-400/30 bg-amber-500/[0.05] text-amber-100/90 hover:border-amber-300/45 hover:bg-amber-500/[0.1]'
                                          : isModernFocusLayout
                                            ? 'border-slate-700/70 bg-slate-950/35 text-slate-300/80 hover:border-slate-500/60 hover:bg-slate-900/55'
                                            : 'border-amber-400/24 bg-black/20 text-amber-200/80 hover:border-amber-300/40 hover:bg-amber-500/[0.08]'
                                      }`}
                                      title="Submit this line at any time, even if some words are blank"
                                    >
                                      SUBMIT LINE
                                    </button>
                                  </div>

                                  {dictationResult && renderDictationReview(dictationModel, dictationResult)}

                                  {isTranslationVisible && sentence.translation && (
                                    <div className={`${insetClassName} mt-3 rounded-lg px-4 py-3`}>
                                      <div className={`mb-1 text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/40'}`}>
                                        TRANSLATION
                                      </div>
                                      <p className={`max-w-[44rem] text-[13px] leading-[1.75] md:text-sm ${isModernFocusLayout ? 'text-slate-300/88' : 'text-green-200/60'}`}>
                                        {sentence.translation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                            <div
                              onClick={() => handleSentenceClick(sentence)}
                              className={`${readingSurfaceClassName} mt-3.5 cursor-pointer px-4 py-1.5 md:px-5 md:py-2 transition-all select-text ${
                                  isActive
                                    ? isModernFocusLayout ? 'text-slate-50' : 'text-green-100'
                                    : isModernFocusLayout ? 'text-slate-200 hover:text-slate-50' : 'text-gray-100 hover:text-green-100'
                                }`}
                            >
                              <p className={`max-w-[48rem] text-base cyber-font-readable font-bold leading-[1.9] md:text-[17px] ${selectedSentenceFont.className} ${isModernFocusLayout ? 'tracking-[0.01em]' : ''}`}>
                                {highlightedSentenceText}
                              </p>
                            </div>

                            <div className={`mt-3.5 border-t pt-2.5 ${isModernFocusLayout ? 'border-slate-700/70' : 'border-green-500/[0.08]'}`}>
                              <button
                                type="button"
                                onClick={() => toggleNotes(sentence.id)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className={`text-xs cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-300/90' : 'text-green-300/90'}`}>VOCABULARY</span>
                                  <span className={vocabularyCountBadgeClassName}>
                                    {vocabularyCount} ITEMS
                                  </span>
                                  {saveStatusMeta && (
                                    <span className={`text-[10px] cyber-label ${saveStatusMeta.className}`}>
                                      {saveStatusMeta.label}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={`flex h-5 w-5 items-center justify-center transition-transform duration-200 ${isModernFocusLayout ? 'text-slate-400/90' : 'text-green-400/70'}`}
                                  style={{ transform: isNotesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path
                                      fillRule="evenodd"
                                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              </button>

                              {isTranslationVisible && sentence.translation && (
                                <div className={`${insetClassName} mt-3 rounded-lg px-4 py-3`}>
                                  <div className={`mb-1 text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-500/80' : 'text-green-500/40'}`}>
                                    {isModernFocusLayout ? 'Translation' : 'TRANSLATION'}
                                  </div>
                                  <p className={`max-w-[44rem] text-[13px] leading-[1.75] md:text-sm ${isModernFocusLayout ? 'text-slate-300/88' : 'text-green-200/60'}`}>
                                    {sentence.translation}
                                  </p>
                                </div>
                              )}

                              {isNotesExpanded && (
                                <div className={`${denseInsetClassName} vocabulary-editor-shell mt-2.5 animate-fade-in rounded-xl p-3`}>
                                  {vocabularyCount > 0 ? (
                                    <div className="mb-3 space-y-2.5">
                                      {vocabularyState.items.map((entry) => {
                                        const entryLabel = formatVocabularyEntry(entry)
                                        const isLegacyEntry = !isVocabularyEntryStructured(entry)

                                        return (
                                          <div
                                            key={`${sentence.id}-${getVocabularyEntryKey(entry)}`}
                                            className={`${recordClassName} flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 ${
                                              isLegacyEntry
                                                ? 'is-legacy border-dashed'
                                                : ''
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <div className={`break-words text-sm cyber-font-readable ${isModernFocusLayout ? 'text-slate-100' : 'text-green-100'}`}>
                                                {entryLabel}
                                              </div>
                                              {entry.phonetic && (
                                                <div className={`mt-1 text-[11px] ${isModernFocusLayout ? 'text-slate-400/85' : 'text-green-300/68'}`}>
                                                  {entry.phonetic}
                                                </div>
                                              )}
                                              {isLegacyEntry && (
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                                                  <span className="rounded-full border border-amber-400/30 bg-amber-500/[0.08] px-2 py-0.5 cyber-label text-amber-200/80">
                                                    LEGACY
                                                  </span>
                                                  <span className="cyber-label text-amber-100/65">
                                                    Delete and re-enter this item in the new format.
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleVocabularyRemove(sentence.id, entry)}
                                              className={`shrink-0 transition-colors ${
                                                isLegacyEntry
                                                  ? 'text-amber-200/75 hover:text-red-300'
                                                  : isModernFocusLayout
                                                    ? 'text-slate-400/85 hover:text-red-300'
                                                    : 'text-green-300/80 hover:text-red-300'
                                              }`}
                                              aria-label={`Remove ${entryLabel}`}
                                              title={`Remove ${entryLabel}`}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : null}

                                  <div className="mb-3 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => openVocabularyEntryModal(sentence.id)}
                                      className={`rounded border px-3 py-1.5 text-xs cyber-button-text transition-all ${
                                        isModernFocusLayout
                                          ? 'border-slate-400/35 bg-slate-200/[0.08] text-slate-100 hover:border-slate-300/55 hover:bg-slate-200/[0.12]'
                                          : 'border-green-500/28 bg-green-500/[0.08] text-green-200 hover:border-green-500/45 hover:bg-green-500/[0.12]'
                                      }`}
                                      aria-label={`Create vocabulary entry for sentence ${sentence.order + 1}`}
                                      title="Create vocabulary entry"
                                    >
                                      + NEW ENTRY
                                    </button>
                                  </div>

                                  {false && (
                                  <form
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      handleVocabularySubmit(sentence.id)
                                    }}
                                    className={`${formInsetClassName} vocabulary-entry-form-shell space-y-3 rounded-lg p-3`}
                                  >
                                    <div className="space-y-2.5">
                                      <div className="relative">
                                        <input
                                          value={vocabularyState.form.headword}
                                          onChange={(event) => handleVocabularyHeadwordChange(sentence.id, event.target.value)}
                                          onFocus={() => handleVocabularyHeadwordFocus(sentence.id)}
                                          onBlur={() => handleVocabularyHeadwordBlur(sentence.id)}
                                          onKeyDown={(event) => handleVocabularyHeadwordKeyDown(sentence.id, event)}
                                          placeholder="separate"
                                          spellCheck={false}
                                          autoComplete="off"
                                          aria-controls={`${sentence.id}-vocabulary-suggestions`}
                                          className={`w-full rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                                            isModernFocusLayout
                                              ? 'border-slate-700/80 bg-slate-950/55 text-slate-100 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                                              : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                                          }`}
                                        />

                                        {vocabularyLookup.isOpen && (vocabularyLookup.isLoading || vocabularyLookup.suggestions.length > 0) && (
                                          <div
                                            id={`${sentence.id}-vocabulary-suggestions`}
                                            className={`vocabulary-headword-suggestions absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border shadow-[0_18px_36px_rgba(2,6,23,0.45)] ${
                                              isModernFocusLayout
                                                ? 'border-slate-700/80 bg-slate-950/95'
                                                : 'border-green-500/22 bg-[#020d08]/95'
                                            }`}
                                          >
                                            {vocabularyLookup.isLoading ? (
                                              <div className={`px-3 py-2 text-[11px] cyber-label ${isModernFocusLayout ? 'text-slate-400/78' : 'text-green-300/62'}`}>
                                                SEARCHING ECDICT...
                                              </div>
                                            ) : (
                                              vocabularyLookup.suggestions.map((suggestion, suggestionIndex) => (
                                                <button
                                                  key={`${sentence.id}-dictionary-suggestion-${suggestion.word}-${suggestionIndex}`}
                                                  type="button"
                                                  onMouseDown={(event) => {
                                                    event.preventDefault()
                                                    void autofillVocabularyEntry(sentence.id, suggestion.word)
                                                  }}
                                                  className={`block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0 ${
                                                    isModernFocusLayout
                                                      ? 'border-slate-800/80 hover:bg-slate-900/78'
                                                      : 'border-green-500/14 hover:bg-green-500/[0.06]'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-sm cyber-font-readable ${isModernFocusLayout ? 'text-slate-100' : 'text-green-100'}`}>
                                                      {suggestion.word}
                                                    </span>
                                                    {suggestion.phonetic && (
                                                      <span className={`text-[11px] ${isModernFocusLayout ? 'text-slate-400/80' : 'text-green-300/65'}`}>
                                                        {suggestion.phonetic}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {suggestion.translationPreview && (
                                                    <div className={`mt-1 text-[10px] leading-5 cyber-label ${isModernFocusLayout ? 'text-slate-500/82' : 'text-green-400/52'}`}>
                                                      {suggestion.translationPreview}
                                                    </div>
                                                  )}
                                                </button>
                                              ))
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <input
                                          value={vocabularyState.form.phonetic}
                                          onChange={(event) => handleVocabularyPhoneticChange(sentence.id, event.target.value)}
                                          placeholder="/ˈsepərət/"
                                          spellCheck={false}
                                          className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                                            isModernFocusLayout
                                              ? 'border-slate-700/80 bg-slate-950/55 text-slate-200 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                                              : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                                          }`}
                                        />
                                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                                          <span className={`text-[10px] cyber-label ${
                                            vocabularyLookup.isHydrating
                                              ? isModernFocusLayout
                                                ? 'text-slate-300/78'
                                                : 'text-green-200/75'
                                              : isModernFocusLayout
                                                ? 'text-slate-500/72'
                                                : 'text-green-500/48'
                                          }`}>
                                            {vocabularyLookup.isHydrating
                                              ? 'FILLING FROM ECDICT...'
                                              : vocabularyLookup.suggestions.length > 0
                                                ? 'TAB: FIRST MATCH'
                                                : vocabularyState.form.headword.trim().length > 0
                                                  ? 'ECDICT READY'
                                                  : 'TYPE TO SEARCH'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleVocabularyAddSense(sentence.id)}
                                            className={`rounded border px-2.5 py-1 text-[10px] cyber-button-text transition-colors ${
                                              isModernFocusLayout
                                                ? 'border-slate-700/80 bg-slate-950/55 text-slate-300/85 hover:border-slate-500/75 hover:bg-slate-900/70 hover:text-slate-100'
                                                : 'border-green-500/20 bg-black/30 text-green-300/80 hover:border-green-500/35 hover:bg-green-500/[0.05] hover:text-green-200'
                                            }`}
                                          >
                                            + POS
                                          </button>
                                        </div>
                                      </div>

                                      {vocabularyState.form.senses.map((sense, senseIndex) => (
                                        <div
                                          key={`${sentence.id}-sense-${senseIndex}`}
                                          className={`${recordClassName} rounded-lg p-3`}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className={`text-[10px] cyber-label tracking-[0.22em] ${isModernFocusLayout ? 'text-slate-500/78' : 'text-green-500/55'}`}>
                                              {isModernFocusLayout ? 'Part of speech' : 'POS SELECT'}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleVocabularyRemoveSense(sentence.id, senseIndex)}
                                              className={`rounded-md border px-3 py-2 text-[10px] cyber-button-text transition-colors disabled:cursor-not-allowed ${
                                                isModernFocusLayout
                                                  ? 'border-slate-700/80 bg-slate-950/45 text-slate-300/75 hover:border-red-400/35 hover:text-red-300 disabled:text-slate-600/70'
                                                  : 'border-green-500/16 bg-black/20 text-green-300/70 hover:border-red-400/35 hover:text-red-300 disabled:text-green-500/35'
                                              }`}
                                              disabled={vocabularyState.form.senses.length === 1}
                                              aria-label={`Remove sense ${senseIndex + 1}`}
                                              title={`Remove sense ${senseIndex + 1}`}
                                            >
                                              REMOVE
                                            </button>
                                          </div>
                                          <div
                                            className="mt-2 flex flex-wrap gap-2"
                                            role="radiogroup"
                                            aria-label={`Part of speech for sense ${senseIndex + 1}`}
                                          >
                                            {VOCABULARY_POS_OPTIONS.map((option) => {
                                              const isSelected = sense.pos === option.value

                                              return (
                                                <label
                                                  key={`${sentence.id}-sense-${senseIndex}-${option.value}`}
                                                  className={`relative inline-flex cursor-pointer items-center rounded-md border px-2.5 py-1.5 text-[10px] cyber-button-text transition-all ${
                                                    isSelected
                                                      ? isModernFocusLayout
                                                        ? 'border-slate-300/65 bg-slate-200/[0.1] text-slate-50 shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
                                                        : 'border-green-400/38 bg-green-500/[0.14] text-green-100 shadow-[0_0_14px_rgba(10,255,10,0.08)]'
                                                      : isModernFocusLayout
                                                        ? 'border-slate-700/80 bg-slate-950/45 text-slate-300/80 hover:border-slate-500/75 hover:bg-slate-900/65 hover:text-slate-100'
                                                        : 'border-green-500/18 bg-black/25 text-green-300/75 hover:border-green-500/34 hover:bg-green-500/[0.06] hover:text-green-200'
                                                  }`}
                                                >
                                                  <input
                                                    type="radio"
                                                    name={`sentence-${sentence.id}-sense-${senseIndex}-pos`}
                                                    value={option.value}
                                                    checked={isSelected}
                                                    onChange={(event) => handleVocabularySenseChange(sentence.id, senseIndex, 'pos', event.target.value)}
                                                    className="sr-only"
                                                  />
                                                  <span>{option.label}</span>
                                                </label>
                                              )
                                            })}
                                          </div>
                                          <input
                                            value={sense.meaning}
                                            onChange={(event) => handleVocabularySenseChange(sentence.id, senseIndex, 'meaning', event.target.value)}
                                            placeholder="Enter meaning"
                                            spellCheck={false}
                                            className={`mt-3 w-full rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                                              isModernFocusLayout
                                                ? 'border-slate-700/80 bg-slate-950/55 text-slate-100 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                                                : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                                            }`}
                                          />
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <button
                                        type="submit"
                                        disabled={!isVocabularyFormReady}
                                        className={`rounded border px-3 py-1.5 text-xs cyber-button-text transition-all ${
                                          isVocabularyFormReady
                                            ? isModernFocusLayout
                                              ? 'border-slate-400/35 bg-slate-200/[0.08] text-slate-100 hover:border-slate-300/55 hover:bg-slate-200/[0.12]'
                                              : 'border-green-500/28 bg-green-500/[0.08] text-green-200 hover:border-green-500/45 hover:bg-green-500/[0.12]'
                                            : isModernFocusLayout
                                              ? 'cursor-not-allowed border-slate-700/70 bg-slate-950/45 text-slate-500/65'
                                              : 'cursor-not-allowed border-green-500/12 bg-black/25 text-green-500/35'
                                        }`}
                                      >
                                        ADD ENTRY
                                      </button>
                                    </div>
                                  </form>
                                  )}
                                </div>
                              )}
                            </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

      {/* 缂栬緫妯℃€佹 */}
      {activeVocabularyModalSentence && activeVocabularyModalState && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          onClick={closeVocabularyEntryModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sentence-vocabulary-modal-title"
            className={`w-full max-w-2xl overflow-visible rounded-xl border shadow-[0_24px_60px_rgba(2,6,23,0.55)] ${
              isModernFocusLayout
                ? 'border-slate-700/80 bg-slate-950/95'
                : 'border-green-500/28 bg-[#020c08]/95'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-4 border-b px-4 py-3 md:px-5 md:py-4 ${
              isModernFocusLayout
                ? 'border-slate-700/75'
                : 'border-green-500/[0.18]'
            }`}>
              <div className="min-w-0">
                <div className={`text-[10px] cyber-label tracking-[0.24em] ${isModernFocusLayout ? 'text-slate-400/80' : 'text-green-400/75'}`}>
                  NEW VOCABULARY ENTRY
                </div>
                <div id="sentence-vocabulary-modal-title" className={`mt-1 text-sm cyber-font-readable ${isModernFocusLayout ? 'text-slate-100' : 'text-green-100'}`}>
                  S{activeVocabularyModalSentence.order + 1} · {activeVocabularyModalSentence.text.slice(0, 72)}
                  {activeVocabularyModalSentence.text.length > 72 ? '...' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={closeVocabularyEntryModal}
                className={`shrink-0 rounded border px-2.5 py-1 text-[10px] cyber-button-text transition-colors ${
                  isModernFocusLayout
                    ? 'border-slate-600/75 bg-slate-900/55 text-slate-300/85 hover:border-slate-400/75 hover:text-slate-100'
                    : 'border-green-500/25 bg-black/35 text-green-300/80 hover:border-green-400/40 hover:text-green-200'
                }`}
                aria-label="Close vocabulary modal"
              >
                CLOSE
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleVocabularyModalSubmit(activeVocabularyModalSentence.id)
              }}
              className="space-y-3 p-4 md:p-5"
            >
              <div className={`${formInsetClassName} vocabulary-entry-form-shell space-y-3 rounded-lg p-3`}>
                <div className="space-y-2.5">
                  <div className="relative">
                    <input
                      value={activeVocabularyModalState.form.headword}
                      onChange={(event) => handleVocabularyHeadwordChange(activeVocabularyModalSentence.id, event.target.value)}
                      onFocus={() => handleVocabularyHeadwordFocus(activeVocabularyModalSentence.id)}
                      onBlur={() => handleVocabularyHeadwordBlur(activeVocabularyModalSentence.id)}
                      onKeyDown={(event) => handleVocabularyHeadwordKeyDown(activeVocabularyModalSentence.id, event)}
                      placeholder="separate"
                      spellCheck={false}
                      autoComplete="off"
                      aria-controls={`${activeVocabularyModalSentence.id}-vocabulary-modal-suggestions`}
                      className={`w-full rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                        isModernFocusLayout
                          ? 'border-slate-700/80 bg-slate-950/55 text-slate-100 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                          : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                      }`}
                    />

                    {activeVocabularyModalLookup.isOpen && (
                      activeVocabularyModalLookup.isLoading || activeVocabularyModalLookup.suggestions.length > 0
                    ) && (
                      <div
                        id={`${activeVocabularyModalSentence.id}-vocabulary-modal-suggestions`}
                        className={`vocabulary-headword-suggestions absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border shadow-[0_18px_36px_rgba(2,6,23,0.45)] ${
                          isModernFocusLayout
                            ? 'border-slate-700/80 bg-slate-950/95'
                            : 'border-green-500/22 bg-[#020d08]/95'
                        }`}
                      >
                        {activeVocabularyModalLookup.isLoading ? (
                          <div className={`px-3 py-2 text-[11px] cyber-label ${isModernFocusLayout ? 'text-slate-400/78' : 'text-green-300/62'}`}>
                            SEARCHING ECDICT...
                          </div>
                        ) : (
                          activeVocabularyModalLookup.suggestions.map((suggestion, suggestionIndex) => (
                            <button
                              key={`${activeVocabularyModalSentence.id}-dictionary-modal-suggestion-${suggestion.word}-${suggestionIndex}`}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                void autofillVocabularyEntry(activeVocabularyModalSentence.id, suggestion.word)
                              }}
                              className={`block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0 ${
                                isModernFocusLayout
                                  ? 'border-slate-800/80 hover:bg-slate-900/78'
                                  : 'border-green-500/14 hover:bg-green-500/[0.06]'
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-sm cyber-font-readable ${isModernFocusLayout ? 'text-slate-100' : 'text-green-100'}`}>
                                  {suggestion.word}
                                </span>
                                {suggestion.phonetic && (
                                  <span className={`text-[11px] ${isModernFocusLayout ? 'text-slate-400/80' : 'text-green-300/65'}`}>
                                    {suggestion.phonetic}
                                  </span>
                                )}
                              </div>
                              {suggestion.translationPreview && (
                                <div className={`mt-1 text-[10px] leading-5 cyber-label ${isModernFocusLayout ? 'text-slate-500/82' : 'text-green-400/52'}`}>
                                  {suggestion.translationPreview}
                                </div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={activeVocabularyModalState.form.phonetic}
                      onChange={(event) => handleVocabularyPhoneticChange(activeVocabularyModalSentence.id, event.target.value)}
                      placeholder="/ˈsepərət/"
                      spellCheck={false}
                      className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                        isModernFocusLayout
                          ? 'border-slate-700/80 bg-slate-950/55 text-slate-200 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                          : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className={`text-[10px] cyber-label ${
                        activeVocabularyModalLookup.isHydrating
                          ? isModernFocusLayout
                            ? 'text-slate-300/78'
                            : 'text-green-200/75'
                          : isModernFocusLayout
                            ? 'text-slate-500/72'
                            : 'text-green-500/48'
                      }`}>
                        {activeVocabularyModalLookup.isHydrating
                          ? 'FILLING FROM ECDICT...'
                          : activeVocabularyModalLookup.suggestions.length > 0
                            ? 'TAB: FIRST MATCH'
                            : activeVocabularyModalState.form.headword.trim().length > 0
                              ? 'ECDICT READY'
                              : 'TYPE TO SEARCH'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleVocabularyAddSense(activeVocabularyModalSentence.id)}
                        className={`rounded border px-2.5 py-1 text-[10px] cyber-button-text transition-colors ${
                          isModernFocusLayout
                            ? 'border-slate-700/80 bg-slate-950/55 text-slate-300/85 hover:border-slate-500/75 hover:bg-slate-900/70 hover:text-slate-100'
                            : 'border-green-500/20 bg-black/30 text-green-300/80 hover:border-green-500/35 hover:bg-green-500/[0.05] hover:text-green-200'
                        }`}
                      >
                        + POS
                      </button>
                    </div>
                  </div>

                  {activeVocabularyModalState.form.senses.map((sense, senseIndex) => (
                    <div
                      key={`${activeVocabularyModalSentence.id}-modal-sense-${senseIndex}`}
                      className={`${recordClassName} rounded-lg p-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`text-[10px] cyber-label tracking-[0.22em] ${isModernFocusLayout ? 'text-slate-500/78' : 'text-green-500/55'}`}>
                          {isModernFocusLayout ? 'Part of speech' : 'POS SELECT'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleVocabularyRemoveSense(activeVocabularyModalSentence.id, senseIndex)}
                          className={`rounded-md border px-3 py-2 text-[10px] cyber-button-text transition-colors disabled:cursor-not-allowed ${
                            isModernFocusLayout
                              ? 'border-slate-700/80 bg-slate-950/45 text-slate-300/75 hover:border-red-400/35 hover:text-red-300 disabled:text-slate-600/70'
                              : 'border-green-500/16 bg-black/20 text-green-300/70 hover:border-red-400/35 hover:text-red-300 disabled:text-green-500/35'
                          }`}
                          disabled={activeVocabularyModalState.form.senses.length === 1}
                          aria-label={`Remove sense ${senseIndex + 1}`}
                          title={`Remove sense ${senseIndex + 1}`}
                        >
                          REMOVE
                        </button>
                      </div>
                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        role="radiogroup"
                        aria-label={`Part of speech for sense ${senseIndex + 1}`}
                      >
                        {VOCABULARY_POS_OPTIONS.map((option) => {
                          const isSelected = sense.pos === option.value

                          return (
                            <label
                              key={`${activeVocabularyModalSentence.id}-modal-sense-${senseIndex}-${option.value}`}
                              className={`relative inline-flex cursor-pointer items-center rounded-md border px-2.5 py-1.5 text-[10px] cyber-button-text transition-all ${
                                isSelected
                                  ? isModernFocusLayout
                                    ? 'border-slate-300/65 bg-slate-200/[0.1] text-slate-50 shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
                                    : 'border-green-400/38 bg-green-500/[0.14] text-green-100 shadow-[0_0_14px_rgba(10,255,10,0.08)]'
                                  : isModernFocusLayout
                                    ? 'border-slate-700/80 bg-slate-950/45 text-slate-300/80 hover:border-slate-500/75 hover:bg-slate-900/65 hover:text-slate-100'
                                    : 'border-green-500/18 bg-black/25 text-green-300/75 hover:border-green-500/34 hover:bg-green-500/[0.06] hover:text-green-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`sentence-${activeVocabularyModalSentence.id}-modal-sense-${senseIndex}-pos`}
                                value={option.value}
                                checked={isSelected}
                                onChange={(event) => handleVocabularySenseChange(activeVocabularyModalSentence.id, senseIndex, 'pos', event.target.value)}
                                className="sr-only"
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                      <input
                        value={sense.meaning}
                        onChange={(event) => handleVocabularySenseChange(activeVocabularyModalSentence.id, senseIndex, 'meaning', event.target.value)}
                        placeholder="Enter meaning"
                        spellCheck={false}
                        className={`mt-3 w-full rounded-md border px-3 py-2 text-sm cyber-input-font focus:outline-none ${
                          isModernFocusLayout
                            ? 'border-slate-700/80 bg-slate-950/55 text-slate-100 placeholder:text-slate-500/60 focus:border-slate-400/60 focus:bg-slate-900/70'
                            : 'border-green-500/20 bg-black/30 text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeVocabularyEntryModal}
                  className={`rounded border px-3 py-1.5 text-xs cyber-button-text transition-colors ${
                    isModernFocusLayout
                      ? 'border-slate-700/80 bg-slate-950/55 text-slate-300/85 hover:border-slate-500/75 hover:bg-slate-900/70 hover:text-slate-100'
                      : 'border-green-500/16 bg-black/25 text-green-300/75 hover:border-green-500/34 hover:bg-green-500/[0.06] hover:text-green-200'
                  }`}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={!isActiveVocabularyModalFormReady}
                  className={`rounded border px-3 py-1.5 text-xs cyber-button-text transition-all ${
                    isActiveVocabularyModalFormReady
                      ? isModernFocusLayout
                        ? 'border-slate-400/35 bg-slate-200/[0.08] text-slate-100 hover:border-slate-300/55 hover:bg-slate-200/[0.12]'
                        : 'border-green-500/28 bg-green-500/[0.08] text-green-200 hover:border-green-500/45 hover:bg-green-500/[0.12]'
                      : isModernFocusLayout
                        ? 'cursor-not-allowed border-slate-700/70 bg-slate-950/45 text-slate-500/65'
                        : 'cursor-not-allowed border-green-500/12 bg-black/25 text-green-500/35'
                  }`}
                >
                  ADD ENTRY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
          <div className="w-[95%] max-w-5xl mx-auto relative bg-black/90 border-2 border-green-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 椤堕儴瑁呴グ鏍?*/}
            <div className="relative border-b-2 border-green-500/50 bg-gradient-to-r from-green-900/30 via-transparent to-transparent p-4 sticky top-0 bg-black/90 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(10,255,10,0.8)]"></div>
                  <h1 className="text-2xl cyber-title text-green-400 cyber-neon">
                    [ EDIT MODULE ]
                  </h1>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-green-400/70 hover:text-green-300 cyber-button-text text-sm transition-colors px-3 py-1 border border-green-500/30 hover:border-green-500/50 rounded"
                >
                  ✕ CLOSE
                </button>
              </div>
              <div className="mt-2 text-xs cyber-label text-green-500/60">
                TRAINING ITEM EDIT INTERFACE
              </div>
            </div>

            {/* HUD缃戞牸鑳屾櫙 */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>

            {/* 鎵弿绾挎晥鏋?*/}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.03),rgba(10,255,10,0.01),rgba(10,255,10,0.03))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-40"></div>

            {/* 瑙掕惤瑁呴グ */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50"></div>

            {/* 鍐呭鍖哄煙 */}
            <div className="relative p-8">
              <form onSubmit={handleEditSubmit} className="space-y-8">
                {/* 鍩虹淇℃伅鍖哄煙 */}
                <div className="space-y-6">
                  <div className="border-l-2 border-green-500/50 pl-4">
                    <label className="block text-green-400 cyber-label text-sm mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                      TITLE *
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                      placeholder="Enter training item title..."
                      required
                    />
                  </div>

                  <div className="border-l-2 border-green-500/50 pl-4">
                    <label className="block text-green-400 cyber-label text-sm mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                      AUDIO FILE (OPTIONAL - 留空则保持原文件)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setEditAudioFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-300 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-green-500/20 file:text-green-400 file:cyber-button-text file:text-sm file:cursor-pointer hover:file:bg-green-500/30"
                      />
                      {editAudioFile && (
                        <div className="mt-2 text-xs cyber-text text-green-400/70">
                          Selected: {editAudioFile.name}
                        </div>
                      )}
                      {!editAudioFile && item && (
                        <div className="mt-2 text-xs cyber-text text-green-400/50">
                          Current: {item.audioUrl.split('/').pop()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 鍙ュ瓙鍒嗘鍖哄煙 */}
                <div className="border-t-2 border-green-500/30 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-[2px] w-8 bg-green-500"></div>
                    <h2 className="text-xl cyber-title text-green-400">SENTENCE SEGMENTS</h2>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs cyber-label text-green-500/60">COUNT: <span className="cyber-number cyber-tabular">{editSentences.length}</span></span>
                      {hasUnsavedEditSentence && (
                        <span className="text-xs cyber-text text-yellow-400/70 animate-pulse">(+1 UNSAVED)</span>
                      )}
                    </div>
                  </div>

                  {/* 宸叉坊鍔犵殑鍙ュ瓙鍒楄〃 */}
                  {editSentences.length > 0 && (
                    <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2">
                      {editSentences.map((sentence, index) => (
                        <div
                          key={index}
                          className={`p-4 bg-black/40 border rounded relative group hover:border-green-500/40 transition-all ${
                            editingSentenceIndex === index 
                              ? 'border-green-500/60 bg-green-500/10' 
                              : 'border-green-500/20'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs cyber-number cyber-tabular text-green-500/70">#{index + 1}</span>
                                <p className="cyber-text text-gray-200 text-sm select-text">{sentence.text}</p>
                                {editingSentenceIndex === index && (
                                  <span className="text-xs cyber-text text-yellow-400/70 animate-pulse">[编辑中]</span>
                                )}
                              </div>
                              {sentence.translation && (
                                <p className="text-xs cyber-text text-gray-400 mb-2 ml-6 select-text">{sentence.translation}</p>
                              )}
                              <p className="text-xs cyber-label text-green-500/60 ml-6">
                                TIME: [<span className="cyber-number cyber-tabular">{sentence.startTime.toFixed(2)}</span>s - <span className="cyber-number cyber-tabular">{sentence.endTime.toFixed(2)}</span>s]
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditSentence(index)}
                                className={`text-green-400/60 hover:text-green-400 cyber-button-text text-xs transition-colors px-2 py-1 border rounded ${
                                  editingSentenceIndex === index
                                    ? 'border-green-500/60 bg-green-500/20 text-green-300'
                                    : 'border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10'
                                }`}
                                disabled={editingSentenceIndex === index}
                              >
                                {editingSentenceIndex === index ? 'EDITING' : 'EDIT'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditRemoveSentence(index)}
                                className="text-red-400/60 hover:text-red-400 cyber-button-text text-xs transition-colors px-2 py-1 border border-red-500/30 hover:border-red-500/50 rounded"
                              >
                                DEL
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 娣诲姞/缂栬緫鍙ュ瓙琛ㄥ崟 */}
                  <div className="p-6 bg-black/30 border border-green-500/20 rounded space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-green-500"></div>
                        <h3 className="text-green-400 cyber-label text-sm">
                          {editingSentenceIndex !== null ? (
                            <>EDIT SEGMENT #<span className="cyber-number cyber-tabular">{editingSentenceIndex + 1}</span></>
                          ) : 'ADD NEW SEGMENT'}
                        </h3>
                      </div>
                      {editingSentenceIndex !== null && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="text-gray-400/70 hover:text-gray-300 cyber-button-text text-xs transition-colors px-3 py-1 border border-gray-600/30 hover:border-gray-500/50 rounded"
                        >
                          CANCEL EDIT
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                        ENGLISH TEXT *
                      </label>
                      <textarea
                        value={editCurrentSentence.text}
                        onChange={(e) =>
                          setEditCurrentSentence({ ...editCurrentSentence, text: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all resize-none"
                        rows={3}
                        placeholder="Enter English sentence..."
                      />
                    </div>

                    <div>
                      <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                        CHINESE TRANSLATION
                      </label>
                      <input
                        type="text"
                        value={editCurrentSentence.translation}
                        onChange={(e) =>
                          setEditCurrentSentence({ ...editCurrentSentence, translation: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                        placeholder="Enter Chinese translation (optional)..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                          <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                          START TIME (S) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editCurrentSentence.startTime}
                          onChange={(e) =>
                            setEditCurrentSentence({
                              ...editCurrentSentence,
                              startTime: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-number cyber-tabular text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                          <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                          END TIME (S) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editCurrentSentence.endTime}
                          onChange={(e) =>
                            setEditCurrentSentence({
                              ...editCurrentSentence,
                              endTime: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-number cyber-tabular text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleEditAddSentence}
                      className="w-full px-6 py-3 bg-green-500/10 border-2 border-green-500/50 cyber-button-text text-green-400 text-sm hover:bg-green-500/20 hover:border-green-500/70 hover:text-green-300 transition-all duration-300"
                    >
                      {editingSentenceIndex !== null ? '✓ UPDATE SEGMENT' : '+ ADD SEGMENT'}
                    </button>
                  </div>
                </div>

                {/* 搴曢儴鎿嶄綔鏍?*/}
                <div className="flex gap-4 pt-6 border-t-2 border-green-500/30 relative" style={{ zIndex: 100 }}>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 px-8 py-4 bg-green-500/20 border-2 border-green-500/60 cyber-button-text text-green-400 text-sm hover:bg-green-500/30 hover:border-green-500/80 hover:text-green-300 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-green-500/20 disabled:hover:border-green-500/60 disabled:hover:text-green-400 cursor-pointer relative"
                  style={{ zIndex: 100 }}
                >
                  {isUpdating ? '[ UPDATING... ]' : '[ UPDATE ]'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-8 py-4 bg-black/40 border-2 border-gray-600/50 cyber-button-text text-gray-400 text-sm hover:bg-black/60 hover:border-gray-500/70 hover:text-gray-300 transition-all duration-300 cursor-pointer relative"
                  style={{ zIndex: 100 }}
                >
                  [ CANCEL ]
                </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
