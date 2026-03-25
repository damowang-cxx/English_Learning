import type { VocabularySense } from '@/lib/vocabulary'

export type GlobalVocabularySort = 'frequency' | 'alphabet' | 'recent'

export interface GlobalVocabularySentenceRef {
  trainingItemId: string
  trainingTitle: string
  sentenceId: string
  sentenceOrder: number
  sentenceText: string
}

export interface GlobalVocabularyItem {
  headword: string
  headwordKey: string
  label: string
  senses: VocabularySense[]
  phonetic?: string
  occurrenceCount: number
  trainingItemCount: number
  sentences: GlobalVocabularySentenceRef[]
  lastSeenAt: string
}

export interface GlobalVocabularySummary {
  uniqueWords: number
  totalOccurrences: number
  totalTrainingItems: number
  totalSentences: number
}

export interface GlobalVocabularyResult {
  generatedAt: string
  summary: GlobalVocabularySummary
  items: GlobalVocabularyItem[]
}
