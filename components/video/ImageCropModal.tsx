/* eslint-disable @next/next/no-img-element */
'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type ImageCropPreset = 'cover' | 'avatar'

interface ImageCropModalProps {
  isOpen: boolean
  file: File | null
  preset: ImageCropPreset
  title: string
  description?: string
  onCancel: () => void
  onConfirm: (file: File) => void | Promise<void>
}

type CropOffset = {
  x: number
  y: number
}

type LoadedImageState = {
  naturalWidth: number
  naturalHeight: number
}

const PRESET_CONFIG = {
  cover: {
    aspectRatio: 16 / 9,
    previewWidth: 720,
    outputWidth: 1280,
    outputHeight: 720,
    hint: '16:9 cover',
  },
  avatar: {
    aspectRatio: 1,
    previewWidth: 520,
    outputWidth: 640,
    outputHeight: 640,
    hint: '1:1 avatar',
  },
} satisfies Record<ImageCropPreset, {
  aspectRatio: number
  previewWidth: number
  outputWidth: number
  outputHeight: number
  hint: string
}>

const CANVAS_OUTPUT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getOutputMimeType(file: File) {
  const nextType = file.type.toLowerCase()
  return CANVAS_OUTPUT_TYPES.has(nextType) ? nextType : 'image/png'
}

function getFileExtensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/webp':
      return '.webp'
    default:
      return '.png'
  }
}

function replaceFileExtension(fileName: string, extension: string) {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return `${fileName}${extension}`
  }

  return `${fileName.slice(0, lastDotIndex)}${extension}`
}

function clampCropOffset(offset: CropOffset, imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  const maxX = Math.max(0, (imageWidth - frameWidth) / 2)
  const maxY = Math.max(0, (imageHeight - frameHeight) / 2)

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  } satisfies CropOffset
}

export default function ImageCropModal({
  isOpen,
  file,
  preset,
  title,
  description,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [loadedImage, setLoadedImage] = useState<LoadedImageState | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    offset: CropOffset
  } | null>(null)

  const config = PRESET_CONFIG[preset]
  const frameWidth = config.previewWidth
  const frameHeight = Math.round(frameWidth / config.aspectRatio)

  useEffect(() => {
    if (!isOpen || !file) {
      setSourceUrl(null)
      setLoadedImage(null)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setError(null)
      imageRef.current = null
      return
    }

    let didCancel = false
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()

    setSourceUrl(objectUrl)
    setLoadedImage(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setError(null)

    image.onload = () => {
      if (didCancel) {
        return
      }

      imageRef.current = image
      setLoadedImage({
        naturalWidth: image.naturalWidth || image.width,
        naturalHeight: image.naturalHeight || image.height,
      })
    }

    image.onerror = () => {
      if (didCancel) {
        return
      }

      imageRef.current = null
      setLoadedImage(null)
      setError('Failed to load the selected image for cropping.')
    }

    image.src = objectUrl

    return () => {
      didCancel = true
      imageRef.current = null
      URL.revokeObjectURL(objectUrl)
    }
  }, [file, isOpen, preset])

  const scaledImage = useMemo(() => {
    if (!loadedImage) {
      return null
    }

    const baseScale = Math.max(frameWidth / loadedImage.naturalWidth, frameHeight / loadedImage.naturalHeight)
    const scale = baseScale * zoom

    return {
      scale,
      width: loadedImage.naturalWidth * scale,
      height: loadedImage.naturalHeight * scale,
    }
  }, [frameHeight, frameWidth, loadedImage, zoom])

  useEffect(() => {
    if (!scaledImage) {
      return
    }

    setOffset((current) => clampCropOffset(current, scaledImage.width, scaledImage.height, frameWidth, frameHeight))
  }, [frameHeight, frameWidth, scaledImage])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current || !previewRef.current || !scaledImage) {
        return
      }

      const rect = previewRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      const scaleFactor = frameWidth / rect.width
      const nextOffset = {
        x: dragRef.current.offset.x + (event.clientX - dragRef.current.startX) * scaleFactor,
        y: dragRef.current.offset.y + (event.clientY - dragRef.current.startY) * scaleFactor,
      }

      setOffset(clampCropOffset(nextOffset, scaledImage.width, scaledImage.height, frameWidth, frameHeight))
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      dragRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [frameHeight, frameWidth, isDragging, scaledImage])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isApplying) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isApplying, isOpen, onCancel])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scaledImage) {
      return
    }

    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offset,
    }
    setIsDragging(true)
  }

  const handleZoomChange = (nextZoom: number) => {
    if (!scaledImage || !loadedImage) {
      setZoom(nextZoom)
      return
    }

    const baseScale = Math.max(frameWidth / loadedImage.naturalWidth, frameHeight / loadedImage.naturalHeight)
    const nextScale = baseScale * nextZoom
    const nextWidth = loadedImage.naturalWidth * nextScale
    const nextHeight = loadedImage.naturalHeight * nextScale

    setZoom(nextZoom)
    setOffset((current) => clampCropOffset(current, nextWidth, nextHeight, frameWidth, frameHeight))
  }

  const handleApply = async () => {
    if (!file || !loadedImage || !scaledImage || !imageRef.current) {
      return
    }

    setIsApplying(true)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = config.outputWidth
      canvas.height = config.outputHeight

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas is not available for image cropping.')
      }

      const imageLeft = (frameWidth - scaledImage.width) / 2 + offset.x
      const imageTop = (frameHeight - scaledImage.height) / 2 + offset.y
      const sourceWidth = frameWidth / scaledImage.scale
      const sourceHeight = frameHeight / scaledImage.scale
      const sourceX = clamp(-imageLeft / scaledImage.scale, 0, loadedImage.naturalWidth - sourceWidth)
      const sourceY = clamp(-imageTop / scaledImage.scale, 0, loadedImage.naturalHeight - sourceHeight)
      const outputMimeType = getOutputMimeType(file)

      context.drawImage(
        imageRef.current,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob)
            return
          }

          reject(new Error('Failed to export the cropped image.'))
        }, outputMimeType, outputMimeType === 'image/jpeg' ? 0.92 : undefined)
      })

      const extension = getFileExtensionForMimeType(outputMimeType)
      const croppedFile = new File([blob], replaceFileExtension(file.name, extension), {
        type: outputMimeType,
        lastModified: Date.now(),
      })

      await onConfirm(croppedFile)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to crop the image.')
      return
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen || !file || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Close image crop modal"
        onClick={onCancel}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
      />
      <div className="relative z-10 flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/95 shadow-[0_0_48px_rgba(34,211,238,0.22)]">
        <div className="border-b border-cyan-500/30 bg-cyan-950/30 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs cyber-label text-cyan-400/70">IMAGE CROP</div>
              <h2 className="mt-1 text-xl cyber-title text-cyan-200">{title}</h2>
              <p className="mt-2 text-xs text-cyan-300/65">
                {description || `Drag to reposition and use zoom for a simple ${config.hint} crop.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="rounded-md border border-gray-600/60 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-gray-400/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              CLOSE
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="rounded-lg border border-cyan-500/20 bg-black/45 p-3 md:p-4">
              <div
                ref={previewRef}
                onPointerDown={handlePointerDown}
                className={`relative mx-auto w-full max-w-full overflow-hidden rounded-md border border-cyan-400/35 bg-black/70 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none select-none`}
                style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}
              >
                {sourceUrl && scaledImage ? (
                  <>
                    <img
                      src={sourceUrl}
                      alt="Crop preview"
                      draggable={false}
                      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                      style={{
                        width: `${scaledImage.width}px`,
                        height: `${scaledImage.height}px`,
                        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 border border-cyan-300/45 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.16)]" />
                    <div
                      className="pointer-events-none absolute inset-0 opacity-55"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)',
                        backgroundSize: '33.333% 33.333%',
                      }}
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-cyan-300/55">
                    {error ? 'IMAGE LOAD FAILED' : 'LOADING IMAGE...'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-cyan-500/20 bg-black/35 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <label className="mb-2 block text-xs cyber-label text-cyan-300/70" htmlFor="image-crop-zoom">
                  ZOOM
                </label>
                <input
                  id="image-crop-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="mt-2 text-xs text-cyan-300/65">
                  {zoom.toFixed(2)}x · {config.hint.toUpperCase()} · {file.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  setOffset({ x: 0, y: 0 })
                }}
                className="rounded-md border border-cyan-500/35 px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70"
              >
                RESET
              </button>
            </div>

            {error ? (
              <div className="rounded-md border border-red-500/45 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-cyan-500/30 bg-black/90 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || !loadedImage}
              className="flex-1 rounded-md border-2 border-cyan-500/60 bg-cyan-500/[0.14] px-6 py-3 text-sm text-cyan-100 transition-colors hover:border-cyan-300/80 hover:bg-cyan-500/[0.2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? 'APPLYING...' : 'APPLY CROP'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="rounded-md border-2 border-gray-600/50 bg-black/40 px-6 py-3 text-sm text-gray-300 transition-colors hover:border-gray-500/70 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
