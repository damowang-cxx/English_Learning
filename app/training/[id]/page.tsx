'use client'

import { type ReactNode, useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/TranslationContext'
import { useDictationMode } from '@/contexts/DictationModeContext'
import { getAudioSrc, withBasePath } from '@/lib/base-path'
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
}

interface SentenceDictationState {
  inputs: string[]
  submittedResult: DictationSentenceResult | null
}

const createEmptySentenceVocabularyState = (): SentenceVocabularyState => ({
  items: [],
  form: createEmptyVocabularyFormState(),
  saveStatus: 'idle',
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
  const [expandedTranslations, setExpandedTranslations] = useState<Set<string>>(new Set())
  const [collapsedGlobalTranslations, setCollapsedGlobalTranslations] = useState<Set<string>>(new Set())
  const [repeatMode, setRepeatMode] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [sentenceVocabulary, setSentenceVocabulary] = useState<Record<string, SentenceVocabularyState>>({})
  const [sentenceDictation, setSentenceDictation] = useState<Record<string, SentenceDictationState>>({})
  const [isVocabularyBookExpanded, setIsVocabularyBookExpanded] = useState(false)
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

  useEffect(() => {
    fetchTrainingItem()
  }, [params.id])

  useEffect(() => {
    if (item) {
      fetchUserNotes()
    }
  }, [item])

  useEffect(() => {
    setExpandedTranslations(new Set())
    setCollapsedGlobalTranslations(new Set())
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
        const nextSubmittedResult =
          existing?.submittedResult && existing.submittedResult.entries.length === model.words.length
            ? existing.submittedResult
            : null

        nextState[sentence.id] = {
          inputs: nextInputs,
          submittedResult: nextSubmittedResult,
        }
      }

      return nextState
    })
  }, [item])

  useEffect(() => {
    const storedFontId = window.localStorage.getItem(TRAINING_SENTENCE_FONT_STORAGE_KEY)

    if (storedFontId && isTrainingSentenceFontId(storedFontId)) {
      setSelectedSentenceFontId(storedFontId)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(TRAINING_SENTENCE_FONT_STORAGE_KEY, selectedSentenceFontId)
  }, [selectedSentenceFontId])

  // 全屏模式下隐藏仪表盘
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
    return () => {
      setIsDictationMode(false)
    }
  }, [setIsDictationMode])

  // 禁用 body 滚动条，确保只有 HUD 内部有滚动
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    
    // 禁用 body 和 html 的滚动
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    
    return () => {
      // 恢复原始样式
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 如果正在输入，不处理快捷键
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
  }, [isPlaying, duration, isEditing])

  // 播放速度控制
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // 自动滚动到当前播放的句子
  useEffect(() => {
    if (isDictationMode) {
      return
    }

    if (currentSentenceIndex >= 0 && sentenceRefs.current[currentSentenceIndex] && contentRef.current) {
      const sentenceElement = sentenceRefs.current[currentSentenceIndex]
      const container = contentRef.current
      
      const containerRect = container.getBoundingClientRect()
      const sentenceRect = sentenceElement.getBoundingClientRect()
      
      // 如果句子不在可视区域内，滚动到句子位置
      if (sentenceRect.top < containerRect.top || sentenceRect.bottom > containerRect.bottom) {
        scrollSentenceWithinContainer(container, sentenceElement, 'smooth')
      }
    }
  }, [currentSentenceIndex, isDictationMode])

  // 通知自动消失
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
      // 更新已存在的句子
      const updatedSentences = [...editSentences]
      updatedSentences[editingSentenceIndex] = { ...editCurrentSentence }
      setEditSentences(updatedSentences)
      setEditingSentenceIndex(null)
    } else {
      // 添加新句子
      setEditSentences([...editSentences, { ...editCurrentSentence }])
    }
    
    // 清空表单
    const lastEndTime = editSentences.length > 0 
      ? editSentences[editSentences.length - 1].endTime 
      : (editingSentenceIndex !== null && editSentences[editingSentenceIndex] 
        ? editSentences[editingSentenceIndex].endTime 
        : 0)
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: lastEndTime,
      endTime: lastEndTime
    })
  }

  const handleEditSentence = (index: number) => {
    // 如果已经在编辑另一个句子，先取消
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
    // 如果删除的是正在编辑的句子，取消编辑状态
    if (editingSentenceIndex === index) {
      handleCancelEdit()
    } else if (editingSentenceIndex !== null && editingSentenceIndex > index) {
      // 如果删除的句子在正在编辑的句子之前，需要调整编辑索引
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
    
    if (hasUnsaved) {
      const shouldAdd = window.confirm('检测到未保存的句子分段，是否先添加到列表？\n\n如果选择"取消"，将只提交已保存的句子。')
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
    
    if (!editTitle || finalSentences.length === 0) {
      setNotification({ type: 'error', message: '请填写标题和至少一个句子分段' })
      return
    }

    setIsUpdating(true)
    try {
      const formData = new FormData()
      formData.append('title', editTitle)
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
      setNotification({ type: 'error', message: '淇濆瓨璇嶆眹澶辫触锛岃閲嶈瘯' })
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
    vocabularySaveTimersRef.current = {}
    vocabularySaveResetTimersRef.current = {}
    pendingVocabularySaveRef.current = {}
    vocabularySaveInFlightRef.current = {}

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
              items: parseVocabularyWords(data.words || ''),
              form: createEmptyVocabularyFormState(),
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
    }))
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
      return
    }

    addVocabularyItemsToSentence(sentenceId, [nextEntry], {
      immediate: true,
      resetForm: true,
    })
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

  const handleDictationInputChange = (
    sentenceId: string,
    model: DictationSentenceModel,
    wordIndex: number,
    value: string
  ) => {
    const word = model.words[wordIndex]

    if (!word) {
      return
    }

    const sanitizedValue = sanitizeDictationInput(value).slice(0, word.maxLength)

    updateSentenceDictationState(sentenceId, model, (current) => {
      const nextInputs = [...current.inputs]
      nextInputs[wordIndex] = sanitizedValue

      return {
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
    const word = model.words[wordIndex]

    if (!word) {
      return
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleSentenceClick = (sentence: Sentence) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.startTime
      audioRef.current.play()
      setIsPlaying(true)
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
      if (audioRef.current && item) {
        const sentence = item.sentences[index]
        audioRef.current.currentTime = sentence.startTime
        audioRef.current.play()
      }
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
  const trainingShellClassName = isFullscreen
    ? 'relative z-10 flex h-full flex-col gap-6 px-10 py-8 md:gap-7 md:px-12 md:py-9 xl:gap-8 xl:px-16 xl:py-12'
    : 'relative z-10 flex flex-col gap-5 px-8 py-6 md:gap-6 md:px-10 md:py-7 xl:gap-7 xl:px-12 xl:py-8'
  const trainingOuterInsetClassName = isFullscreen
    ? 'mx-4 md:mx-6 xl:mx-8'
    : 'mx-2 md:mx-3 xl:mx-4'
  const hudPanelClassName = 'training-future-panel'
  const hudPanelHeaderClassName = 'training-future-panel-header'
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
    <div className="training-future-inset training-future-inset--review mt-3 px-4 py-3">
      <div className="mb-2 text-[10px] cyber-label tracking-[0.24em] text-green-500/40">
        VERIFIED SENTENCE
      </div>
      <div className="max-w-[46rem] text-[15px] leading-[1.9] text-green-100/92">
        {model.segments.map((segment, segmentIndex) => (
          <span key={`review-segment-${segmentIndex}`}>
            {segmentIndex > 0 ? ' ' : null}
            {segment.tokens.map((token, tokenIndex) => {
              if (token.type !== 'word') {
                return (
                  <span key={`review-token-${segmentIndex}-${tokenIndex}`} className="text-green-300/80">
                    {token.value}
                  </span>
                )
              }

              const reviewEntry = result.entries[token.wordIndex]

              if (!reviewEntry) {
                return (
                  <span key={`review-token-${segmentIndex}-${tokenIndex}`} className="text-green-100/92">
                    {token.displayText}
                  </span>
                )
              }

              return (
                <span
                  key={`review-token-${segmentIndex}-${tokenIndex}`}
                  className={reviewEntry.isCorrect ? 'text-green-100/92' : 'text-red-300 underline decoration-red-400/70 decoration-dotted underline-offset-4'}
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
      className={`min-h-screen relative flex items-center justify-center transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-[100] training-fullscreen' : ''
      }`}
      style={isFullscreen ? {} : { paddingBottom: '45vh', paddingTop: '10vh' }}
    >
        {/* HUD屏幕容器 - 赛博朋克绿色主题 */}
        <div 
          className={`mx-auto relative transition-all duration-300 ${
            isFullscreen ? 'w-[98%] h-[98vh]' : 'w-[95%] max-w-6xl'
          }`}
          style={{ zIndex: isFullscreen ? 100 : 50 }}
        >
          {/* 主HUD屏幕 - 半透明 */}
          <div
            data-training-frame
            className={`relative backdrop-blur-md border-2 border-green-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)] transition-all duration-300 ${
            isFullscreen ? 'bg-black/30 h-full' : 'bg-black/40'
          }`}
            style={{
            boxShadow: '0 0 40px rgba(10,255,10,0.25), inset 0 0 30px rgba(10,255,10,0.1), 0 0 60px rgba(10,255,10,0.15)'
          }}
          >
            {/* 边框发光效果 */}
            <div className="absolute inset-0 border-2 border-green-400/20 rounded-lg pointer-events-none animate-pulse" style={{
              boxShadow: 'inset 0 0 15px rgba(10,255,10,0.2), 0 0 20px rgba(10,255,10,0.15)'
            }}></div>
            
            {/* 能量波动效果 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(10,255,10,0.04)_40%,transparent_70%)] animate-pulse" style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,transparent_0%,rgba(10,255,10,0.03)_30%,transparent_60%)] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
            </div>

            {/* 粒子背景效果 */}
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
          {/* HUD网格背景 - 增强版 */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>
          
          {/* 网格光点效果 */}
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

          {/* 扫描线效果 - 多层 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.02),rgba(10,255,10,0.01),rgba(10,255,10,0.02))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-30"></div>
          
          {/* 垂直扫描线 */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(10,255,10,0.05)_50%,transparent_100%)] bg-[length:100%_4px] pointer-events-none opacity-20 animate-scan-vertical" style={{ animationDuration: '3s' }}></div>
          
          {/* 水平扫描线 */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(10,255,10,0.04)_50%,transparent_100%)] bg-[length:4px_100%] pointer-events-none opacity-15 animate-shimmer" style={{ animationDuration: '4s' }}></div>

          {/* 角落装饰 - 增强版 */}
          {/* 左上角 */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-green-400/40"></div>
            <div className="absolute top-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute top-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
            <div className="absolute top-0 left-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 右上角 */}
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50 pointer-events-none">
            <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-green-400/40"></div>
            <div className="absolute top-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute top-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
            <div className="absolute top-0 right-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 左下角 */}
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-green-400/40"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute bottom-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 右下角 */}
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-green-400/40"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute bottom-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
            <div className="absolute bottom-0 right-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 边缘光效 */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>

          {/* 通知提示 */}
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
            <div className={`training-future-commanddeck ${trainingOuterInsetClassName} px-4 py-3 md:px-5 md:py-4`}>
              <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="training-future-kicker inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] cyber-label tracking-[0.28em] text-green-400/75">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400/70 shadow-[0_0_4px_rgba(10,255,10,0.45)]"></span>
                    <span>TRAINING MODULE</span>
                  </div>
                  <h1 className="mt-3 max-w-4xl break-words text-2xl leading-tight text-green-100 md:text-3xl xl:text-[2rem] cyber-title">
                    {item.title}
                  </h1>
                  <div className="mt-2 text-[11px] cyber-label tracking-[0.18em] text-green-500/45">
                    FOCUSED LISTENING SESSION
                  </div>
                </div>
                <div className="training-future-toolbar flex flex-wrap items-center gap-2 xl:max-w-[52%] xl:justify-end">
                  <div className="training-future-control-shell relative flex items-center gap-2 px-3 py-1.5 text-xs text-green-400/70 shadow-[0_0_12px_rgba(10,255,10,0.05)]">
                    <span className="text-[10px] cyber-label tracking-[0.22em] text-green-400/70">
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
                        className="training-font-select training-future-select h-7 w-full appearance-none rounded px-2.5 pr-8 text-[12px] text-green-100 outline-none transition-all"
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
                        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-green-400/75"
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
                    className="training-future-toolbar-button group/btn relative flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-green-400/70 transition-all hover:text-green-300"
                    style={{ zIndex: 100 }}
                  >
                    <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100"></div>
                    <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="relative z-10 cyber-button-text">EDIT</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTrainingItem}
                    disabled={isDeleting}
                    className={`training-future-toolbar-button group/btn relative flex items-center gap-2 px-3 py-1.5 text-xs transition-all ${
                      isDeleting
                        ? 'cursor-not-allowed text-red-300/45'
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
                    className="training-future-toolbar-button group/btn relative flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-green-400/70 transition-all hover:text-green-300"
                    style={{ zIndex: 100 }}
                    title={isFullscreen ? '缩小' : '全屏'}
                  >
                    <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100"></div>
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
                    className="training-future-toolbar-button group/btn relative cursor-pointer px-3 py-1.5 text-xs text-green-400/70 transition-all hover:text-green-300"
                    style={{ zIndex: 100 }}
                  >
                    <div className="absolute inset-0 rounded bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100"></div>
                    <span className="relative z-10 cyber-button-text">← BACK</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 内容区域 - 带自定义滚动条（仅在HUD屏幕右侧） */}
            <div
              ref={contentRef}
              className={`training-future-content relative ${trainingOuterInsetClassName} training-hud-content min-h-0 ${
                isFullscreen ? 'flex-1' : ''
              }`}
              style={{
                maxHeight: isFullscreen ? undefined : '75vh',
              }}
            >
              <div className="relative px-4 py-4 md:px-5 md:py-5 xl:px-6 xl:py-6">
                <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
              <aside className="order-1 xl:order-2 xl:sticky xl:top-0">
                <div className="space-y-6">
                  <div className={`${hudPanelClassName} training-vocabulary-book-panel p-4 md:p-5`}>
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,255,10,0.05)_0%,transparent_55%)] opacity-60"></div>
                    <div className={hudPanelHeaderClassName}>
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-1 bg-green-500/80"></div>
                        <div>
                          <h3 className="text-sm cyber-label tracking-[0.28em] text-green-300">AUDIO PLAYER</h3>
                          <div className="mt-1 text-[10px] cyber-label text-green-500/50">
                            TIMELINE / PLAYBACK / SPEED
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
                        <div className="inline-flex items-center gap-2 text-sm cyber-text text-green-400/70">
                          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                          <span>[ LOADING AUDIO... ]</span>
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
                            className="audio-slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-black/60"
                            style={{
                              background: `linear-gradient(to right, rgba(10,255,10,0.58) 0%, rgba(10,255,10,0.58) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) 100%)`
                            }}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                          <button
                            type="button"
                            onClick={handlePlayPause}
                            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/45 bg-green-500/10 transition-all hover:border-green-500/70 hover:bg-green-500/20"
                            style={{ boxShadow: '0 0 15px rgba(10,255,10,0.25)' }}
                            title="播放/暂停 (空格)"
                          >
                            {isPlaying ? (
                              <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                              </svg>
                            ) : (
                              <svg className="ml-1 h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            )}
                          </button>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="training-future-stat-box rounded-lg px-2 py-2 text-center">
                              <div className="mb-1 text-[10px] cyber-label text-green-500/55">CURRENT</div>
                              <div className="text-sm cyber-number cyber-tabular text-green-300">{formatTime(currentTime)}</div>
                            </div>
                            <div className="training-future-stat-box rounded-lg px-2 py-2 text-center">
                              <div className="mb-1 text-[10px] cyber-label text-green-500/55">TOTAL</div>
                              <div className="text-sm cyber-number cyber-tabular text-green-300/80">{formatTime(duration)}</div>
                            </div>
                            <div className="training-future-stat-box rounded-lg px-2 py-2 text-center">
                              <div className="mb-1 text-[10px] cyber-label text-green-500/55">PROGRESS</div>
                              <div className="text-sm cyber-number cyber-tabular text-green-300">
                                {duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-green-500/15 pt-3">
                          <div className="mb-2 text-[10px] cyber-label tracking-[0.24em] text-green-500/50">
                            SPEED CONTROL
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 0.75, 1, 1.25, 1.5].map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => handleSpeedChange(rate)}
                                className={`training-future-mini-button rounded px-3 py-1 text-xs cyber-button-text transition-all ${
                                  playbackRate === rate
                                    ? 'border-green-500/70 bg-green-500/25 text-green-200'
                                    : 'border-green-500/25 bg-black/35 text-green-400/70 hover:border-green-500/45 hover:bg-green-500/10'
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="training-future-inset rounded-lg px-3 py-2">
                          <div className="flex h-4 items-end gap-1">
                            {PLAYER_VISUALIZER_BARS.map((height, index) => (
                              <div
                                key={index}
                                className="flex-1 rounded-t bg-green-500/35 transition-all duration-150"
                                style={{
                                  height: `${height}%`,
                                  opacity: isPlaying ? 0.95 : 0.45,
                                  boxShadow: isPlaying ? '0 0 5px rgba(10,255,10,0.35)' : 'none',
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
                              <div className="text-sm cyber-label tracking-[0.28em] text-amber-200">DICTATION LOCK</div>
                              <div className="mt-1 text-[10px] cyber-label text-amber-300/55">
                                Vocabulary and translations stay hidden while dictation mode is active.
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="training-future-inset training-future-inset--warning mt-4 rounded-lg px-4 py-5 text-center">
                          <div className="text-sm cyber-text text-amber-100/80">Listen first. Reveal notes after you finish the line.</div>
                          <div className="mt-2 text-[10px] cyber-label text-amber-300/55">
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
                        <div className="h-4 w-1 bg-green-500/80"></div>
                        <div className="min-w-0">
                          <div className="text-sm cyber-label tracking-[0.28em] text-green-300">VOCABULARY BOOK</div>
                          <div className="mt-1 text-[10px] cyber-label text-green-500/50">
                            {vocabularyBook.length} UNIQUE / {totalVocabularyEntries} TOTAL
                          </div>
                        </div>
                      </button>
                      <div className="training-vocabulary-book-actions flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={isVocabularyBookExpanded ? closeVocabularyBook : openVocabularyBook}
                          className="training-vocabulary-book-toggle training-future-mini-button flex items-center rounded px-2 py-1 text-[10px] cyber-button-text text-green-300/80 transition-colors hover:border-green-500/30 hover:text-green-200"
                          aria-expanded={isVocabularyBookExpanded}
                          aria-label={isVocabularyBookExpanded ? 'Hide vocabulary book' : 'Show vocabulary book'}
                          title={isVocabularyBookExpanded ? 'Hide vocabulary book' : 'Show vocabulary book'}
                        >
                          {isVocabularyBookExpanded ? 'HIDE' : 'SHOW'}
                        </button>
                        <button
                          type="button"
                          onClick={isVocabularyBookExpanded ? closeVocabularyBook : openVocabularyBook}
                          className="training-vocabulary-book-toggle training-future-mini-button flex h-7 w-7 items-center justify-center rounded text-green-300/80 transition-colors hover:border-green-500/30 hover:text-green-200"
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
                          <div className="training-future-inset mt-0 rounded-lg border-dashed px-4 py-5 text-center">
                            <div className="text-sm cyber-text text-green-300/75">No vocabulary recorded on this page yet.</div>
                            <div className="mt-2 text-[10px] cyber-label text-green-500/50">
                              Add structured entries under any sentence to build the notebook.
                            </div>
                          </div>
                        ) : (
                          <div className="training-vocabulary-book-scroll training-subpanel-scroll max-h-[320px] space-y-3 overflow-y-auto pr-1 xl:max-h-[360px]">
                            {vocabularyBook.map((entry) => (
                              <div
                                key={entry.normalizedKey}
                                className="training-vocabulary-book-record training-future-record rounded-lg px-4 py-3"
                              >
                                <div className="flex flex-col gap-3">
                                  <button
                                    type="button"
                                    onClick={() => scrollToSentence(entry.sentences[0].sentenceId)}
                                    className="text-left transition-colors hover:text-green-200"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm cyber-font-readable font-bold text-green-200">{entry.label}</span>
                                      <span className="text-[10px] cyber-label text-green-500/70">[x{entry.count}]</span>
                                    </div>
                                  </button>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.sentences.map((source) => (
                                      <button
                                        type="button"
                                        key={`${entry.normalizedKey}-${source.sentenceId}`}
                                        onClick={() => scrollToSentence(source.sentenceId)}
                                        title={source.sentenceText}
                                        className="rounded border border-green-500/25 bg-green-500/5 px-2 py-1 text-[10px] cyber-button-text text-green-300/80 transition-colors hover:border-green-500/45 hover:bg-green-500/10"
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

              <section className="order-2 min-w-0 xl:order-1">
                <div className="pt-2 pb-6 md:pt-3 md:pb-8">
                  <div className="training-future-stream-header mb-6 flex flex-col gap-3 pb-5 md:mb-7 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="text-[10px] cyber-label tracking-[0.3em] text-green-400/72">SENTENCE STREAM</div>
                      <div className="mt-1 text-[11px] cyber-label text-green-500/45">
                        {isDictationMode
                          ? 'Listen first. Type the words you hear before revealing the line.'
                          : 'Read line by line. Let the English stay in front.'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] cyber-label text-green-500/60">
                      <span className="rounded-full border border-green-500/[0.16] bg-black/20 px-2.5 py-1">
                        {item.sentences.length} SEGMENTS
                      </span>
                      {activeSentenceLabel && (
                        <span className="rounded-full border border-green-400/[0.18] bg-green-500/[0.08] px-2.5 py-1 text-green-300/80">
                          ACTIVE {activeSentenceLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pl-5 md:pl-5 xl:pl-5 space-y-6 md:space-y-7 xl:space-y-8">
                    {item.sentences.map((sentence, index) => {
                      const isActive = currentSentenceIndex === index
                      const isRepeating = repeatMode === index
                      const isNotesExpanded = expandedNotes.has(sentence.id)
                      const vocabularyState =
                        sentenceVocabulary[sentence.id] || createEmptySentenceVocabularyState()
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
                          className={`training-future-sentence-card${isActive ? ' is-active' : ''}`}
                        >
                          <div className="training-future-sentence-glow absolute inset-0"></div>
                          {isActive && (
                            <div className="training-future-sentence-rail absolute inset-y-6 left-0 w-[2px] rounded-r-full"></div>
                          )}
                          <div
                            className={`training-future-sentence-divider pointer-events-none absolute bottom-0 left-8 right-6 h-px ${
                              isActive ? 'is-active opacity-75' : 'opacity-40'
                            }`}
                          ></div>

                          <div className="relative z-10 pr-4 pl-5 py-[14px] md:pr-[18px] md:pl-6 md:py-4 xl:pr-5 xl:pl-7 xl:py-[18px]">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                <span
                                  className={`inline-flex min-w-[3.25rem] justify-center rounded-full border px-2 py-1 ${
                                    isActive
                                      ? 'border-green-400/35 bg-green-500/15 text-green-200'
                                      : 'border-green-500/20 bg-black/30 text-green-400/70'
                                  }`}
                                >
                                  S{sentence.order + 1}
                                </span>
                                <span className="rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2.5 py-1 text-green-500/[0.58]">
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
                                        ? 'border-green-400/[0.24] bg-green-500/[0.09] text-green-200'
                                        : 'border-green-500/[0.16] bg-black/[0.16] text-green-300/90 hover:border-green-500/[0.28] hover:bg-green-500/[0.05] hover:text-green-200'
                                      : isDictationMode && hasTranslation
                                      ? 'cursor-not-allowed border-amber-400/[0.14] bg-black/[0.12] text-amber-200/35'
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
                                      : 'border-green-500/[0.16] bg-black/[0.16] text-green-300/90 hover:border-green-500/[0.28] hover:bg-green-500/[0.05] hover:text-green-200'
                                  }`}
                                title="单句重复播放"
                              >
                                🔁
                              </button>
                              </div>
                            </div>

                            {isDictationMode ? (
                              <div className="mt-3.5 border-t border-amber-400/[0.08] pt-3">
                                <div
                                  onClick={() => handleSentenceClick(sentence)}
                                  className={`training-future-dictation-surface rounded-xl px-4 py-4 transition-all ${
                                    isActive
                                      ? 'is-active'
                                      : ''
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-[10px] cyber-label tracking-[0.24em] text-amber-200/75">
                                      DICTATION GRID
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                      <span className="rounded-full border border-amber-400/18 bg-black/20 px-2 py-0.5 text-amber-200/75">
                                        {dictationModel.words.length} WORDS
                                      </span>
                                      {dictationResult && (
                                        <span className="rounded-full border border-amber-400/22 bg-amber-500/[0.08] px-2 py-0.5 text-amber-100">
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
                                                  token.type === 'hyphen' ? 'text-green-300/80' : 'text-green-400/60'
                                                }`}
                                              >
                                                {token.value}
                                              </span>
                                            )
                                          }

                                          const wordInputValue = dictationState.inputs[token.wordIndex] || ''
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
                                                  isWordFilled
                                                    ? 'border-amber-300/30 bg-amber-500/[0.06] shadow-[0_0_12px_rgba(251,191,36,0.08)]'
                                                    : 'border-green-500/18 bg-black/25 group-hover/word:border-green-400/30 group-hover/word:bg-green-500/[0.04]'
                                                }`}
                                              ></div>
                                              <div className="pointer-events-none absolute inset-x-2 bottom-1 h-px bg-gradient-to-r from-transparent via-green-500/18 to-transparent"></div>
                                              <input
                                                ref={(element) => setDictationInputRef(sentence.id, token.wordIndex, element)}
                                                value={wordInputValue}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => handleDictationInputChange(sentence.id, dictationModel, token.wordIndex, event.target.value)}
                                                onKeyDown={(event) => handleDictationKeyDown(sentence.id, dictationModel, token.wordIndex, event)}
                                                maxLength={token.maxLength}
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                className="relative z-10 h-11 w-full rounded-lg border border-transparent bg-transparent px-2.5 pb-1 pt-2 text-center text-[15px] font-semibold tracking-[0.08em] text-green-100 caret-amber-300 outline-none transition-all focus:border-amber-300/28 focus:bg-amber-500/[0.03] focus:shadow-[0_0_12px_rgba(251,191,36,0.12)]"
                                                aria-label={`Dictation input for ${token.displayText}`}
                                              />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ))}
                                  </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/[0.08] pt-3">
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] cyber-label">
                                      <span className="rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-green-400/75">
                                        NO PUNCTUATION INPUT
                                      </span>
                                      <span className="rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-green-400/75">
                                        SPACE JUMPS WHEN FULL
                                      </span>
                                      <span className="rounded-full border border-amber-400/[0.16] bg-amber-500/[0.05] px-2 py-0.5 text-amber-200/70">
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
                                          ? 'border-amber-300/45 bg-amber-500/[0.12] text-amber-100 hover:border-amber-200/60 hover:bg-amber-500/[0.16]'
                                          : isDictationSentenceCompleteState
                                          ? 'border-amber-400/35 bg-amber-500/[0.08] text-amber-100 hover:border-amber-300/55 hover:bg-amber-500/[0.14]'
                                          : hasAnyDictationInput
                                          ? 'border-amber-400/30 bg-amber-500/[0.05] text-amber-100/90 hover:border-amber-300/45 hover:bg-amber-500/[0.1]'
                                          : 'border-amber-400/24 bg-black/20 text-amber-200/80 hover:border-amber-300/40 hover:bg-amber-500/[0.08]'
                                      }`}
                                      title="Submit this line at any time, even if some words are blank"
                                    >
                                      SUBMIT LINE
                                    </button>
                                  </div>

                                  {dictationResult && renderDictationReview(dictationModel, dictationResult)}

                                  {isTranslationVisible && sentence.translation && (
                                    <div className="training-future-inset mt-3 rounded-lg px-4 py-3">
                                      <div className="mb-1 text-[10px] cyber-label tracking-[0.24em] text-green-500/40">
                                        TRANSLATION
                                      </div>
                                      <p className="max-w-[44rem] text-[13px] leading-[1.75] text-green-200/60 md:text-sm">
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
                              className={`training-future-reading-surface mt-3.5 cursor-pointer px-4 py-1.5 md:px-5 md:py-2 transition-all select-text ${
                                  isActive
                                    ? 'text-green-100'
                                    : 'text-gray-100 hover:text-green-100'
                                }`}
                            >
                              <p className={`max-w-[48rem] text-base cyber-font-readable font-bold leading-[1.9] md:text-[17px] ${selectedSentenceFont.className}`}>
                                {highlightedSentenceText}
                              </p>
                            </div>

                            <div className="mt-3.5 border-t border-green-500/[0.08] pt-2.5">
                              <button
                                type="button"
                                onClick={() => toggleNotes(sentence.id)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs cyber-label tracking-[0.24em] text-green-300/90">VOCABULARY</span>
                                  <span className="rounded-full border border-green-500/[0.12] bg-black/[0.16] px-2 py-0.5 text-[10px] cyber-label text-green-500/[0.6]">
                                    {vocabularyCount} ITEMS
                                  </span>
                                  {saveStatusMeta && (
                                    <span className={`text-[10px] cyber-label ${saveStatusMeta.className}`}>
                                      {saveStatusMeta.label}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className="flex h-5 w-5 items-center justify-center text-green-400/70 transition-transform duration-200"
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
                                <div className="training-future-inset mt-3 rounded-lg px-4 py-3">
                                  <div className="mb-1 text-[10px] cyber-label tracking-[0.24em] text-green-500/40">
                                    TRANSLATION
                                  </div>
                                  <p className="max-w-[44rem] text-[13px] leading-[1.75] text-green-200/60 md:text-sm">
                                    {sentence.translation}
                                  </p>
                                </div>
                              )}

                              {isNotesExpanded && (
                                <div className="training-future-inset training-future-inset--dense mt-2.5 animate-fade-in rounded-xl p-3">
                                  {vocabularyCount > 0 ? (
                                    <div className="mb-3 space-y-2.5">
                                      {vocabularyState.items.map((entry) => {
                                        const entryLabel = formatVocabularyEntry(entry)
                                        const isLegacyEntry = !isVocabularyEntryStructured(entry)

                                        return (
                                          <div
                                            key={`${sentence.id}-${getVocabularyEntryKey(entry)}`}
                                            className={`training-future-record flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 ${
                                              isLegacyEntry
                                                ? 'is-legacy border-dashed'
                                                : ''
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <div className="break-words text-sm cyber-font-readable text-green-100">
                                                {entryLabel}
                                              </div>
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
                                  ) : (
                                    <div className="training-future-inset mb-3 rounded-md border-dashed px-3 py-3 text-[10px] cyber-label text-green-500/50">
                                      No vocabulary yet. Add a structured entry below.
                                    </div>
                                  )}

                                  <form
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      handleVocabularySubmit(sentence.id)
                                    }}
                                    className="training-future-inset training-future-inset--form space-y-3 rounded-lg p-3"
                                  >
                                    <div>
                                      <input
                                        value={vocabularyState.form.headword}
                                        onChange={(event) => handleVocabularyHeadwordChange(sentence.id, event.target.value)}
                                        placeholder="separate"
                                        spellCheck={false}
                                        className="w-full rounded-md border border-green-500/20 bg-black/30 px-3 py-2 text-sm cyber-input-font text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40 focus:outline-none"
                                      />
                                    </div>

                                    <div className="space-y-2.5">
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => handleVocabularyAddSense(sentence.id)}
                                          className="rounded border border-green-500/20 bg-black/30 px-2.5 py-1 text-[10px] cyber-button-text text-green-300/80 transition-colors hover:border-green-500/35 hover:bg-green-500/[0.05] hover:text-green-200"
                                        >
                                          + POS
                                        </button>
                                      </div>

                                      {vocabularyState.form.senses.map((sense, senseIndex) => (
                                        <div
                                          key={`${sentence.id}-sense-${senseIndex}`}
                                          className="training-future-record rounded-lg p-3"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="text-[10px] cyber-label tracking-[0.22em] text-green-500/55">
                                              POS SELECT
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleVocabularyRemoveSense(sentence.id, senseIndex)}
                                              className="rounded-md border border-green-500/16 bg-black/20 px-3 py-2 text-[10px] cyber-button-text text-green-300/70 transition-colors hover:border-red-400/35 hover:text-red-300 disabled:cursor-not-allowed disabled:text-green-500/35"
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
                                                      ? 'border-green-400/38 bg-green-500/[0.14] text-green-100 shadow-[0_0_14px_rgba(10,255,10,0.08)]'
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
                                            placeholder="使分离"
                                            spellCheck={false}
                                            className="mt-3 w-full rounded-md border border-green-500/20 bg-black/30 px-3 py-2 text-sm cyber-input-font text-gray-100 placeholder:text-green-500/35 focus:border-green-500/40 focus:outline-none"
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
                                            ? 'border-green-500/28 bg-green-500/[0.08] text-green-200 hover:border-green-500/45 hover:bg-green-500/[0.12]'
                                            : 'cursor-not-allowed border-green-500/12 bg-black/25 text-green-500/35'
                                        }`}
                                      >
                                        ADD ENTRY
                                      </button>
                                    </div>
                                  </form>
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

      {/* 编辑模态框 */}
      {isEditing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
          <div className="w-[95%] max-w-5xl mx-auto relative bg-black/90 border-2 border-green-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 顶部装饰栏 */}
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

            {/* HUD网格背景 */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>

            {/* 扫描线效果 */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.03),rgba(10,255,10,0.01),rgba(10,255,10,0.03))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-40"></div>

            {/* 角落装饰 */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50"></div>

            {/* 内容区域 */}
            <div className="relative p-8">
              <form onSubmit={handleEditSubmit} className="space-y-8">
                {/* 基础信息区域 */}
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

                {/* 句子分段区域 */}
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

                  {/* 已添加的句子列表 */}
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

                  {/* 添加/编辑句子表单 */}
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
                        required
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
                          required
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
                          required
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

                {/* 底部操作栏 */}
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
