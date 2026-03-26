'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withBasePath } from '@/lib/base-path'

interface Sentence {
  text: string
  translation: string
  startTime: number
  endTime: number
}

interface ImportedSentenceJson {
  index?: number
  en?: string
  zh?: string
  start?: number | string
  end?: number | string
}

interface ImportStatus {
  type: 'success' | 'error'
  message: string
}

type JsonImportMode = 'replace' | 'append'

interface OverlapAnalysis {
  indexes: number[]
  messages: string[]
}

const createEmptySentence = (startTime = 0): Sentence => ({
  text: '',
  translation: '',
  startTime,
  endTime: startTime
})

const getNextDraftTime = (items: Sentence[]) =>
  items.length > 0 ? items[items.length - 1].endTime : 0

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

const normalizeImportedSentence = (record: ImportedSentenceJson, index: number): Sentence => {
  const text = typeof record.en === 'string' ? record.en.trim() : ''
  const translation = typeof record.zh === 'string' ? record.zh.trim() : ''
  const startTime = Number(record.start)
  const endTime = Number(record.end)

  if (!text) {
    throw new Error(`JSON item #${index + 1} is missing "en".`)
  }

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error(`JSON item #${index + 1} has an invalid start/end value.`)
  }

  if (startTime < 0) {
    throw new Error(`JSON item #${index + 1} has a negative start time.`)
  }

  if (endTime <= startTime) {
    throw new Error(`JSON item #${index + 1} must have end > start.`)
  }

  return { text, translation, startTime, endTime }
}

const orderImportedRecords = (records: ImportedSentenceJson[]) => {
  const shouldSortByIndex = records.every(
    (record) => typeof record?.index === 'number' && Number.isFinite(record.index)
  )

  if (!shouldSortByIndex) {
    return records
  }

  return [...records].sort((first, second) => (first.index as number) - (second.index as number))
}

const analyzeTimeOverlaps = (items: Sentence[]): OverlapAnalysis => {
  const overlapIndexes = new Set<number>()
  const sortedItems = items
    .map((sentence, index) => ({ ...sentence, index }))
    .sort((first, second) => {
      if (first.startTime !== second.startTime) {
        return first.startTime - second.startTime
      }

      return first.endTime - second.endTime
    })

  const messages: string[] = []

  for (let index = 1; index < sortedItems.length; index += 1) {
    const previous = sortedItems[index - 1]
    const current = sortedItems[index]

    if (current.startTime < previous.endTime) {
      overlapIndexes.add(previous.index)
      overlapIndexes.add(current.index)
      messages.push(
        `#${previous.index + 1} (${previous.startTime.toFixed(2)}-${previous.endTime.toFixed(2)}) overlaps #${current.index + 1} (${current.startTime.toFixed(2)}-${current.endTime.toFixed(2)})`
      )
    }
  }

  return {
    indexes: [...overlapIndexes],
    messages
  }
}

export default function UploadPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [currentSentence, setCurrentSentence] = useState<Sentence>(createEmptySentence())
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<number | null>(null)
  const [jsonImportMode, setJsonImportMode] = useState<JsonImportMode>('replace')
  const [jsonImportText, setJsonImportText] = useState('')
  const [jsonImportStatus, setJsonImportStatus] = useState<ImportStatus | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const titleInputRef = useRef<HTMLInputElement>(null)
  const englishTextRef = useRef<HTMLTextAreaElement>(null)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const jsonFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const nextDraftTime = useMemo(() => getNextDraftTime(sentences), [sentences])

  const hasUnsavedSentence = useMemo(() => {
    const baseline =
      editingSentenceIndex !== null
        ? sentences[editingSentenceIndex]
        : createEmptySentence(nextDraftTime)

    if (!baseline) {
      return false
    }

    return (
      currentSentence.text !== baseline.text ||
      currentSentence.translation !== baseline.translation ||
      currentSentence.startTime !== baseline.startTime ||
      currentSentence.endTime !== baseline.endTime
    )
  }, [currentSentence, editingSentenceIndex, nextDraftTime, sentences])

  const overlapAnalysis = useMemo(() => analyzeTimeOverlaps(sentences), [sentences])
  const overlapIndexSet = useMemo(() => new Set(overlapAnalysis.indexes), [overlapAnalysis.indexes])

  const resetCurrentSentence = (nextSentences: Sentence[]) => {
    setCurrentSentence(createEmptySentence(getNextDraftTime(nextSentences)))
    setEditingSentenceIndex(null)
    setValidationErrors({})
  }

  const validateCurrentSentence = () => {
    const nextErrors: Record<string, string> = {}

    if (!currentSentence.text.trim()) {
      nextErrors.text = 'Please enter the English sentence.'
    }

    if (currentSentence.startTime < 0) {
      nextErrors.startTime = 'Start time cannot be negative.'
    }

    if (currentSentence.endTime <= currentSentence.startTime) {
      nextErrors.endTime = 'End time must be greater than start time.'
    }

    setValidationErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleAddSentence = () => {
    if (!validateCurrentSentence()) {
      return
    }

    const nextSentence: Sentence = {
      text: currentSentence.text.trim(),
      translation: currentSentence.translation.trim(),
      startTime: currentSentence.startTime,
      endTime: currentSentence.endTime
    }

    const nextSentences =
      editingSentenceIndex === null
        ? [...sentences, nextSentence]
        : sentences.map((sentence, index) =>
            index === editingSentenceIndex ? nextSentence : sentence
          )

    setSentences(nextSentences)
    setErrors((prev) => ({ ...prev, sentences: '', submit: '' }))
    setJsonImportStatus(null)
    resetCurrentSentence(nextSentences)

    setTimeout(() => {
      englishTextRef.current?.focus()
    }, 0)
  }

  const handleEditSentence = (index: number) => {
    setCurrentSentence({ ...sentences[index] })
    setEditingSentenceIndex(index)
    setValidationErrors({})
    setJsonImportStatus(null)

    setTimeout(() => {
      englishTextRef.current?.focus()
    }, 0)
  }

  const handleCancelEdit = () => {
    resetCurrentSentence(sentences)
  }

  const handleRemoveSentence = (index: number) => {
    const nextSentences = sentences.filter((_, sentenceIndex) => sentenceIndex !== index)
    setSentences(nextSentences)
    setErrors((prev) => ({ ...prev, sentences: '' }))
    setJsonImportStatus(null)

    if (editingSentenceIndex === null) {
      return
    }

    if (editingSentenceIndex === index) {
      resetCurrentSentence(nextSentences)
      return
    }

    if (editingSentenceIndex > index) {
      setEditingSentenceIndex(editingSentenceIndex - 1)
    }
  }

  const runImport = ({
    rawText,
    sourceLabel,
    mode
  }: {
    rawText: string
    sourceLabel: string
    mode: JsonImportMode
  }) => {
    const parsed = JSON.parse(rawText)

    if (!Array.isArray(parsed)) {
      throw new Error('The JSON root must be an array.')
    }

    const orderedRecords = orderImportedRecords(parsed as ImportedSentenceJson[])
    const importedSentences = orderedRecords.map((record, index) =>
      normalizeImportedSentence(record, index)
    )

    const shouldConfirmReplace =
      mode === 'replace' &&
      (sentences.length > 0 || hasUnsavedSentence || editingSentenceIndex !== null)
    const shouldConfirmAppend =
      mode === 'append' && (hasUnsavedSentence || editingSentenceIndex !== null)

    if (
      shouldConfirmReplace &&
      !window.confirm(
        'Replace mode will clear the current sentence list and the current draft. Continue?'
      )
    ) {
      return
    }

    if (
      shouldConfirmAppend &&
      !window.confirm(
        'Append mode will keep the current list but clear the current draft/editing state. Continue?'
      )
    ) {
      return
    }

    const nextSentences =
      mode === 'append' ? [...sentences, ...importedSentences] : importedSentences
    const nextOverlapAnalysis = analyzeTimeOverlaps(nextSentences)

    setSentences(nextSentences)
    setErrors((prev) => ({ ...prev, sentences: '', submit: '' }))
    resetCurrentSentence(nextSentences)
    setJsonImportStatus({
      type: 'success',
      message:
        mode === 'append'
          ? `Imported ${importedSentences.length} segments from ${sourceLabel} and appended them to the list.${nextOverlapAnalysis.messages.length > 0 ? ` Detected ${nextOverlapAnalysis.messages.length} time overlap(s).` : ''}`
          : `Imported ${importedSentences.length} segments from ${sourceLabel}.${nextOverlapAnalysis.messages.length > 0 ? ` Detected ${nextOverlapAnalysis.messages.length} time overlap(s).` : ''}`
    })
  }

  const handleJsonFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const rawText = await file.text()
      runImport({
        rawText,
        sourceLabel: file.name,
        mode: jsonImportMode
      })
    } catch (error) {
      setJsonImportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'JSON import failed.'
      })
    } finally {
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = ''
      }
    }
  }

  const handleJsonTextImport = () => {
    if (!jsonImportText.trim()) {
      setJsonImportStatus({
        type: 'error',
        message: 'Paste JSON text before importing.'
      })
      return
    }

    try {
      runImport({
        rawText: jsonImportText,
        sourceLabel: 'pasted JSON',
        mode: jsonImportMode
      })
      setJsonImportText('')
    } catch (error) {
      setJsonImportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'JSON import failed.'
      })
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void submitForm()
      return
    }

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      document.activeElement === englishTextRef.current
    ) {
      event.preventDefault()
      handleAddSentence()
      return
    }

    if (event.key === 'Tab' && document.activeElement === startTimeRef.current) {
      if (!currentSentence.endTime || currentSentence.endTime <= currentSentence.startTime) {
        setCurrentSentence((prev) => ({ ...prev, endTime: prev.startTime + 1 }))
      }
    }
  }

  const submitForm = async () => {
    const nextErrors: Record<string, string> = {}

    if (!title.trim()) {
      nextErrors.title = 'Please enter the title.'
    }

    if (!audioFile) {
      nextErrors.audio = 'Please choose an audio file.'
    }

    if (sentences.length === 0) {
      nextErrors.sentences = 'Please add at least one saved segment.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.title) {
        titleInputRef.current?.focus()
      }
      return
    }

    if (!audioFile) {
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('audio', audioFile)
      formData.append('sentences', JSON.stringify(sentences))

      const response = await fetch(withBasePath('/api/training-items'), {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const data = await response.json()
      router.push(`/training/${data.id}`)
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
    } finally {
      setIsUploading(false)
    }
  }

  const adjustTime = (field: 'startTime' | 'endTime', delta: number) => {
    setCurrentSentence((prev) => ({
      ...prev,
      [field]: Math.max(0, Number((prev[field] + delta).toFixed(2)))
    }))
    setValidationErrors((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center"
      style={{ paddingBottom: '45vh', paddingTop: '10vh' }}
    >
      <div className="w-[95%] max-w-5xl mx-auto relative" style={{ zIndex: 50 }}>
        <div className="relative overflow-hidden rounded-lg border-2 border-red-500/50 bg-black/70 shadow-[0_0_40px_rgba(255,0,0,0.3),inset_0_0_30px_rgba(255,0,0,0.1)] backdrop-blur-md">
          <div className="relative z-10 border-b-2 border-red-500/50 bg-gradient-to-r from-red-900/30 via-transparent to-transparent p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
                  <h1 className="text-2xl cyber-title text-red-400 cyber-neon">
                    [ UPLOAD MODULE ]
                  </h1>
                </div>
                <div className="mt-2 text-xs cyber-label text-red-500/60">
                  TRAINING ITEM CREATION INTERFACE
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded border border-red-500/30 px-3 py-1 text-sm text-red-400/70 transition-colors hover:border-red-500/50 hover:text-red-300"
              >
                ← BACK
              </button>
            </div>
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(255,0,0,.05)_25%,rgba(255,0,0,.05)_26%,transparent_27%,transparent_74%,rgba(255,0,0,.05)_75%,rgba(255,0,0,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(255,0,0,.05)_25%,rgba(255,0,0,.05)_26%,transparent_27%,transparent_74%,rgba(255,0,0,.05)_75%,rgba(255,0,0,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] opacity-30 pointer-events-none" />

          <div className="relative p-8">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submitForm()
              }}
              onKeyDown={handleKeyDown}
              className="space-y-8"
            >
              <div className="space-y-6">
                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="mb-3 flex items-center gap-2 text-red-400 cyber-label">
                    <span className="h-1 w-1 rounded-full bg-red-400" />
                    TITLE *
                  </label>
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      setErrors((prev) => ({ ...prev, title: '' }))
                    }}
                    className={`w-full border bg-black/40 px-4 py-3 text-gray-200 focus:bg-black/60 focus:outline-none ${
                      errors.title
                        ? 'border-red-500/80'
                        : 'border-red-500/30 focus:border-red-500/60'
                    }`}
                    placeholder="Enter training item title..."
                  />
                  {errors.title ? (
                    <div className="mt-1 text-xs text-red-400/80">! {errors.title}</div>
                  ) : null}
                </div>

                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="mb-3 flex items-center gap-2 text-red-400 cyber-label">
                    <span className="h-1 w-1 rounded-full bg-red-400" />
                    AUDIO FILE *
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => {
                      setAudioFile(event.target.files?.[0] || null)
                      setErrors((prev) => ({ ...prev, audio: '' }))
                    }}
                    className={`w-full border bg-black/40 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-red-500/20 file:px-3 file:py-1 file:text-red-400 ${
                      errors.audio
                        ? 'border-red-500/80'
                        : 'border-red-500/30 focus:border-red-500/60'
                    }`}
                  />
                  {audioFile ? (
                    <div className="mt-2 text-xs text-red-400/70">Selected: {audioFile.name}</div>
                  ) : null}
                  {errors.audio ? (
                    <div className="mt-1 text-xs text-red-400/80">! {errors.audio}</div>
                  ) : null}
                </div>
              </div>

              <div className="border-t-2 border-red-500/30 pt-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-[2px] w-8 bg-red-500" />
                  <h2 className="text-xl cyber-title text-red-400">SENTENCE SEGMENTS</h2>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-red-500/50 to-transparent" />
                  <span className="text-xs cyber-label text-red-500/60">
                    COUNT: <span className="cyber-number cyber-tabular">{sentences.length}</span>
                  </span>
                  {hasUnsavedSentence ? (
                    <span className="text-xs text-yellow-400/70">(+1 UNSAVED)</span>
                  ) : null}
                </div>

                <div className="mb-6 rounded border border-red-500/20 bg-black/30 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-4 w-1 bg-red-500" />
                        <h3 className="text-sm cyber-label text-red-400">IMPORT JSON SEGMENTS</h3>
                      </div>
                      <div className="text-xs text-red-500/60">
                        Supports fields: index, en, zh, start, end
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setJsonImportMode('replace')}
                        className={`rounded border px-3 py-1 text-xs transition-colors ${
                          jsonImportMode === 'replace'
                            ? 'border-red-400/70 bg-red-500/20 text-red-200'
                            : 'border-red-500/30 text-red-400/70 hover:border-red-500/50 hover:text-red-300'
                        }`}
                      >
                        REPLACE
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonImportMode('append')}
                        className={`rounded border px-3 py-1 text-xs transition-colors ${
                          jsonImportMode === 'append'
                            ? 'border-red-400/70 bg-red-500/20 text-red-200'
                            : 'border-red-500/30 text-red-400/70 hover:border-red-500/50 hover:text-red-300'
                        }`}
                      >
                        APPEND
                      </button>
                    </div>
                  </div>

                  <div className="rounded border border-red-500/20 bg-black/30 px-3 py-2 text-[11px] text-red-300/70">
                    JSON files and pasted JSON are parsed locally in the browser only. They are not uploaded or stored.
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs cyber-label text-red-400/80">IMPORT FROM FILE</label>
                    <input
                      ref={jsonFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJsonFileImport}
                      className="w-full border border-red-500/30 bg-black/40 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-red-500/20 file:px-3 file:py-1 file:text-red-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs cyber-label text-red-400/80">OR PASTE JSON TEXT</label>
                    <textarea
                      value={jsonImportText}
                      onChange={(event) => setJsonImportText(event.target.value)}
                      rows={8}
                      className="w-full resize-y border border-red-500/30 bg-black/40 px-4 py-3 text-sm text-gray-200 focus:border-red-500/60 focus:bg-black/60 focus:outline-none"
                      placeholder='Paste a JSON array here, for example: [{"index":1,"en":"...","zh":"...","start":0,"end":4.5}]'
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleJsonTextImport}
                        className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs text-red-300 transition-colors hover:border-red-500/70 hover:bg-red-500/20"
                      >
                        IMPORT PASTED JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonImportText('')}
                        className="rounded border border-gray-600/50 px-4 py-2 text-xs text-gray-300 transition-colors hover:border-gray-500/70 hover:text-gray-100"
                      >
                        CLEAR TEXT
                      </button>
                    </div>
                  </div>

                  {jsonImportStatus ? (
                    <div
                      className={`rounded border px-3 py-2 text-xs ${
                        jsonImportStatus.type === 'success'
                          ? 'border-red-500/40 bg-red-500/10 text-red-300'
                          : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                      }`}
                    >
                      {jsonImportStatus.message}
                    </div>
                  ) : null}

                  {overlapAnalysis.messages.length > 0 ? (
                    <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-3 text-xs text-yellow-200">
                      <div className="font-medium text-yellow-100">
                        Detected {overlapAnalysis.messages.length} time overlap(s).
                      </div>
                      <div className="mt-1 text-yellow-200/80">
                        Highlighted segments below should be reviewed before final upload.
                      </div>
                      <div className="mt-2 space-y-1">
                        {overlapAnalysis.messages.slice(0, 4).map((message) => (
                          <div key={message}>{message}</div>
                        ))}
                        {overlapAnalysis.messages.length > 4 ? (
                          <div>...and {overlapAnalysis.messages.length - 4} more</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {sentences.length > 0 ? (
                  <div className="mb-6 max-h-72 space-y-3 overflow-y-auto pr-2">
                    {sentences.map((sentence, index) => {
                      const isEditing = editingSentenceIndex === index
                      const hasOverlap = overlapIndexSet.has(index)

                      return (
                        <div
                          key={`${sentence.text}-${index}`}
                          className={`rounded border p-4 transition-all ${
                            hasOverlap
                              ? 'border-yellow-400/60 bg-yellow-950/10 shadow-[0_0_14px_rgba(250,204,21,0.08)]'
                              : isEditing
                                ? 'border-red-400/70 bg-red-950/20 shadow-[0_0_16px_rgba(255,0,0,0.12)]'
                                : 'border-red-500/20 bg-black/40 hover:border-red-500/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs cyber-number cyber-tabular text-red-500/70">
                                  #{index + 1}
                                </span>
                                {isEditing ? (
                                  <span className="rounded border border-red-400/50 px-2 py-0.5 text-[10px] text-red-300">
                                    EDITING
                                  </span>
                                ) : null}
                                {hasOverlap ? (
                                  <span className="rounded border border-yellow-400/50 px-2 py-0.5 text-[10px] text-yellow-200">
                                    TIME OVERLAP
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-gray-200">{sentence.text}</p>
                              {sentence.translation ? (
                                <p className="mt-2 text-xs text-gray-400">{sentence.translation}</p>
                              ) : null}
                              <p className="mt-2 text-xs text-red-500/60">
                                TIME: [
                                <span className="cyber-number cyber-tabular">
                                  {sentence.startTime.toFixed(2)}
                                </span>
                                s -
                                <span className="cyber-number cyber-tabular">
                                  {sentence.endTime.toFixed(2)}
                                </span>
                                s]
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditSentence(index)}
                                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 transition-colors hover:border-red-500/50 hover:text-red-200"
                              >
                                EDIT
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSentence(index)}
                                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400/70 transition-colors hover:border-red-500/50 hover:text-red-300"
                              >
                                DEL
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                <div className="space-y-6 rounded border border-red-500/20 bg-black/30 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-red-500" />
                      <h3 className="text-sm cyber-label text-red-400">
                        {editingSentenceIndex === null
                          ? 'ADD NEW SEGMENT'
                          : `EDIT SEGMENT #${editingSentenceIndex + 1}`}
                      </h3>
                    </div>
                    {editingSentenceIndex !== null ? (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded border border-gray-600/50 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-gray-500/70 hover:text-gray-100"
                      >
                        CANCEL EDIT
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-xs text-red-400/80 cyber-label">
                      <span className="h-1 w-1 rounded-full bg-red-400" />
                      ENGLISH TEXT *
                    </label>
                    <textarea
                      ref={englishTextRef}
                      rows={3}
                      value={currentSentence.text}
                      onChange={(event) => {
                        setCurrentSentence((prev) => ({ ...prev, text: event.target.value }))
                        setValidationErrors((prev) => ({ ...prev, text: '' }))
                      }}
                      className={`w-full resize-none border bg-black/40 px-4 py-3 text-gray-200 focus:bg-black/60 focus:outline-none ${
                        validationErrors.text
                          ? 'border-red-500/80'
                          : 'border-red-500/30 focus:border-red-500/60'
                      }`}
                      placeholder="Enter English sentence... (Press Enter to add/update)"
                    />
                    {validationErrors.text ? (
                      <div className="mt-1 text-xs text-red-400/80">
                        ! {validationErrors.text}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-xs text-red-400/80 cyber-label">
                      <span className="h-1 w-1 rounded-full bg-red-400" />
                      CHINESE TRANSLATION
                    </label>
                    <input
                      value={currentSentence.translation}
                      onChange={(event) =>
                        setCurrentSentence((prev) => ({
                          ...prev,
                          translation: event.target.value
                        }))
                      }
                      className="w-full border border-red-500/30 bg-black/40 px-4 py-3 text-gray-200 focus:bg-black/60 focus:border-red-500/60 focus:outline-none"
                      placeholder="Enter Chinese translation (optional)..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-red-400/80 cyber-label">
                        <span className="h-1 w-1 rounded-full bg-red-400" />
                        START TIME (S) *
                        <span className="ml-auto text-[10px] text-red-500/60">
                          {formatTime(currentSentence.startTime)}
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          ref={startTimeRef}
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentSentence.startTime}
                          onChange={(event) => {
                            setCurrentSentence((prev) => ({
                              ...prev,
                              startTime: parseFloat(event.target.value) || 0
                            }))
                            setValidationErrors((prev) => ({ ...prev, startTime: '' }))
                          }}
                          className={`flex-1 border bg-black/40 px-4 py-3 text-gray-200 focus:bg-black/60 focus:outline-none ${
                            validationErrors.startTime
                              ? 'border-red-500/80'
                              : 'border-red-500/30 focus:border-red-500/60'
                          }`}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => adjustTime('startTime', 1)}
                            className="border border-red-500/30 bg-red-500/20 px-2 py-1 text-[10px] text-red-400"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustTime('startTime', -1)}
                            className="border border-red-500/30 bg-red-500/20 px-2 py-1 text-[10px] text-red-400"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      {validationErrors.startTime ? (
                        <div className="mt-1 text-xs text-red-400/80">
                          ! {validationErrors.startTime}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-red-400/80 cyber-label">
                        <span className="h-1 w-1 rounded-full bg-red-400" />
                        END TIME (S) *
                        <span className="ml-auto text-[10px] text-red-500/60">
                          {formatTime(currentSentence.endTime)}
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min={currentSentence.startTime + 0.01}
                          value={currentSentence.endTime}
                          onChange={(event) => {
                            setCurrentSentence((prev) => ({
                              ...prev,
                              endTime: parseFloat(event.target.value) || 0
                            }))
                            setValidationErrors((prev) => ({ ...prev, endTime: '' }))
                          }}
                          className={`flex-1 border bg-black/40 px-4 py-3 text-gray-200 focus:bg-black/60 focus:outline-none ${
                            validationErrors.endTime
                              ? 'border-red-500/80'
                              : 'border-red-500/30 focus:border-red-500/60'
                          }`}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => adjustTime('endTime', 1)}
                            className="border border-red-500/30 bg-red-500/20 px-2 py-1 text-[10px] text-red-400"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustTime('endTime', -1)}
                            className="border border-red-500/30 bg-red-500/20 px-2 py-1 text-[10px] text-red-400"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      {validationErrors.endTime ? (
                        <div className="mt-1 text-xs text-red-400/80">
                          ! {validationErrors.endTime}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSentence}
                    className="relative w-full border-2 border-red-500/50 bg-red-500/10 px-6 py-3 text-sm text-red-400 transition-all hover:border-red-500/70 hover:bg-red-500/20 hover:text-red-300"
                  >
                    {editingSentenceIndex === null ? '+ ADD SEGMENT' : 'UPDATE SEGMENT'}
                  </button>
                </div>
              </div>

              {errors.sentences || errors.submit ? (
                <div className="rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
                  {errors.sentences ? <div>! {errors.sentences}</div> : null}
                  {errors.submit ? <div>! {errors.submit}</div> : null}
                </div>
              ) : null}

              <div className="flex gap-4 border-t-2 border-red-500/30 pt-6">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 border-2 border-red-500/60 bg-red-500/20 px-8 py-4 text-sm text-red-400 transition-all hover:border-red-500/80 hover:bg-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUploading ? '[ UPLOADING... ]' : '[ SUBMIT ]'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="border-2 border-gray-600/50 bg-black/40 px-8 py-4 text-sm text-gray-400 transition-all hover:border-gray-500/70 hover:bg-black/60 hover:text-gray-300"
                >
                  [ CANCEL ]
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
