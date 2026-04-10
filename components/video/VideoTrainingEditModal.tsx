'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import VideoCaptionEditorModal from '@/components/video/VideoCaptionEditorModal'
import ImageCropModal, { type ImageCropPreset } from '@/components/video/ImageCropModal'
import { getVideoCoverSrc, withBasePath } from '@/lib/base-path'
import {
  VIDEO_TRAINING_TAGS,
  isVideoTrainingDramaTag,
  type VideoTrainingTag,
} from '@/lib/video-training'
import {
  buildVideoCaptionPayload,
  clearCaptionSpeakerByCharacterName,
  createEmptyVideoCaptionDraft,
  createLocalId,
  createVideoCaptionDraftFromItem,
  createVideoCharacterDraftFromItem,
  extractVideoMediaFileName,
  getVideoCharacterNames,
  updateCaptionSpeakerAfterCharacterRename,
  type VideoCaptionDraft,
  type VideoCharacterDraft,
} from '@/lib/video-training-form'

interface EditableVideoCaption {
  id: string
  startTime: number
  endTime: number
  enText: string
  zhText: string | null
  speaker: string | null
  isKeySentence: boolean
  order: number
  captionNotes?: Array<{
    id: string
    videoCaptionId: string
    words: string
    notes: string
    createdAt: string
    updatedAt: string
  }>
}

interface EditableVideoCharacter {
  id: string
  name: string
  avatarUrl: string | null
  order: number
}

interface EditableVideoTrainingItem {
  id: string
  title: string
  sourceTitle: string
  plotSummary: string
  tag: string
  mediaType: string
  mediaUrl: string
  coverUrl: string | null
  captions: EditableVideoCaption[]
  characters: EditableVideoCharacter[]
  phraseNotes: Array<{
    id: string
    captionId: string | null
    phrase: string
    note: string
    createdAt: string
  }>
}

interface VideoTrainingEditModalProps {
  isOpen: boolean
  item: EditableVideoTrainingItem | null
  onClose: () => void
  onSaved: (item: EditableVideoTrainingItem) => void
}

interface VideoTrainingEditDraft {
  title: string
  sourceTitle: string
  plotSummary: string
  tag: VideoTrainingTag
  mediaFileName: string
  coverAction: 'keep' | 'replace' | 'remove'
  coverFile: File | null
  currentCoverUrl: string | null
  captions: VideoCaptionDraft[]
  characters: VideoCharacterDraft[]
}

type PendingImageCrop = {
  target: 'cover' | 'character'
  localId?: string
  file: File
  preset: ImageCropPreset
  title: string
  description: string
}

function createDraftFromItem(item: EditableVideoTrainingItem): VideoTrainingEditDraft {
  return {
    title: item.title,
    sourceTitle: item.sourceTitle,
    plotSummary: item.plotSummary,
    tag: VIDEO_TRAINING_TAGS.includes(item.tag as VideoTrainingTag)
      ? item.tag as VideoTrainingTag
      : VIDEO_TRAINING_TAGS[0],
    mediaFileName: extractVideoMediaFileName(item.mediaUrl),
    coverAction: 'keep',
    coverFile: null,
    currentCoverUrl: item.coverUrl,
    captions: item.captions.map(createVideoCaptionDraftFromItem),
    characters: item.characters.map(createVideoCharacterDraftFromItem),
  }
}

export default function VideoTrainingEditModal({
  isOpen,
  item,
  onClose,
  onSaved,
}: VideoTrainingEditModalProps) {
  const [draft, setDraft] = useState<VideoTrainingEditDraft | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [pendingImageCrop, setPendingImageCrop] = useState<PendingImageCrop | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setDraft(null)
      setIsDirty(false)
      setStatus(null)
      setIsCaptionEditorOpen(false)
      setPendingImageCrop(null)
      return
    }

    if (!item) {
      return
    }

    setDraft(createDraftFromItem(item))
    setIsDirty(false)
    setStatus(null)
    setIsCaptionEditorOpen(false)
    setPendingImageCrop(null)
  }, [isOpen, item])

  useEffect(() => {
    if (!draft?.coverFile) {
      setCoverPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(draft.coverFile)
    setCoverPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [draft?.coverFile])

  const characterNames = useMemo(
    () => draft ? getVideoCharacterNames(draft.characters) : [],
    [draft]
  )

  const reviewCaptionCount = draft
    ? draft.captions.filter((caption) => caption.needsReview || caption.translationNeedsReview).length
    : 0
  const translatedCaptionCount = draft
    ? draft.captions.filter((caption) => caption.zhText.trim()).length
    : 0

  const requestClose = () => {
    if (isSaving) {
      return
    }

    if (isDirty && !window.confirm('Discard unsaved video training edits?')) {
      return
    }

    onClose()
  }

  const updateDraft = (updater: (current: VideoTrainingEditDraft) => VideoTrainingEditDraft) => {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const next = updater(current)
      setIsDirty(true)
      return next
    })
  }

  const updateCaption = (localId: string, patch: Partial<VideoCaptionDraft>) => {
    updateDraft((current) => ({
      ...current,
      captions: current.captions.map((caption) =>
        caption.localId === localId ? { ...caption, ...patch, needsReview: false } : caption
      ),
    }))
  }

  const updateCaptionZhText = (localId: string, zhText: string) => {
    updateCaption(localId, {
      zhText,
      translationStatus: zhText.trim() ? 'manual' : 'empty',
      translationNeedsReview: false,
      translationNote: '',
    })
  }

  const handleAddCaption = () => {
    updateDraft((current) => {
      const previousEndTime = current.captions.length > 0 ? current.captions[current.captions.length - 1].endTime : 0
      return {
        ...current,
        captions: [...current.captions, createEmptyVideoCaptionDraft(previousEndTime)],
      }
    })
  }

  const handleDeleteCaption = (localId: string) => {
    updateDraft((current) => ({
      ...current,
      captions: current.captions.filter((caption) => caption.localId !== localId),
    }))
  }

  const handleAddCharacter = () => {
    updateDraft((current) => ({
      ...current,
      characters: [
        ...current.characters,
        {
          localId: createLocalId(),
          name: '',
          avatarFile: null,
          avatarAction: 'keep',
          currentAvatarUrl: null,
        },
      ],
    }))
  }

  const handleCharacterNameChange = (localId: string, nextName: string) => {
    updateDraft((current) => {
      const character = current.characters.find((entry) => entry.localId === localId)
      const previousName = character?.name || ''
      const nextCharacters = current.characters.map((entry) =>
        entry.localId === localId ? { ...entry, name: nextName } : entry
      )

      return {
        ...current,
        characters: nextCharacters,
        captions: updateCaptionSpeakerAfterCharacterRename(current.captions, previousName.trim(), nextName.trim()),
      }
    })
  }

  const handleCharacterAvatarFileChange = (localId: string, file: File | null) => {
    updateDraft((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.localId === localId
          ? {
              ...character,
              avatarFile: file,
              avatarAction: file ? 'replace' : character.currentAvatarUrl ? 'keep' : 'keep',
            }
          : character
      ),
    }))
  }

  const handleCharacterAvatarAction = (localId: string, avatarAction: 'keep' | 'remove') => {
    updateDraft((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.localId === localId
          ? {
              ...character,
              avatarFile: null,
              avatarAction,
            }
          : character
      ),
    }))
  }

  const handleRemoveCharacter = (localId: string) => {
    updateDraft((current) => {
      const character = current.characters.find((entry) => entry.localId === localId)
      const removedName = character?.name.trim() || ''

      return {
        ...current,
        characters: current.characters.filter((entry) => entry.localId !== localId),
        captions: clearCaptionSpeakerByCharacterName(current.captions, removedName),
      }
    })
  }

  const beginImageCrop = (crop: PendingImageCrop) => {
    setPendingImageCrop(crop)
  }

  const handleApplyImageCrop = async (croppedFile: File) => {
    if (!pendingImageCrop) {
      return
    }

    if (pendingImageCrop.target === 'cover') {
      updateDraft((current) => ({
        ...current,
        coverFile: croppedFile,
        coverAction: 'replace',
      }))
      setPendingImageCrop(null)
      return
    }

    const localId = pendingImageCrop.localId
    if (!localId) {
      setPendingImageCrop(null)
      return
    }

    updateDraft((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.localId === localId
          ? {
              ...character,
              avatarFile: croppedFile,
              avatarAction: 'replace',
            }
          : character
      ),
    }))
    setPendingImageCrop(null)
  }

  const handleSave = async () => {
    if (!draft || !item) {
      return
    }

    if (!draft.title.trim()) {
      setStatus('Title is required.')
      return
    }

    if (!draft.mediaFileName.trim()) {
      setStatus('Enter the video file name already placed in public/video.')
      return
    }

    if (draft.captions.length === 0) {
      setStatus('At least one caption is required.')
      return
    }

    const invalidCaptionIndex = draft.captions.findIndex((caption) =>
      !caption.enText.trim()
      || !Number.isFinite(caption.startTime)
      || !Number.isFinite(caption.endTime)
      || caption.endTime <= caption.startTime
    )

    if (invalidCaptionIndex >= 0) {
      setStatus(`Caption #${invalidCaptionIndex + 1} needs a valid time range and English text.`)
      return
    }

    setIsSaving(true)
    setStatus(null)

    try {
      const formData = new FormData()
      const characterPayload = isVideoTrainingDramaTag(draft.tag)
        ? draft.characters
            .map((character, index) => ({
              ...(character.id ? { id: character.id } : {}),
              name: character.name.trim(),
              avatarAction: character.avatarAction,
              avatarField: character.avatarFile ? `characterAvatar_${index}` : null,
              avatarFile: character.avatarFile,
            }))
            .filter((character) => character.name)
        : []

      formData.append('title', draft.title.trim())
      formData.append('sourceTitle', draft.sourceTitle.trim())
      formData.append('plotSummary', draft.plotSummary.trim())
      formData.append('tag', draft.tag)
      formData.append('mediaFileName', draft.mediaFileName.trim())
      formData.append('removeCover', draft.coverAction === 'remove' ? 'true' : 'false')

      if (draft.coverAction === 'replace' && draft.coverFile) {
        formData.append('cover', draft.coverFile)
      }

      formData.append('captions', JSON.stringify(buildVideoCaptionPayload(draft.captions, draft.tag)))
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

      const response = await fetch(withBasePath(`/api/video-training-items/${item.id}`), {
        method: 'PUT',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || `Save failed: ${response.status}`)
      }

      setIsDirty(false)
      onSaved(payload as EditableVideoTrainingItem)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save video training changes.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !draft) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 md:p-6">
        <button
          type="button"
          aria-label="Close video training editor"
          onClick={requestClose}
          className="absolute inset-0 bg-black/82 backdrop-blur-sm"
        />
        <div className="relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/95 shadow-[0_0_48px_rgba(34,211,238,0.22)]">
          <div className="border-b border-cyan-500/30 bg-cyan-950/30 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs cyber-label text-cyan-400/70">VIDEO TRAINING</div>
                <h2 className="mt-1 text-2xl cyber-title text-cyan-200">[ EDIT MODULE ]</h2>
                <p className="mt-2 text-xs text-cyan-300/65">Update metadata, cover, roles, and captions without replacing the whole item.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsCaptionEditorOpen(true)}
                  className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
                >
                  EDIT CAPTIONS
                </button>
                <button
                  type="button"
                  onClick={requestClose}
                  className="rounded-md border border-gray-600/60 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-gray-400/70"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            <div className="space-y-8">
              <section className="grid gap-5 md:grid-cols-2">
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-xs text-cyan-300 cyber-label">TITLE *</span>
                    <input
                      value={draft.title}
                      onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      placeholder="Clip title"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs text-cyan-300 cyber-label">WORK</span>
                    <input
                      value={draft.sourceTitle}
                      onChange={(event) => updateDraft((current) => ({ ...current, sourceTitle: event.target.value }))}
                      className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      placeholder="Movie, show, speech, or source"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs text-cyan-300 cyber-label">SUMMARY</span>
                    <textarea
                      value={draft.plotSummary}
                      onChange={(event) => updateDraft((current) => ({ ...current, plotSummary: event.target.value }))}
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
                          onClick={() => updateDraft((current) => ({ ...current, tag: option }))}
                          className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                            draft.tag === option
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
                      value={draft.mediaFileName}
                      onChange={(event) => updateDraft((current) => ({ ...current, mediaFileName: event.target.value }))}
                      className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      placeholder="clip.mp4"
                    />
                    <span className="mt-2 block text-xs leading-5 text-cyan-300/65">
                      The media file must already exist in public/video.
                    </span>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg cyber-title text-cyan-300">COVER</h3>
                    <p className="mt-1 text-xs text-cyan-300/65">Keep the current cover, replace it, or remove it.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateDraft((current) => ({ ...current, coverAction: 'keep', coverFile: null }))}
                      className={`rounded-md border px-3 py-2 text-xs ${
                        draft.coverAction === 'keep'
                          ? 'border-cyan-300/70 bg-cyan-400/[0.14] text-cyan-100'
                          : 'border-cyan-500/30 text-cyan-300/70'
                      }`}
                    >
                      KEEP
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft((current) => ({ ...current, coverAction: 'remove', coverFile: null }))}
                      className={`rounded-md border px-3 py-2 text-xs ${
                        draft.coverAction === 'remove'
                          ? 'border-red-400/70 bg-red-500/[0.12] text-red-100'
                          : 'border-red-500/30 text-red-300/70'
                      }`}
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-md border border-cyan-500/20 bg-black/40">
                    {draft.coverAction === 'remove' ? (
                      <div className="flex h-32 items-center justify-center text-xs text-cyan-300/45">NO COVER</div>
                    ) : (
                      <Image
                        src={coverPreviewUrl || getVideoCoverSrc(draft.currentCoverUrl)}
                        alt="Cover preview"
                        width={440}
                        height={256}
                        unoptimized
                        className="h-32 w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-xs text-cyan-300 cyber-label">REPLACE COVER</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null
                          event.currentTarget.value = ''

                          if (!file) {
                            updateDraft((current) => ({
                              ...current,
                              coverFile: null,
                              coverAction: current.currentCoverUrl ? 'keep' : current.coverAction,
                            }))
                            return
                          }

                          beginImageCrop({
                            target: 'cover',
                            file,
                            preset: 'cover',
                            title: 'CROP COVER',
                            description: 'Adjust the 16:9 cover before saving the updated video training item.',
                          })
                        }}
                        className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-300 file:mr-4 file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-200"
                      />
                    </label>
                    <div className="text-xs text-cyan-300/65">
                      {draft.coverFile
                        ? `New cover: ${draft.coverFile.name}`
                        : draft.currentCoverUrl
                          ? `Current cover: ${draft.currentCoverUrl}`
                          : 'No cover currently set.'}
                    </div>
                    {draft.coverFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!draft.coverFile) {
                            return
                          }

                          beginImageCrop({
                            target: 'cover',
                            file: draft.coverFile,
                            preset: 'cover',
                            title: 'RE-CROP COVER',
                            description: 'Adjust the 16:9 cover before saving the updated video training item.',
                          })
                        }}
                        className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
                      >
                        RE-CROP COVER
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              {isVideoTrainingDramaTag(draft.tag) ? (
                <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg cyber-title text-cyan-300">CHARACTERS</h3>
                      <p className="mt-1 text-xs text-cyan-300/65">Renaming or removing a character updates matching speaker lines automatically.</p>
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
                    {draft.characters.length === 0 ? (
                      <div className="rounded-md border border-cyan-500/20 bg-black/25 px-4 py-3 text-sm text-cyan-200/65">
                        Add roles such as Monica, Chandler, or Rachel.
                      </div>
                    ) : null}
                    {draft.characters.map((character) => (
                      <div key={character.localId} className="rounded-md border border-cyan-500/20 bg-black/35 p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={character.name}
                            onChange={(event) => handleCharacterNameChange(character.localId, event.target.value)}
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
                                handleCharacterAvatarFileChange(character.localId, null)
                                return
                              }

                              beginImageCrop({
                                target: 'character',
                                localId: character.localId,
                                file,
                                preset: 'avatar',
                                title: `CROP ${character.name.trim() || 'CHARACTER'} AVATAR`,
                                description: 'Adjust the square avatar before saving the updated video training item.',
                              })
                            }}
                            className="rounded-md border border-cyan-500/30 bg-black/45 px-3 py-2 text-gray-300 file:mr-3 file:border-0 file:bg-cyan-500/20 file:px-2 file:py-1 file:text-cyan-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCharacter(character.localId)}
                            className="rounded-md border border-red-500/35 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                          >
                            REMOVE
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-cyan-300/65">
                            {character.avatarFile
                              ? `New avatar: ${character.avatarFile.name}`
                              : character.currentAvatarUrl
                                ? `Current avatar: ${character.currentAvatarUrl}`
                                : 'No avatar'}
                          </span>
                          {character.currentAvatarUrl ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCharacterAvatarAction(character.localId, 'keep')}
                                className={`rounded border px-2 py-1 ${
                                  character.avatarAction === 'keep'
                                    ? 'border-cyan-300/70 text-cyan-100'
                                    : 'border-cyan-500/30 text-cyan-300/70'
                                }`}
                              >
                                KEEP AVATAR
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCharacterAvatarAction(character.localId, 'remove')}
                                className={`rounded border px-2 py-1 ${
                                  character.avatarAction === 'remove'
                                    ? 'border-red-400/70 text-red-100'
                                    : 'border-red-500/30 text-red-300/70'
                                }`}
                              >
                                REMOVE AVATAR
                              </button>
                            </>
                          ) : null}
                          {character.avatarFile ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!character.avatarFile) {
                                  return
                                }

                                beginImageCrop({
                                  target: 'character',
                                  localId: character.localId,
                                  file: character.avatarFile,
                                  preset: 'avatar',
                                  title: `RE-CROP ${character.name.trim() || 'CHARACTER'} AVATAR`,
                                  description: 'Adjust the square avatar before saving the updated video training item.',
                                })
                              }}
                              className="rounded border border-cyan-500/30 px-2 py-1 text-cyan-200 transition-colors hover:border-cyan-300/70"
                            >
                              RE-CROP AVATAR
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-lg border border-yellow-500/25 bg-yellow-500/[0.06] p-4 text-sm text-yellow-100/80">
                  Saving with the speech tag clears all characters and speaker bindings.
                </section>
              )}

              <section className="rounded-lg border border-cyan-500/25 bg-black/30 p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg cyber-title text-cyan-300">CAPTION PREVIEW</h3>
                    <p className="mt-1 text-xs text-cyan-300/65">
                      Edit timing, English, Chinese, speaker, delete rows, or add new ones from the caption editor.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCaptionEditorOpen(true)}
                    className="rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
                  >
                    EDIT CAPTIONS
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-cyan-500/20 bg-black/35 p-4">
                    <div className="text-xs cyber-label text-cyan-300/60">TOTAL</div>
                    <div className="mt-2 text-2xl text-cyan-100">{draft.captions.length}</div>
                  </div>
                  <div className="rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] p-4">
                    <div className="text-xs cyber-label text-yellow-200/70">REVIEW</div>
                    <div className="mt-2 text-2xl text-yellow-100">{reviewCaptionCount}</div>
                  </div>
                  <div className="rounded-md border border-cyan-500/20 bg-black/35 p-4">
                    <div className="text-xs cyber-label text-cyan-300/60">CHINESE</div>
                    <div className="mt-2 text-2xl text-cyan-100">{translatedCaptionCount}</div>
                  </div>
                </div>
              </section>

              {status ? (
                <div className="rounded-md border border-red-500/45 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                  {status}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-cyan-500/30 bg-black/90 p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-md border-2 border-cyan-500/60 bg-cyan-500/[0.14] px-6 py-3 text-sm text-cyan-100 transition-colors hover:border-cyan-300/80 hover:bg-cyan-500/[0.2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button
                type="button"
                onClick={requestClose}
                disabled={isSaving}
                className="rounded-md border-2 border-gray-600/50 bg-black/40 px-6 py-3 text-sm text-gray-300 transition-colors hover:border-gray-500/70 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </div>

      <VideoCaptionEditorModal
        isOpen={isCaptionEditorOpen}
        title="CAPTION EDITOR"
        topCloseLabel="BACK TO EDIT"
        bottomCloseLabel="DONE / BACK TO EDIT"
        captions={draft.captions}
        tag={draft.tag}
        characterNames={characterNames}
        onClose={() => setIsCaptionEditorOpen(false)}
        onAddCaption={handleAddCaption}
        onUpdateCaption={updateCaption}
        onUpdateCaptionZhText={updateCaptionZhText}
        onDeleteCaption={handleDeleteCaption}
      />

      <ImageCropModal
        isOpen={Boolean(pendingImageCrop)}
        file={pendingImageCrop?.file || null}
        preset={pendingImageCrop?.preset || 'cover'}
        title={pendingImageCrop?.title || 'CROP IMAGE'}
        description={pendingImageCrop?.description}
        onCancel={() => setPendingImageCrop(null)}
        onConfirm={handleApplyImageCrop}
      />
    </>
  )
}
