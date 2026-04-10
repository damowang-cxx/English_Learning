'use client'

import { createPortal } from 'react-dom'
import { formatVideoTime, isVideoTrainingDramaTag, type VideoTrainingTag } from '@/lib/video-training'
import { type VideoCaptionDraft } from '@/lib/video-training-form'

interface VideoCaptionEditorModalProps {
  isOpen: boolean
  title?: string
  topCloseLabel?: string
  bottomCloseLabel?: string
  captions: VideoCaptionDraft[]
  tag: VideoTrainingTag
  characterNames: string[]
  onClose: () => void
  onAddCaption?: () => void
  onUpdateCaption: (localId: string, patch: Partial<VideoCaptionDraft>) => void
  onUpdateCaptionZhText: (localId: string, zhText: string) => void
  onDeleteCaption: (localId: string) => void
}

export default function VideoCaptionEditorModal({
  isOpen,
  title = 'CAPTION EDITOR',
  topCloseLabel = 'BACK',
  bottomCloseLabel = 'DONE',
  captions,
  tag,
  characterNames,
  onClose,
  onAddCaption,
  onUpdateCaption,
  onUpdateCaptionZhText,
  onDeleteCaption,
}: VideoCaptionEditorModalProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const reviewCaptionCount = captions.filter((caption) => caption.needsReview || caption.translationNeedsReview).length
  const isDramaTag = isVideoTrainingDramaTag(tag)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Close caption editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
      />
      <button
        type="button"
        onClick={onClose}
        className="fixed left-4 top-4 z-[10000] rounded-md border-2 border-cyan-300/70 bg-black/95 px-4 py-3 text-xs text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.24)] transition-colors hover:border-cyan-100 hover:bg-cyan-500/[0.22]"
      >
        {topCloseLabel}
      </button>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caption-editor-title"
        className="relative z-10 flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/95 shadow-[0_0_48px_rgba(34,211,238,0.25)]"
      >
        <div className="flex flex-col gap-3 border-b border-cyan-500/30 bg-cyan-950/35 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="caption-editor-title" className="text-lg cyber-title text-cyan-300">{title}</h2>
            <p className="mt-1 text-xs text-cyan-300/65">
              {captions.length} blocks 路 {reviewCaptionCount} need review
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onAddCaption ? (
              <button
                type="button"
                onClick={onAddCaption}
                className="rounded-md border border-cyan-300/60 bg-cyan-500/[0.16] px-4 py-3 text-xs text-cyan-50 transition-colors hover:border-cyan-200 hover:bg-cyan-500/[0.24]"
              >
                ADD CAPTION
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border-2 border-cyan-300/70 bg-cyan-500/[0.18] px-5 py-3 text-xs text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition-colors hover:border-cyan-200 hover:bg-cyan-500/[0.25]"
            >
              CLOSE EDITOR
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {captions.length === 0 ? (
            <div className="rounded-md border border-cyan-500/20 bg-black/25 px-4 py-6 text-center text-sm text-cyan-200/65">
              No captions remain. Add a caption row to continue editing.
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
                    <span>{formatVideoTime(caption.startTime)} 鈫?{formatVideoTime(caption.endTime)}</span>
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
                      onChange={(event) => onUpdateCaption(caption.localId, { startTime: Number(event.target.value) })}
                      className="rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      aria-label={`Caption ${index + 1} start time`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={caption.endTime}
                      onChange={(event) => onUpdateCaption(caption.localId, { endTime: Number(event.target.value) })}
                      className="rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      aria-label={`Caption ${index + 1} end time`}
                    />
                    {isDramaTag ? (
                      <select
                        value={caption.speaker}
                        onChange={(event) => onUpdateCaption(caption.localId, { speaker: event.target.value })}
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
                      onClick={() => onDeleteCaption(caption.localId)}
                      className="rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
                    >
                      DELETE
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <textarea
                      value={caption.enText}
                      onChange={(event) => onUpdateCaption(caption.localId, { enText: event.target.value })}
                      rows={3}
                      className="w-full resize-y rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                      placeholder="English"
                    />
                    <textarea
                      value={caption.zhText}
                      onChange={(event) => onUpdateCaptionZhText(caption.localId, event.target.value)}
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
            onClick={onClose}
            className="w-full rounded-md border-2 border-cyan-400/60 bg-cyan-500/[0.16] px-5 py-3 text-sm text-cyan-50 transition-colors hover:border-cyan-200 hover:bg-cyan-500/[0.24]"
          >
            {bottomCloseLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
