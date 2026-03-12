import {
  Atkinson_Hyperlegible,
  IBM_Plex_Mono,
  Literata,
  Source_Sans_3,
} from 'next/font/google'

const hyperlegibleSans = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

const humanistSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const bookSerif = Literata({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const modernMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
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
    id: 'hyperlegible-sans',
    label: 'Hyperlegible Sans',
    className: hyperlegibleSans.className,
  },
  {
    id: 'humanist-sans',
    label: 'Humanist Sans',
    className: humanistSans.className,
  },
  {
    id: 'book-serif',
    label: 'Book Serif',
    className: bookSerif.className,
  },
  {
    id: 'modern-mono',
    label: 'Modern Mono',
    className: modernMono.className,
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
