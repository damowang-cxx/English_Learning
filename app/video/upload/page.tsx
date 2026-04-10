'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createPortal } from 'react-dom'
import ImageCropModal, { type ImageCropPreset } from '@/components/video/ImageCropModal'
import VideoCaptionEditorModal from '@/components/video/VideoCaptionEditorModal'
import { isAdminRole } from '@/lib/auth-types'
import { withBasePath } from '@/lib/base-path'
import {
  VIDEO_TRAINING_TAGS,
  formatVideoTime,
  isVideoTrainingDramaTag,
  type VideoTrainingTag,
} from '@/lib/video-training'
import {
  createEmptyVideoCaptionDraft,
  createLocalId,
  getVideoCharacterNames,
  mergeCaptionTracks,
  parseJsonCaptions,
  parseSubtitleText,
  type TranslationDraftResult,
  type VideoCaptionDraft,
  type VideoCharacterDraft,
} from '@/lib/video-training-form'

type UploadStatus = {
  type: 'info' | 'success' | 'error'
  message: string
}

type TranslationDraftQuality = 'normal' | 'high'
type TranslationDraftFillMode = 'fill-empty' | 'overwrite-all'
type PendingImageCrop = {
  target: 'cover' | 'character'
  localId?: string
  file: File
  preset: ImageCropPreset
  title: string
  description: string
}

export default function VideoUploadPage() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [title, setTitle] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [plotSummary, setPlotSummary] = useState('')
  const [tag, setTag] = useState<VideoTrainingTag>(VIDEO_TRAINING_TAGS[0])
  const [mediaFileName, setMediaFileName] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [enSubtitleFile, setEnSubtitleFile] = useState<File | null>(null)
  const [zhSubtitleFile, setZhSubtitleFile] = useState<File | null>(null)
  const [jsonImportText, setJsonImportText] = useState('')
  const [captions, setCaptions] = useState<VideoCaptionDraft[]>([])
  const [characters, setCharacters] = useState<VideoCharacterDraft[]>([])
  const [status, setStatus] = useState<UploadStatus | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [translationDraftQuality, setTranslationDraftQuality] = useState<TranslationDraftQuality | null>(null)
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false)
  const [pendingImageCrop, setPendingImageCrop] = useState<PendingImageCrop | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const jsonFileInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = isAdminRole((session?.user as { role?: unknown } | undefined)?.role)

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }

    if (!session?.user?.id) {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/video/upload')}`)
      return
    }

    if (!isAdmin) {
      router.replace('/403')
      return
    }

    titleInputRef.current?.focus()
  }, [authStatus, isAdmin, router, session?.user?.id])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(coverFile)
    setCoverPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [coverFile])

  const characterNames = useMemo(() => getVideoCharacterNames(characters), [characters])
  const reviewCaptionCount = captions.filter((caption) => caption.needsReview || caption.translationNeedsReview).length
  const translatedCaptionCount = captions.filter((caption) => caption.zhText.trim()).length
  const manualCaptionCount = captions.filter((caption) => caption.translationStatus === 'manual').length
  const canSubmit = Boolean(title.trim() && mediaFileName.trim() && captions.length > 0 && !isUploading)
  const isRequestingDraft = Boolean(translationDraftQuality)
  const publishButtonLabel = isUploading ? '[ PUBLISHING... ]' : '[ PUBLISH TRAINING DATA ]'
  const submitReadinessText = !title.trim()
    ? 'Need title'
    : !mediaFileName.trim()
      ? 'Need public video file name'
      : captions.length === 0
        ? 'Need parsed captions'
        : 'Ready to publish'

  const updateCaption = (localId: string, patch: Partial<VideoCaptionDraft>) => {
    setCaptions((prev) =>
      prev.map((caption) =>
        caption.localId === localId ? { ...caption, ...patch, needsReview: false } : caption
      )
    )
  }

  const updateCaptionZhText = (localId: string, zhText: string) => {
    updateCaption(localId, {
      zhText,
      translationStatus: zhText.trim() ? 'manual' : 'empty',
      translationNeedsReview: false,
      translationNote: '',
    })
  }

  const handleAddCaptionRow = () => {
    const previousEndTime = captions.length > 0 ? captions[captions.length - 1].endTime : 0
    const nextCaption = createEmptyVideoCaptionDraft(previousEndTime)

    setCaptions((prev) => (
      isVideoTrainingDramaTag(tag)
        ? [...prev, nextCaption]
        : [...prev, { ...nextCaption, speaker: '' }]
    ))
  }

  const handleParseSubtitles = async () => {
    if (!enSubtitleFile) {
      setStatus({ type: 'error', message: 'Choose an English SRT/VTT subtitle file first.' })
      return
    }

    setIsParsing(true)
    setStatus(null)

    try {
      const enCues = parseSubtitleText(await enSubtitleFile.text())
      const zhCues = zhSubtitleFile ? parseSubtitleText(await zhSubtitleFile.text()) : []

      if (enCues.length === 0) {
        throw new Error('No valid English caption cues were found.')
      }

      const nextCaptions = mergeCaptionTracks(enCues, zhCues)
      setCaptions(nextCaptions)
      setStatus({
        type: nextCaptions.some((caption) => caption.needsReview) ? 'info' : 'success',
        message: `Imported ${nextCaptions.length} caption blocks.${zhSubtitleFile && enCues.length !== zhCues.length ? ' Some Chinese matches should be reviewed.' : ''}`,
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Subtitle import failed.',
      })
    } finally {
      setIsParsing(false)
    }
  }

  const importJsonCaptions = (rawText: string, sourceLabel: string) => {
    try {
      const nextCaptions = parseJsonCaptions(rawText)
      setCaptions(nextCaptions)
      setStatus({
        type: 'success',
        message: `Imported ${nextCaptions.length} caption blocks from ${sourceLabel}.`,
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'JSON caption import failed.',
      })
    }
  }

  const handleJsonFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      importJsonCaptions(await file.text(), file.name)
    } finally {
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = ''
      }
    }
  }

  const handleJsonTextImport = () => {
    if (!jsonImportText.trim()) {
      setStatus({ type: 'error', message: 'Paste JSON caption text before importing.' })
      return
    }

    importJsonCaptions(jsonImportText, 'pasted JSON')
    setJsonImportText('')
  }

  const handleAddCharacter = () => {
    setCharacters((prev) => [...prev, {
      localId: createLocalId(),
      name: '',
      avatarFile: null,
      avatarAction: 'replace',
      currentAvatarUrl: null,
    }])
  }

  const beginImageCrop = (crop: PendingImageCrop) => {
    setPendingImageCrop(crop)
  }

  const handleApplyImageCrop = async (croppedFile: File) => {
    if (!pendingImageCrop) {
      return
    }

    if (pendingImageCrop.target === 'cover') {
      setCoverFile(croppedFile)
      setStatus({ type: 'success', message: 'Cover image cropped and ready.' })
      setPendingImageCrop(null)
      return
    }

    const localId = pendingImageCrop.localId
    if (!localId) {
      setPendingImageCrop(null)
      return
    }

    setCharacters((prev) =>
      prev.map((entry) => entry.localId === localId
        ? {
            ...entry,
            avatarFile: croppedFile,
            avatarAction: 'replace',
          }
        : entry)
    )
    setStatus({ type: 'success', message: 'Character avatar cropped and ready.' })
    setPendingImageCrop(null)
  }

  const handleRequestTranslationDraft = async (quality: TranslationDraftQuality) => {
    const englishCaptions = captions.filter((caption) => caption.enText.trim())

    if (englishCaptions.length === 0) {
      window.alert('Please import SRT / VTT / JSON captions first, then request a translation draft.')
      setStatus({ type: 'info', message: 'Import SRT / VTT / JSON captions before requesting a translation draft.' })
      return
    }

    const hasChineseDraft = englishCaptions.some((caption) => caption.zhText.trim())
    let fillMode: TranslationDraftFillMode = 'overwrite-all'

    if (hasChineseDraft) {
      const shouldOverwriteAll = window.confirm(
        'Chinese draft text already exists. Choose OK to overwrite all translated rows, or Cancel to fill empty rows only.'
      )
      fillMode = shouldOverwriteAll ? 'overwrite-all' : 'fill-empty'
    }

    const captionsForRequest = englishCaptions
      .filter((caption) => fillMode === 'overwrite-all' || !caption.zhText.trim())
      .map((caption) => {
        const sourceIndex = captions.findIndex((entry) => entry.localId === caption.localId)
        const prevCaption = sourceIndex > 0 ? captions[sourceIndex - 1] : null
        const nextCaption = sourceIndex >= 0 && sourceIndex < captions.length - 1 ? captions[sourceIndex + 1] : null

        return {
          id: caption.localId,
          index: sourceIndex >= 0 ? sourceIndex : 0,
          speaker: caption.speaker.trim() || null,
          enText: caption.enText.trim(),
          prevEnText: prevCaption?.enText.trim() || null,
          nextEnText: nextCaption?.enText.trim() || null,
        }
      })

    if (captionsForRequest.length === 0) {
      setStatus({ type: 'info', message: 'All caption rows already have Chinese text. Use Overwrite all to regenerate them.' })
      return
    }

    setTranslationDraftQuality(quality)
    setStatus(null)

    try {
      const response = await fetch(withBasePath('/api/video/translation-draft'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelQuality: quality,
          captions: captionsForRequest,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setStatus({
          type: 'error',
          message: data?.error || 'Translation draft request failed.',
        })
        return
      }

      if (Array.isArray(data.translations) && data.translations.length > 0) {
        const translations = (data.translations as Array<Partial<TranslationDraftResult>>)
          .filter((translation): translation is TranslationDraftResult => typeof translation.id === 'string')
        const translationsById = new Map<string, TranslationDraftResult>(
          translations.map((translation) => [translation.id, translation])
        )

        setCaptions((prev) =>
          prev.map((caption) => {
            const translation = translationsById.get(caption.localId)

            if (!translation) {
              return caption
            }

            const zhText = typeof translation.zhText === 'string' ? translation.zhText : ''

            return {
              ...caption,
              zhText,
              translationStatus: 'draft',
              translationNeedsReview: Boolean(translation.needsReview),
              translationNote: typeof translation.note === 'string' ? translation.note : '',
            }
          })
        )
        setStatus({
          type: 'success',
          message: `Applied ${data.translations.length} ${quality === 'high' ? 'high' : 'normal'} translation draft rows.`,
        })
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Translation draft request failed.',
      })
    } finally {
      setTranslationDraftQuality(null)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setStatus({ type: 'error', message: 'Title is required.' })
      titleInputRef.current?.focus()
      return
    }

    if (!mediaFileName.trim()) {
      setStatus({ type: 'error', message: 'Enter the video file name already placed in public/video.' })
      return
    }

    if (captions.length === 0) {
      setStatus({ type: 'error', message: 'Import at least one caption block.' })
      return
    }

    const invalidCaptionIndex = captions.findIndex(
      (caption) =>
        !caption.enText.trim()
        || !Number.isFinite(caption.startTime)
        || !Number.isFinite(caption.endTime)
        || caption.endTime <= caption.startTime
    )

    if (invalidCaptionIndex >= 0) {
      setStatus({ type: 'error', message: `Caption #${invalidCaptionIndex + 1} needs a valid time range and English text.` })
      return
    }

    setIsUploading(true)
    setStatus(null)

    try {
      const formData = new FormData()
      const characterPayload = isVideoTrainingDramaTag(tag)
        ? characters
            .map((character, index) => ({
              id: character.id,
              name: character.name.trim(),
              avatarAction: character.avatarAction,
              avatarField: character.avatarFile ? `characterAvatar_${index}` : null,
              avatarFile: character.avatarFile,
            }))
            .filter((character) => character.name)
        : []

      formData.append('title', title.trim())
      formData.append('sourceTitle', sourceTitle.trim())
      formData.append('plotSummary', plotSummary.trim())
      formData.append('tag', tag)
      formData.append('mediaFileName', mediaFileName.trim())

      if (coverFile) {
        formData.append('cover', coverFile)
      }

      formData.append('captions', JSON.stringify(captions.map((caption) => ({
        startTime: caption.startTime,
        endTime: caption.endTime,
        enText: caption.enText.trim(),
        zhText: caption.zhText.trim() || null,
        speaker: isVideoTrainingDramaTag(tag) ? caption.speaker.trim() || null : null,
        isKeySentence: false,
      }))))
      formData.append('characters', JSON.stringify(characterPayload.map((character) => ({
        ...(character.id ? { id: character.id } : {}),
        name: character.name,
        avatarAction: character.avatarAction,
        avatarField: character.avatarField,
      }))))

      characterPayload.forEach((character) => {
        if (character.avatarFile && character.avatarField) {
          formData.append(character.avatarField, character.avatarFile)
        }
      })

      const response = await fetch(withBasePath('/api/video-training-items'), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || `Upload failed: ${response.status}`)
      }

      const data = await response.json()
      router.push(`/video/${data.id}`)
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Video upload failed.',
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (authStatus === 'loading' || !session?.user?.id || !isAdmin) {
    return (
      <div className="min-h-screen relative flex items-center justify-center text-cyan-300" style={{ zIndex: 50 }}>
        {authStatus === 'loading' ? 'CHECKING ACCESS...' : 'ADMIN ACCESS REQUIRED'}
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{ paddingBottom: '16vh', paddingTop: '10vh' }}>
      <div className="w-[95%] max-w-6xl mx-auto relative" style={{ zIndex: 50 }}>
        <div className="relative overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/75 shadow-[0_0_40px_rgba(34,211,238,0.22),inset_0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-md">
          <div className="relative z-10 border-b-2 border-cyan-500/40 bg-cyan-950/30 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  <h1 className="text-2xl cyber-title text-cyan-300">[ VIDEO UPLOAD ]</h1>
                </div>
                <div className="mt-2 text-xs cyber-label text-cyan-400/70">
                  CAPTION IMPORT · PREVIEW · MANUAL FIX · PUBLISH
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/video')}
                className="rounded border border-cyan-500/30 px-3 py-1 text-sm text-cyan-300/80 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
              >
                BACK
              </button>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit()
            }}
            className="relative z-10 space-y-8 p-6 md:p-8"
          >
            <div className="sticky top-3 z-30 flex flex-col gap-3 rounded-lg border border-cyan-500/35 bg-black/90 p-3 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-md md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs cyber-label text-cyan-300/70">UPLOAD STATUS</div>
                <div className={`mt-1 text-sm ${canSubmit ? 'text-cyan-100' : 'text-yellow-200'}`}>
                  {submitReadinessText}
                </div>
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md border-2 border-cyan-500/60 bg-cyan-500/[0.14] px-6 py-3 text-sm text-cyan-100 transition-colors hover:border-cyan-300/80 hover:bg-cyan-500/[0.2] disabled:cursor-not-allowed disabled:border-gray-600/50 disabled:bg-gray-900/50 disabled:text-gray-500"
              >
                {publishButtonLabel}
              </button>
            </div>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">TITLE *</span>
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                    placeholder="Clip title"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">WORK</span>
                  <input
                    value={sourceTitle}
                    onChange={(event) => setSourceTitle(event.target.value)}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                    placeholder="Movie, show, speech, or source"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">SUMMARY</span>
                  <textarea
                    value={plotSummary}
                    onChange={(event) => setPlotSummary(event.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                    placeholder="Scene context"
                  />
                </label>
              </div>

              <div className="space-y-5">
                <div>
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">TAG *</span>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_TRAINING_TAGS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTag(option)}
                        className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                          tag === option
                            ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100'
                            : 'border-cyan-500/30 bg-black/30 text-cyan-300/65 hover:border-cyan-400/50 hover:text-cyan-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">VIDEO FILE NAME *</span>
                  <input
                    value={mediaFileName}
                    onChange={(event) => setMediaFileName(event.target.value)}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                    placeholder="clip.mp4"
                  />
                  <span className="mt-2 block text-xs leading-5 text-cyan-300/65">
                    Put the media file in public/video first, then enter only the file name. Example: public/video/clip.mp4 -&gt; clip.mp4
                  </span>
                  {mediaFileName.trim() ? (
                    <span className="mt-2 block text-xs text-cyan-300/70">Database media path: /video/{mediaFileName.trim()}</span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">COVER</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      event.currentTarget.value = ''

                      if (!file) {
                        setCoverFile(null)
                        return
                      }

                      beginImageCrop({
                        target: 'cover',
                        file,
                        preset: 'cover',
                        title: 'CROP COVER',
                        description: 'Adjust the 16:9 cover before the upload form stores it.',
                      })
                    }}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-200"
                  />
                  {coverFile ? (
                    <div className="mt-3 flex flex-col gap-3 rounded-md border border-cyan-500/20 bg-black/25 p-3 md:flex-row md:items-center">
                      {coverPreviewUrl ? (
                        <div className="h-24 w-full overflow-hidden rounded-md border border-cyan-500/20 bg-black/40 md:w-44">
                          <Image
                            src={coverPreviewUrl}
                            alt="Cover preview"
                            width={176}
                            height={96}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex-1 text-xs text-cyan-300/70">
                        <div>{coverFile.name}</div>
                        <div className="mt-1 text-cyan-300/55">The cropped cover file will be uploaded to `public/video-covers` on publish.</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => beginImageCrop({
                              target: 'cover',
                              file: coverFile,
                              preset: 'cover',
                              title: 'RE-CROP COVER',
                              description: 'Adjust the 16:9 cover before the upload form stores it.',
                            })}
                            className="rounded-md border border-cyan-500/35 px-3 py-1.5 text-[11px] text-cyan-200 transition-colors hover:border-cyan-300/70"
                          >
                            RE-CROP
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverFile(null)}
                            className="rounded-md border border-red-500/35 px-3 py-1.5 text-[11px] text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                          >
                            CLEAR
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg cyber-title text-cyan-300">SUBTITLES</h2>
                  <p className="mt-1 text-xs text-cyan-300/65">SRT/VTT files are parsed locally into caption blocks.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleParseSubtitles}
                    disabled={isParsing}
                    className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isParsing ? 'PARSING...' : 'PARSE SUBTITLES'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRequestTranslationDraft('normal')}
                    disabled={isRequestingDraft}
                    className="rounded-md border border-yellow-500/35 bg-yellow-500/[0.08] px-4 py-2 text-xs text-yellow-200 transition-colors hover:border-yellow-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {translationDraftQuality === 'normal' ? 'REQUESTING...' : 'NORMAL DRAFT'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRequestTranslationDraft('high')}
                    disabled={isRequestingDraft}
                    className="rounded-md border border-amber-400/45 bg-amber-500/[0.1] px-4 py-2 text-xs text-amber-100 transition-colors hover:border-amber-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {translationDraftQuality === 'high' ? 'REQUESTING...' : 'HIGH DRAFT'}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">ENGLISH SRT/VTT *</span>
                  <input
                    type="file"
                    accept=".srt,.vtt,text/vtt"
                    onChange={(event) => setEnSubtitleFile(event.target.files?.[0] || null)}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs text-cyan-300 cyber-label">CHINESE SRT/VTT</span>
                  <input
                    type="file"
                    accept=".srt,.vtt,text/vtt"
                    onChange={(event) => setZhSubtitleFile(event.target.files?.[0] || null)}
                    className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-200"
                  />
                </label>
              </div>
              <div className="mt-5 rounded-md border border-cyan-500/20 bg-black/25 p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm cyber-title text-cyan-300">JSON CAPTIONS</h3>
                    <p className="mt-1 text-xs text-cyan-300/60">
                      Supports id, index, en/enText, zh/zhText, start/startTime, end/endTime, speaker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleJsonTextImport}
                    className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
                  >
                    IMPORT JSON TEXT
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs text-cyan-300 cyber-label">JSON FILE</span>
                    <input
                      ref={jsonFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleJsonFileImport}
                      className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs text-cyan-300 cyber-label">PASTE JSON</span>
                    <textarea
                      value={jsonImportText}
                      onChange={(event) => setJsonImportText(event.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      placeholder='[{"id":"1","enText":"...","startTime":0,"endTime":3.2}]'
                    />
                  </label>
                </div>
              </div>
            </section>

            {isVideoTrainingDramaTag(tag) ? (
              <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg cyber-title text-cyan-300">CHARACTERS</h2>
                    <p className="mt-1 text-xs text-cyan-300/65">Names become speaker filters on the training page.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCharacter}
                    className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
                  >
                    ADD CHARACTER
                  </button>
                </div>
                <div className="space-y-3">
                  {characters.length === 0 ? (
                    <div className="rounded-md border border-cyan-500/20 bg-black/25 px-4 py-3 text-sm text-cyan-200/65">
                      Add roles such as Monica, Chandler, or Rachel.
                    </div>
                  ) : null}
                  {characters.map((character) => (
                    <div key={character.localId} className="rounded-md border border-cyan-500/20 bg-black/35 p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <input
                          value={character.name}
                          onChange={(event) => {
                            const value = event.target.value
                            setCharacters((prev) =>
                              prev.map((entry) => entry.localId === character.localId ? { ...entry, name: value } : entry)
                            )
                          }}
                          className="rounded-md border border-cyan-500/30 bg-black/45 px-3 py-2 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                          placeholder="Character name"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null
                            event.currentTarget.value = ''

                            if (!file) {
                              setCharacters((prev) =>
                                prev.map((entry) => entry.localId === character.localId ? {
                                  ...entry,
                                  avatarFile: null,
                                } : entry)
                              )
                              return
                            }

                            beginImageCrop({
                              target: 'character',
                              localId: character.localId,
                              file,
                              preset: 'avatar',
                              title: `CROP ${character.name.trim() || 'CHARACTER'} AVATAR`,
                              description: 'Adjust the square avatar before it is attached to this character.',
                            })
                          }}
                          className="rounded-md border border-cyan-500/30 bg-black/45 px-3 py-2 text-gray-300 file:mr-3 file:border-0 file:bg-cyan-500/20 file:px-2 file:py-1 file:text-cyan-200"
                        />
                        <button
                          type="button"
                          onClick={() => setCharacters((prev) => prev.filter((entry) => entry.localId !== character.localId))}
                          className="rounded-md border border-red-500/35 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                        >
                          REMOVE
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-cyan-300/65">
                        <span>
                          {character.avatarFile ? `Avatar ready: ${character.avatarFile.name}` : 'No avatar selected'}
                        </span>
                        {character.avatarFile ? (
                          <>
                            <button
                              type="button"
                              onClick={() => beginImageCrop({
                                target: 'character',
                                localId: character.localId,
                                file: character.avatarFile as File,
                                preset: 'avatar',
                                title: `RE-CROP ${character.name.trim() || 'CHARACTER'} AVATAR`,
                                description: 'Adjust the square avatar before it is attached to this character.',
                              })}
                              className="rounded border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-200 transition-colors hover:border-cyan-300/70"
                            >
                              RE-CROP AVATAR
                            </button>
                            <button
                              type="button"
                              onClick={() => setCharacters((prev) =>
                                prev.map((entry) => entry.localId === character.localId
                                  ? {
                                      ...entry,
                                      avatarFile: null,
                                    }
                                  : entry)
                              )}
                              className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                            >
                              CLEAR AVATAR
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg cyber-title text-cyan-300">CAPTION PREVIEW</h2>
                  <p className="mt-1 text-xs text-cyan-300/65">
                    Caption blocks are edited in a dedicated modal so the upload form stays compact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCaptionEditorOpen(true)}
                  disabled={captions.length === 0}
                  className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  EDIT CAPTIONS
                </button>
              </div>

              {captions.length === 0 ? (
                <div className="rounded-md border border-cyan-500/20 bg-black/25 px-4 py-6 text-center text-sm text-cyan-200/65">
                  Import SRT / VTT / JSON captions before opening the caption editor.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border border-cyan-500/20 bg-black/35 p-4">
                    <div className="text-xs cyber-label text-cyan-300/60">TOTAL</div>
                    <div className="mt-2 text-2xl text-cyan-100">{captions.length}</div>
                  </div>
                  <div className="rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] p-4">
                    <div className="text-xs cyber-label text-yellow-200/70">REVIEW</div>
                    <div className="mt-2 text-2xl text-yellow-100">{reviewCaptionCount}</div>
                  </div>
                  <div className="rounded-md border border-cyan-500/20 bg-black/35 p-4">
                    <div className="text-xs cyber-label text-cyan-300/60">CHINESE</div>
                    <div className="mt-2 text-2xl text-cyan-100">{translatedCaptionCount}</div>
                  </div>
                  <div className="rounded-md border border-cyan-500/20 bg-black/35 p-4">
                    <div className="text-xs cyber-label text-cyan-300/60">MANUAL</div>
                    <div className="mt-2 text-2xl text-cyan-100">{manualCaptionCount}</div>
                  </div>
                </div>
              )}
            </section>

            {false
              ? createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                <button
                  type="button"
                  aria-label="Close caption editor"
                  onClick={() => setIsCaptionEditorOpen(false)}
                  className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={() => setIsCaptionEditorOpen(false)}
                  className="fixed left-4 top-4 z-[10000] rounded-md border-2 border-cyan-300/70 bg-black/95 px-4 py-3 text-xs text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.24)] transition-colors hover:border-cyan-100 hover:bg-cyan-500/[0.22]"
                >
                  BACK TO UPLOAD
                </button>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="caption-editor-title"
                  className="relative z-10 flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/95 shadow-[0_0_48px_rgba(34,211,238,0.25)]"
                >
                  <div className="flex flex-col gap-3 border-b border-cyan-500/30 bg-cyan-950/35 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 id="caption-editor-title" className="text-lg cyber-title text-cyan-300">CAPTION EDITOR</h2>
                      <p className="mt-1 text-xs text-cyan-300/65">
                        {captions.length} blocks · {reviewCaptionCount} need review
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCaptionEditorOpen(false)}
                      className="rounded-md border-2 border-cyan-300/70 bg-cyan-500/[0.18] px-5 py-3 text-xs text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition-colors hover:border-cyan-200 hover:bg-cyan-500/[0.25]"
                    >
                      CLOSE EDITOR
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-5">
                    {captions.length === 0 ? (
                      <div className="rounded-md border border-cyan-500/20 bg-black/25 px-4 py-6 text-center text-sm text-cyan-200/65">
                        No captions remain. Close this editor and import SRT / VTT / JSON captions again.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {captions.map((caption, index) => (
                          <div
                            key={caption.localId}
                            className={`rounded-md border p-4 ${
                              caption.needsReview || caption.translationNeedsReview
                                ? 'border-yellow-400/50 bg-yellow-500/[0.08]'
                                : 'border-cyan-500/20 bg-black/35'
                            }`}
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-cyan-300/75">
                              <span className="font-mono">#{index + 1}</span>
                              <span>{formatVideoTime(caption.startTime)} → {formatVideoTime(caption.endTime)}</span>
                              {caption.needsReview ? <span className="text-yellow-200">REVIEW</span> : null}
                              {caption.translationStatus ? (
                                <span className="rounded border border-cyan-500/25 px-2 py-0.5 text-cyan-200/70">
                                  {caption.translationStatus.toUpperCase()}
                                </span>
                              ) : null}
                              {caption.translationNeedsReview ? <span className="text-yellow-200">TRANSLATION REVIEW</span> : null}
                            </div>

                            <div className="grid gap-3 md:grid-cols-[0.65fr_0.65fr_1fr_auto]">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={caption.startTime}
                                onChange={(event) => updateCaption(caption.localId, { startTime: Number(event.target.value) })}
                                className="rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                                aria-label={`Caption ${index + 1} start time`}
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={caption.endTime}
                                onChange={(event) => updateCaption(caption.localId, { endTime: Number(event.target.value) })}
                                className="rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                                aria-label={`Caption ${index + 1} end time`}
                              />
                              {isVideoTrainingDramaTag(tag) ? (
                                <select
                                  value={caption.speaker}
                                  onChange={(event) => updateCaption(caption.localId, { speaker: event.target.value })}
                                  className="rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                                  aria-label={`Caption ${index + 1} speaker`}
                                >
                                  <option value="">No speaker</option>
                                  {characterNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="rounded-md border border-cyan-500/15 bg-black/25 px-3 py-2 text-sm text-cyan-300/40">No speaker</div>
                              )}
                              <button
                                type="button"
                                onClick={() => setCaptions((prev) => prev.filter((entry) => entry.localId !== caption.localId))}
                                className="rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                              >
                                DELETE
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <textarea
                                value={caption.enText}
                                onChange={(event) => updateCaption(caption.localId, { enText: event.target.value })}
                                rows={3}
                                className="w-full resize-y rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                                placeholder="English"
                              />
                              <textarea
                                value={caption.zhText}
                                onChange={(event) => updateCaptionZhText(caption.localId, event.target.value)}
                                rows={3}
                                className="w-full resize-y rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                                placeholder="Chinese translation"
                              />
                            </div>
                            {caption.translationNote ? (
                              <div className="mt-3 rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] px-3 py-2 text-xs text-yellow-100/80">
                                {caption.translationNote}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-cyan-500/30 bg-black/90 p-4">
                    <button
                      type="button"
                      onClick={() => setIsCaptionEditorOpen(false)}
                      className="w-full rounded-md border-2 border-cyan-400/60 bg-cyan-500/[0.16] px-5 py-3 text-sm text-cyan-50 transition-colors hover:border-cyan-200 hover:bg-cyan-500/[0.24]"
                    >
                      DONE / BACK TO UPLOAD
                    </button>
                  </div>
                </div>
                </div>,
                document.body
              )
              : null}

            <VideoCaptionEditorModal
              isOpen={isCaptionEditorOpen}
              title="CAPTION EDITOR"
              topCloseLabel="BACK TO UPLOAD"
              bottomCloseLabel="DONE / BACK TO UPLOAD"
              captions={captions}
              tag={tag}
              characterNames={characterNames}
              onClose={() => setIsCaptionEditorOpen(false)}
              onAddCaption={handleAddCaptionRow}
              onUpdateCaption={updateCaption}
              onUpdateCaptionZhText={updateCaptionZhText}
              onDeleteCaption={(localId) => setCaptions((prev) => prev.filter((entry) => entry.localId !== localId))}
            />

            {status ? (
              <div
                className={`rounded-md border px-4 py-3 text-sm ${
                  status.type === 'error'
                    ? 'border-red-500/45 bg-red-500/[0.08] text-red-200'
                    : status.type === 'success'
                      ? 'border-cyan-500/45 bg-cyan-500/[0.08] text-cyan-200'
                      : 'border-yellow-500/45 bg-yellow-500/[0.08] text-yellow-200'
                }`}
              >
                {status.message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-cyan-500/25 pt-6 md:flex-row">
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 rounded-md border-2 border-cyan-500/55 bg-cyan-500/[0.12] px-8 py-4 text-sm text-cyan-200 transition-colors hover:border-cyan-300/80 hover:bg-cyan-500/[0.18] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {publishButtonLabel}
              </button>
              <button
                type="button"
                onClick={() => router.push('/video')}
                className="rounded-md border-2 border-gray-600/50 bg-black/40 px-8 py-4 text-sm text-gray-300 transition-colors hover:border-gray-500/70 hover:text-gray-100"
              >
                [ CANCEL ]
              </button>
            </div>
          </form>
        </div>
      </div>

      <ImageCropModal
        isOpen={Boolean(pendingImageCrop)}
        file={pendingImageCrop?.file || null}
        preset={pendingImageCrop?.preset || 'cover'}
        title={pendingImageCrop?.title || 'CROP IMAGE'}
        description={pendingImageCrop?.description}
        onCancel={() => setPendingImageCrop(null)}
        onConfirm={handleApplyImageCrop}
      />
    </div>
  )
}
