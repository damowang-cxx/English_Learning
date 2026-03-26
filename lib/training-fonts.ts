import localFont from 'next/font/local'

const readingSerif = localFont({
  src: [
    { path: '../app/fonts/training/newsreader-400.ttf', weight: '400', style: 'normal' },
    { path: '../app/fonts/training/newsreader-500.ttf', weight: '500', style: 'normal' },
    { path: '../app/fonts/training/newsreader-600.ttf', weight: '600', style: 'normal' },
    { path: '../app/fonts/training/newsreader-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
})

const readingSans = localFont({
  src: [
    { path: '../app/fonts/training/public-sans-400.ttf', weight: '400', style: 'normal' },
    { path: '../app/fonts/training/public-sans-500.ttf', weight: '500', style: 'normal' },
    { path: '../app/fonts/training/public-sans-600.ttf', weight: '600', style: 'normal' },
    { path: '../app/fonts/training/public-sans-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
})

const modernSans = localFont({
  src: [
    { path: '../app/fonts/training/plus-jakarta-sans-400.ttf', weight: '400', style: 'normal' },
    { path: '../app/fonts/training/plus-jakarta-sans-500.ttf', weight: '500', style: 'normal' },
    { path: '../app/fonts/training/plus-jakarta-sans-600.ttf', weight: '600', style: 'normal' },
    { path: '../app/fonts/training/plus-jakarta-sans-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
})

const futureTech = localFont({
  src: [
    { path: '../app/fonts/training/exo-2-400.ttf', weight: '400', style: 'normal' },
    { path: '../app/fonts/training/exo-2-500.ttf', weight: '500', style: 'normal' },
    { path: '../app/fonts/training/exo-2-600.ttf', weight: '600', style: 'normal' },
    { path: '../app/fonts/training/exo-2-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
})

export const TRAINING_SENTENCE_FONT_STORAGE_KEY = 'trainingSentenceFont'

export const TRAINING_SENTENCE_FONT_OPTIONS = [
  {
    id: 'classic-mono',
    label: 'Classic Mono',
    className: 'cyber-font-readable',
  },
  {
    id: 'reading-serif',
    label: 'Reading Serif',
    className: readingSerif.className,
  },
  {
    id: 'reading-sans',
    label: 'Reading Sans',
    className: readingSans.className,
  },
  {
    id: 'modern-sans',
    label: 'Modern Sans',
    className: modernSans.className,
  },
  {
    id: 'future-tech',
    label: 'Future Tech',
    className: futureTech.className,
  },
] as const

export type TrainingSentenceFontId = (typeof TRAINING_SENTENCE_FONT_OPTIONS)[number]['id']

export const DEFAULT_TRAINING_SENTENCE_FONT_ID: TrainingSentenceFontId =
  TRAINING_SENTENCE_FONT_OPTIONS[0].id

export function isTrainingSentenceFontId(value: string): value is TrainingSentenceFontId {
  return TRAINING_SENTENCE_FONT_OPTIONS.some((option) => option.id === value)
}

export function getTrainingSentenceFontOption(fontId: TrainingSentenceFontId) {
  return (
    TRAINING_SENTENCE_FONT_OPTIONS.find((option) => option.id === fontId)
    || TRAINING_SENTENCE_FONT_OPTIONS[0]
  )
}
