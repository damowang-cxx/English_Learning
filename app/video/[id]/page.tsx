'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  SelectableEnglishText,
  WordLookupPopover,
  type WordLookupRequest,
} from '@/components/WordLookup'
import { isAdminRole } from '@/lib/auth-types'
import { getVideoCoverSrc, getVideoMediaSrc, withBasePath } from '@/lib/base-path'
import { formatVideoTime, type VideoCaptionMode } from '@/lib/video-training'
import {
  areVocabularyListsEqual,
  getVocabularyEntryKey,
  mergeVocabularyWords,
  parseVocabularyWords,
  serializeVocabularyWords,
  type VocabularyEntry,
} from '@/lib/vocabulary'

interface VideoCaption {
  id: string
  startTime: number
  endTime: number
  enText: string
  zhText: string | null
  speaker: string | null
  isKeySentence: boolean
  order: number
  captionNotes?: VideoCaptionNote[]
}

interface VideoCaptionNote {
  id: string
  videoCaptionId: string
  words: string
  notes: string
  createdAt: string
  updatedAt: string
}

interface VideoCharacter {
  id: string
  name: string
  avatarUrl: string | null
  order: number
}

interface VideoPhraseNote {
  id: string
  captionId: string | null
  phrase: string
  note: string
  createdAt: string
}

interface VideoTrainingItem {
  id: string
  title: string
  sourceTitle: string
  plotSummary: string
  tag: string
  mediaType: string
  mediaUrl: string
  coverUrl: string | null
  captions: VideoCaption[]
  characters: VideoCharacter[]
  phraseNotes: VideoPhraseNote[]
}

function getActiveCaption(captions: VideoCaption[], currentTime: number) {
  return captions.find((caption) => currentTime >= caption.startTime && currentTime <= caption.endTime) || null
}

function setVideoImmersiveChromeHidden(isHidden: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  const cockpitPanels = document.querySelectorAll<HTMLElement>('.cockpit-panel')

  if (isHidden) {
    document.body.dataset.videoImmersiveMode = 'true'
    cockpitPanels.forEach((panel) => {
      panel.dataset.videoImmersiveMode = 'true'
    })
    return
  }

  delete document.body.dataset.videoImmersiveMode
  cockpitPanels.forEach((panel) => {
    delete panel.dataset.videoImmersiveMode
  })
}

function blurActiveElement() {
  const activeElement = document.activeElement

  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
}

export default function VideoTrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [item, setItem] = useState<VideoTrainingItem | null>(null)
  const [captionVocabulary, setCaptionVocabulary] = useState<Record<string, VocabularyEntry[]>>({})
  const [wordLookup, setWordLookup] = useState<WordLookupRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [captionMode, setCaptionMode] = useState<VideoCaptionMode>('bilingual')
  const [repeatCaptionId, setRepeatCaptionId] = useState<string | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState('All')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false)
  const [isDisplayFullscreen, setIsDisplayFullscreen] = useState(false)
  const [phraseDraft, setPhraseDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [selectedNoteCaptionId, setSelectedNoteCaptionId] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }

    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/video/${params.id}`)}`)
      return
    }

    const fetchVideoTrainingItem = async () => {
      setLoading(true)
      try {
        const response = await fetch(withBasePath(`/api/video-training-items/${params.id}`), {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch video training item: ${response.status}`)
        }

        const data = await response.json()
        setItem(data)
        setCaptionVocabulary(
          Object.fromEntries(
            (data.captions || []).map((caption: VideoCaption) => [
              caption.id,
              parseVocabularyWords(caption.captionNotes?.[0]?.words || ''),
            ])
          )
        )
        setWordLookup(null)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load video training item.')
      } finally {
        setLoading(false)
      }
    }

    void fetchVideoTrainingItem()
  }, [authStatus, params.id, router, session?.user?.id])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsDisplayFullscreen(document.fullscreenElement === frameRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    setVideoImmersiveChromeHidden(isWindowFullscreen || isDisplayFullscreen)

    return () => {
      setVideoImmersiveChromeHidden(false)
    }
  }, [isDisplayFullscreen, isWindowFullscreen])

  const speakerOptions = useMemo(() => {
    const names = new Set(item?.characters.map((character) => character.name) || [])

    for (const caption of item?.captions || []) {
      if (caption.speaker) {
        names.add(caption.speaker)
      }
    }

    return ['All', ...names]
  }, [item])

  const filteredCaptions = useMemo(() => {
    if (!item) {
      return []
    }

    if (selectedSpeaker === 'All') {
      return item.captions
    }

    return item.captions.filter((caption) => caption.speaker === selectedSpeaker)
  }, [item, selectedSpeaker])

  const activeCaption = getActiveCaption(filteredCaptions, currentTime)
  const repeatCaption = item?.captions.find((caption) => caption.id === repeatCaptionId) || null

  useEffect(() => {
    setWordLookup(null)
  }, [activeCaption?.id])

  const jumpToCaption = useCallback((caption: VideoCaption, shouldPlay = true) => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.currentTime = caption.startTime
    setCurrentTime(caption.startTime)

    if (shouldPlay) {
      void videoRef.current.play()
      setIsPlaying(true)
    }
  }, [])

  const handleTimeUpdate = () => {
    if (!videoRef.current) {
      return
    }

    const nextTime = videoRef.current.currentTime
    setCurrentTime(nextTime)

    if (repeatCaption && nextTime >= repeatCaption.endTime) {
      videoRef.current.currentTime = repeatCaption.startTime
      setCurrentTime(repeatCaption.startTime)
      return
    }

    if (selectedSpeaker !== 'All' && filteredCaptions.length > 0) {
      const isInsideSpeakerLine = filteredCaptions.some(
        (caption) => nextTime >= caption.startTime && nextTime <= caption.endTime
      )

      if (!isInsideSpeakerLine) {
        const nextCaption = filteredCaptions.find((caption) => caption.startTime > nextTime)

        if (nextCaption) {
          videoRef.current.currentTime = nextCaption.startTime
          setCurrentTime(nextCaption.startTime)
        } else {
          videoRef.current.pause()
          setIsPlaying(false)
        }
      }
    }
  }

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) {
      return
    }

    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
      return
    }

    if (selectedSpeaker !== 'All' && filteredCaptions.length > 0 && !getActiveCaption(filteredCaptions, currentTime)) {
      jumpToCaption(filteredCaptions[0], false)
    }

    void videoRef.current.play()
    setIsPlaying(true)
  }, [currentTime, filteredCaptions, isPlaying, jumpToCaption, selectedSpeaker])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isWindowFullscreen) {
        setIsWindowFullscreen(false)
        return
      }

      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName.toLowerCase()

      if (
        target?.isContentEditable
        || tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || tagName === 'button'
      ) {
        return
      }

      event.preventDefault()
      handlePlayPause()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePlayPause, isWindowFullscreen])

  const handleSeek = (value: number) => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.currentTime = value
    setCurrentTime(value)
  }

  const handleSpeakerChange = (speaker: string) => {
    setSelectedSpeaker(speaker)
    setRepeatCaptionId(null)

    if (speaker !== 'All') {
      const nextCaption = item?.captions.find((caption) => caption.speaker === speaker)

      if (nextCaption) {
        jumpToCaption(nextCaption, false)
      }
    }
  }

  const handleWindowFullscreen = async () => {
    blurActiveElement()

    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }

    setIsWindowFullscreen((value) => {
      const nextValue = !value
      setVideoImmersiveChromeHidden(nextValue || isDisplayFullscreen)
      return nextValue
    })
  }

  const handleDisplayFullscreen = async () => {
    blurActiveElement()

    if (!frameRef.current) {
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    setIsWindowFullscreen(false)

    try {
      await frameRef.current.requestFullscreen()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Display fullscreen is unavailable.')
    }
  }

  const handleSavePhraseNote = async () => {
    if (!item || !phraseDraft.trim()) {
      return
    }

    setIsSavingNote(true)
    setStatus(null)

    try {
      const response = await fetch(withBasePath(`/api/video-training-items/${item.id}/phrase-notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: phraseDraft.trim(),
          note: noteDraft.trim(),
          captionId: selectedNoteCaptionId || null,
        }),
      })

      if (!response.ok) {
        throw new Error(`Save phrase note failed: ${response.status}`)
      }

      const note = await response.json()
      setItem((prev) => prev ? { ...prev, phraseNotes: [note, ...prev.phraseNotes] } : prev)
      setPhraseDraft('')
      setNoteDraft('')
      setSelectedNoteCaptionId('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save phrase note failed.')
    } finally {
      setIsSavingNote(false)
    }
  }

  const handleSaveVideoLookupVocabulary = async (entry: VocabularyEntry) => {
    if (!item || !wordLookup) {
      return
    }

    const captionId = wordLookup.contextId
    const currentEntries = captionVocabulary[captionId] || []
    const mergedEntries = mergeVocabularyWords(currentEntries, [entry])

    if (areVocabularyListsEqual(currentEntries, mergedEntries)) {
      return
    }

    setCaptionVocabulary((prev) => ({
      ...prev,
      [captionId]: mergedEntries,
    }))

    try {
      const existingNote = item.captions.find((caption) => caption.id === captionId)?.captionNotes?.[0]
      const response = await fetch(withBasePath('/api/video-caption-notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captionId,
          words: serializeVocabularyWords(mergedEntries),
          notes: existingNote?.notes || '',
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || `Save video vocabulary failed: ${response.status}`)
      }

      setItem((prev) => {
        if (!prev) {
          return prev
        }

        return {
          ...prev,
          captions: prev.captions.map((caption) => {
            if (caption.id !== captionId) {
              return caption
            }

            return {
              ...caption,
              captionNotes: [payload],
            }
          }),
        }
      })
    } catch (error) {
      setCaptionVocabulary((prev) => ({
        ...prev,
        [captionId]: currentEntries,
      }))
      setStatus(error instanceof Error ? error.message : 'Save video vocabulary failed.')
      throw error
    }
  }

  const handleDeletePhraseNote = async (noteId: string) => {
    if (!item) {
      return
    }

    const response = await fetch(withBasePath(`/api/video-training-items/${item.id}/phrase-notes?noteId=${noteId}`), {
      method: 'DELETE',
    })

    if (response.ok) {
      setItem((prev) => prev ? { ...prev, phraseNotes: prev.phraseNotes.filter((note) => note.id !== noteId) } : prev)
    }
  }

  const handleDubbingAssessment = async () => {
    if (!item) {
      return
    }

    const response = await fetch(withBasePath(`/api/video-training-items/${item.id}/dubbing-assessment`), {
      method: 'POST',
    })
    const data = await response.json()
    setStatus(data?.error || (response.ok ? 'Dubbing assessment reserved.' : 'Dubbing assessment unavailable.'))
  }

  const handleDeleteVideoTraining = async () => {
    if (!isAdmin || !item || isDeleting || !window.confirm(`Delete video training "${item.title}"?`)) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(withBasePath(`/api/video-training-items/${item.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }

      router.push('/video')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Delete failed.')
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center text-cyan-300" style={{ zIndex: 40 }}>
        LOADING VIDEO TRAINING...
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen relative flex items-center justify-center text-red-300" style={{ zIndex: 40 }}>
        {status || 'Video training item not found.'}
      </div>
    )
  }

  const isImmersive = isWindowFullscreen || isDisplayFullscreen
  const wordLookupSavedKeys = new Set(
    wordLookup ? (captionVocabulary[wordLookup.contextId] || []).map(getVocabularyEntryKey) : []
  )

  return (
    <div
      className={isImmersive ? 'fixed inset-0 z-[120] bg-black' : 'min-h-screen relative flex items-center justify-center'}
      style={isImmersive ? undefined : { paddingBottom: '6vh', paddingTop: '6vh', zIndex: 45 }}
    >
      <div
        className={`relative mx-auto grid gap-4 ${
          isImmersive
            ? 'h-full w-full max-w-none grid-cols-1 p-0'
            : isSidebarCollapsed
              ? 'h-[calc(100vh-12vh)] w-[96%] max-w-7xl grid-cols-1'
              : 'h-[calc(100vh-12vh)] w-[96%] max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]'
        }`}
      >
        <main
          ref={frameRef}
          className={`relative flex min-h-0 flex-col overflow-hidden bg-black/78 ${
            isImmersive
              ? 'h-full rounded-none border-0 shadow-none'
              : 'h-full rounded-lg border border-cyan-500/35 shadow-[0_0_35px_rgba(34,211,238,0.16)]'
          }`}
        >
          {!isImmersive ? (
          <div className="border-b border-cyan-500/25 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs cyber-label text-cyan-400/70">VIDEO TRAINING</div>
                <h1 className="mt-1 max-w-[52rem] overflow-hidden text-ellipsis whitespace-nowrap text-2xl cyber-title text-cyan-200" title={item.title}>
                  {item.title}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/video')}
                  className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs text-cyan-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
                >
                  BACK
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={handleDeleteVideoTraining}
                    disabled={isDeleting}
                    className="rounded-md border border-red-500/35 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200 disabled:opacity-40"
                  >
                    {isDeleting ? 'DELETING...' : 'DELETE'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          ) : null}

          <div className="relative min-h-0 flex-1 bg-black">
            <video
              ref={videoRef}
              src={getVideoMediaSrc(item.mediaUrl)}
              poster={getVideoCoverSrc(item.coverUrl)}
              className="h-full w-full bg-black object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {isSidebarCollapsed && !isImmersive ? (
              <button
                type="button"
                aria-label="Open side panel"
                onClick={() => setIsSidebarCollapsed(false)}
                className="absolute right-0 top-1/2 z-30 flex h-24 w-6 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-cyan-500/25 bg-cyan-950/35 text-sm text-cyan-300/35 opacity-35 shadow-[inset_8px_0_16px_rgba(34,211,238,0.06)] transition-all hover:border-cyan-300/70 hover:bg-cyan-900/80 hover:text-cyan-100 hover:opacity-100 hover:shadow-[inset_8px_0_16px_rgba(34,211,238,0.12),0_0_14px_rgba(34,211,238,0.12)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/70"
              >
                &lt;
              </button>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 pt-12">
              <div className="pointer-events-auto rounded-lg border border-cyan-500/25 bg-black/70 p-3 shadow-[0_0_22px_rgba(34,211,238,0.14)] backdrop-blur-sm">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.01"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => handleSeek(Number(event.target.value))}
                  className="w-full accent-cyan-300"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlayPause}
                      className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.12] px-4 py-2 text-xs text-cyan-100 transition-colors hover:border-cyan-300/70"
                    >
                      {isPlaying ? 'PAUSE' : 'PLAY'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepeatCaptionId(activeCaption ? (repeatCaptionId === activeCaption.id ? null : activeCaption.id) : null)}
                      disabled={!activeCaption}
                      className={`rounded-md border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        repeatCaptionId
                          ? 'border-yellow-400/65 bg-yellow-500/[0.14] text-yellow-100'
                          : 'border-yellow-500/35 bg-yellow-500/[0.08] text-yellow-200'
                      }`}
                    >
                      LOOP
                    </button>
                    {[0.75, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`rounded-md border px-2.5 py-2 text-xs ${
                          playbackRate === rate
                            ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100'
                            : 'border-cyan-500/25 text-cyan-300/70'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                    {(['english', 'bilingual', 'hidden'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCaptionMode(mode)}
                        className={`rounded-md border px-2.5 py-2 text-xs uppercase ${
                          captionMode === mode
                            ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100'
                            : 'border-cyan-500/25 text-cyan-300/70'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-cyan-200/75">
                      {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleWindowFullscreen()}
                      onKeyDown={(event) => {
                        if (event.code === 'Space' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handlePlayPause()
                        }
                      }}
                      className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
                    >
                      {isWindowFullscreen ? 'EXIT WINDOW' : 'WINDOW'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDisplayFullscreen()}
                      onKeyDown={(event) => {
                        if (event.code === 'Space' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handlePlayPause()
                        }
                      }}
                      className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
                    >
                      {isDisplayFullscreen ? 'EXIT DISPLAY' : 'DISPLAY'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${isImmersive ? 'border-t border-cyan-500/20 p-4' : 'space-y-4 p-4'}`}>
            <div className={`rounded-lg border border-cyan-500/20 bg-black/45 p-4 text-center ${isImmersive ? 'min-h-[92px]' : ''}`}>
              {captionMode === 'hidden' ? (
                <div className="text-sm text-cyan-300/45">SUBTITLES HIDDEN</div>
              ) : activeCaption ? (
                <div className="space-y-2">
                  <SelectableEnglishText
                    contextId={activeCaption.id}
                    onLookup={setWordLookup}
                    className="text-lg font-semibold leading-8 text-cyan-50"
                  >
                    {activeCaption.enText}
                  </SelectableEnglishText>
                  {captionMode === 'bilingual' && activeCaption.zhText ? (
                    <div className="text-base leading-7 text-cyan-200/75">{activeCaption.zhText}</div>
                  ) : null}
                  {activeCaption.speaker ? (
                    <div className="text-xs font-mono tracking-[0.18em] text-cyan-400/60">{activeCaption.speaker}</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-cyan-300/45">NO ACTIVE CAPTION</div>
              )}
            </div>

            {status && !isImmersive ? (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/[0.08] px-4 py-3 text-sm text-yellow-200">
                {status}
              </div>
            ) : null}
          </div>
        </main>

        {!isSidebarCollapsed && !isImmersive ? (
          <aside className="relative grid h-full min-h-0 grid-rows-[1fr_2fr_1fr] overflow-hidden rounded-lg border border-cyan-500/35 bg-black/82 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
              <button
                type="button"
                aria-label="Close side panel"
                onClick={() => setIsSidebarCollapsed(true)}
              className="absolute -left-px top-1/2 z-20 flex h-24 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-cyan-500/25 bg-cyan-950/35 text-sm text-cyan-300/35 opacity-35 shadow-[inset_-8px_0_16px_rgba(34,211,238,0.06)] transition-all hover:border-cyan-300/70 hover:bg-cyan-900/80 hover:text-cyan-100 hover:opacity-100 hover:shadow-[inset_-8px_0_16px_rgba(34,211,238,0.12),0_0_14px_rgba(34,211,238,0.12)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/70"
            >
              &gt;
            </button>
            <section className="overflow-y-auto border-b border-cyan-500/25 p-4">
              <div className="mb-3 h-28 rounded-md border border-cyan-500/20 bg-cover bg-center opacity-85" style={{ backgroundImage: `url("${getVideoCoverSrc(item.coverUrl)}")` }} />
              <div className="text-xs cyber-label text-cyan-400/70">{item.tag}</div>
              <h2 className="mt-1 text-lg font-semibold text-cyan-100">{item.sourceTitle || item.title}</h2>
              {item.plotSummary ? <p className="mt-2 text-sm leading-6 text-cyan-100/70">{item.plotSummary}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {speakerOptions.map((speaker) => (
                  <button
                    key={speaker}
                    type="button"
                    onClick={() => handleSpeakerChange(speaker)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      selectedSpeaker === speaker
                        ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100'
                        : 'border-cyan-500/25 text-cyan-300/70'
                    }`}
                  >
                    {speaker}
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-y-auto border-b border-cyan-500/25 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm cyber-title text-cyan-300">CAPTIONS</h3>
                <span className="font-mono text-xs text-cyan-300/60">{filteredCaptions.length}</span>
              </div>
              <div className="space-y-2">
                {filteredCaptions.map((caption) => {
                  const isActive = activeCaption?.id === caption.id

                  return (
                    <button
                      key={caption.id}
                      type="button"
                      onClick={() => jumpToCaption(caption)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        isActive
                          ? 'border-cyan-300/65 bg-cyan-400/[0.12]'
                          : 'border-cyan-500/18 bg-black/35 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-cyan-300/60">
                        <span>{formatVideoTime(caption.startTime)}</span>
                        <span>{caption.speaker || 'Line'}</span>
                      </div>
                      <div className="text-sm leading-6 text-cyan-50">{caption.enText}</div>
                      {caption.zhText ? <div className="mt-1 text-xs leading-5 text-cyan-200/65">{caption.zhText}</div> : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm cyber-title text-cyan-300">PHRASE NOTES</h3>
                <button
                  type="button"
                  onClick={handleDubbingAssessment}
                  className="rounded border border-yellow-500/35 px-2 py-1 text-[10px] text-yellow-200"
                >
                  DUBBING API
                </button>
              </div>
              <div className="space-y-2">
                <input
                  value={phraseDraft}
                  onChange={(event) => setPhraseDraft(event.target.value)}
                  className="w-full rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                  placeholder="Phrase"
                />
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                  placeholder="Note"
                />
                <select
                  value={selectedNoteCaptionId}
                  onChange={(event) => setSelectedNoteCaptionId(event.target.value)}
                  className="w-full rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                >
                  <option value="">No caption link</option>
                  {item.captions.map((caption) => (
                    <option key={caption.id} value={caption.id}>
                      #{caption.order + 1} {caption.enText.slice(0, 48)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSavePhraseNote}
                  disabled={isSavingNote || !phraseDraft.trim()}
                  className="w-full rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSavingNote ? 'SAVING...' : 'SAVE NOTE'}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {item.phraseNotes.map((note) => (
                  <div key={note.id} className="rounded-md border border-cyan-500/18 bg-black/35 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-cyan-100">{note.phrase}</div>
                      <button
                        type="button"
                        onClick={() => void handleDeletePhraseNote(note.id)}
                        className="text-[10px] text-red-300/80 hover:text-red-200"
                      >
                        DEL
                      </button>
                    </div>
                    {note.note ? <div className="mt-1 text-sm leading-6 text-cyan-100/70">{note.note}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      <WordLookupPopover
        request={wordLookup}
        savedEntryKeys={wordLookupSavedKeys}
        theme="cyan"
        onSave={handleSaveVideoLookupVocabulary}
        onClose={() => setWordLookup(null)}
      />
    </div>
  )
}
