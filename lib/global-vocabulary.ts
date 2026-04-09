import { prisma } from '@/lib/prisma'
import {
  formatVocabularyEntry,
  getVocabularyEntryKey,
  isVocabularyEntryStructured,
  mergeVocabularyWords,
  parseVocabularyWords,
  type VocabularyEntry,
} from '@/lib/vocabulary'
import type {
  GlobalVocabularyItem,
  GlobalVocabularyResult,
  GlobalVocabularySentenceRef,
  GlobalVocabularySort,
  GlobalVocabularySourceKind,
} from '@/lib/global-vocabulary.types'

interface MutableGlobalVocabularyItem {
  entry: VocabularyEntry
  occurrenceCount: number
  lastSeenAt: Date
  sentences: GlobalVocabularySentenceRef[]
  sentenceIds: Set<string>
  trainingItemIds: Set<string>
}

interface GlobalVocabularyCounters {
  totalOccurrences: number
  trainingItemIds: Set<string>
  sentenceIds: Set<string>
}

function sanitizePhone(value: string | undefined) {
  const cleaned = (value || '').trim()
  if (!cleaned) {
    return ''
  }
  return cleaned.replace(/^[/\[]+|[/\]]+$/g, '')
}

function compareAlphabetically(left: string, right: string) {
  return left.localeCompare(right, 'en', { sensitivity: 'base' })
}

function getSourceKey(kind: GlobalVocabularySourceKind, id: string) {
  return `${kind}:${id}`
}

function parseStructuredEntries(words: string) {
  return mergeVocabularyWords([], parseVocabularyWords(words || '')).filter(isVocabularyEntryStructured)
}

function addSourceEntriesToMap({
  itemMap,
  entries,
  sourceRef,
  updatedAt,
  counters,
}: {
  itemMap: Map<string, MutableGlobalVocabularyItem>
  entries: VocabularyEntry[]
  sourceRef: GlobalVocabularySentenceRef
  updatedAt: Date
  counters: GlobalVocabularyCounters
}) {
  if (entries.length === 0) {
    return
  }

  const trainingSourceKey = getSourceKey(sourceRef.kind, sourceRef.trainingItemId)
  const sentenceSourceKey = getSourceKey(sourceRef.kind, sourceRef.sentenceId)

  counters.trainingItemIds.add(trainingSourceKey)
  counters.sentenceIds.add(sentenceSourceKey)

  for (const entry of entries) {
    const key = getVocabularyEntryKey(entry)
    const existing = itemMap.get(key)

    counters.totalOccurrences += 1

    if (!existing) {
      itemMap.set(key, {
        entry,
        occurrenceCount: 1,
        lastSeenAt: updatedAt,
        sentences: [sourceRef],
        sentenceIds: new Set([sentenceSourceKey]),
        trainingItemIds: new Set([trainingSourceKey]),
      })
      continue
    }

    const mergedEntry = mergeVocabularyWords([existing.entry], [entry]).find(isVocabularyEntryStructured)
    if (mergedEntry) {
      existing.entry = mergedEntry
    }

    existing.occurrenceCount += 1
    if (updatedAt.getTime() > existing.lastSeenAt.getTime()) {
      existing.lastSeenAt = updatedAt
    }

    if (!existing.sentenceIds.has(sentenceSourceKey)) {
      existing.sentenceIds.add(sentenceSourceKey)
      existing.sentences.push(sourceRef)
    }
    existing.trainingItemIds.add(trainingSourceKey)
  }
}

function sortSourceRefs(left: GlobalVocabularySentenceRef, right: GlobalVocabularySentenceRef) {
  if (left.kind !== right.kind) {
    return compareAlphabetically(left.kind, right.kind)
  }
  if (left.trainingItemId !== right.trainingItemId) {
    return compareAlphabetically(left.trainingTitle, right.trainingTitle)
  }
  return left.sentenceOrder - right.sentenceOrder
}

export function sortGlobalVocabularyItems(items: GlobalVocabularyItem[], sort: GlobalVocabularySort) {
  const next = [...items]

  if (sort === 'alphabet') {
    next.sort((left, right) => compareAlphabetically(left.headword, right.headword))
    return next
  }

  if (sort === 'recent') {
    next.sort((left, right) => {
      const timeDelta = new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime()
      if (timeDelta !== 0) {
        return timeDelta
      }
      return compareAlphabetically(left.headword, right.headword)
    })
    return next
  }

  next.sort((left, right) => {
    const occurrenceDelta = right.occurrenceCount - left.occurrenceCount
    if (occurrenceDelta !== 0) {
      return occurrenceDelta
    }
    return compareAlphabetically(left.headword, right.headword)
  })
  return next
}

export function filterGlobalVocabularyItems(items: GlobalVocabularyItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) => {
    if (item.headword.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    if (item.senses.some((sense) => `${sense.pos}${sense.meaning}`.toLowerCase().includes(normalizedQuery))) {
      return true
    }
    return item.sentences.some((sentence) =>
      sentence.kind.toLowerCase().includes(normalizedQuery)
      || sentence.trainingTitle.toLowerCase().includes(normalizedQuery)
      || sentence.sentenceText.toLowerCase().includes(normalizedQuery)
    )
  })
}

export async function getGlobalVocabulary({
  userId = 'default',
}: {
  userId?: string
} = {}): Promise<GlobalVocabularyResult> {
  const [notes, videoCaptionNotes] = await Promise.all([
    prisma.userNote.findMany({
      where: { userId },
      select: {
        words: true,
        updatedAt: true,
        sentence: {
          select: {
            id: true,
            order: true,
            text: true,
            trainingItem: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    prisma.videoCaptionNote.findMany({
      where: { userId },
      select: {
        words: true,
        updatedAt: true,
        caption: {
          select: {
            id: true,
            order: true,
            enText: true,
            videoTrainingItem: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
  ])

  const itemMap = new Map<string, MutableGlobalVocabularyItem>()
  const counters: GlobalVocabularyCounters = {
    totalOccurrences: 0,
    trainingItemIds: new Set<string>(),
    sentenceIds: new Set<string>(),
  }

  for (const note of notes) {
    const sentence = note.sentence
    const trainingItem = sentence.trainingItem

    addSourceEntriesToMap({
      itemMap,
      entries: parseStructuredEntries(note.words || ''),
      sourceRef: {
        kind: 'listening',
        trainingItemId: trainingItem.id,
        trainingTitle: trainingItem.title,
        sentenceId: sentence.id,
        sentenceOrder: sentence.order + 1,
        sentenceText: sentence.text,
      },
      updatedAt: note.updatedAt,
      counters,
    })
  }

  for (const note of videoCaptionNotes) {
    const caption = note.caption
    const trainingItem = caption.videoTrainingItem

    addSourceEntriesToMap({
      itemMap,
      entries: parseStructuredEntries(note.words || ''),
      sourceRef: {
        kind: 'video',
        trainingItemId: trainingItem.id,
        trainingTitle: trainingItem.title,
        sentenceId: caption.id,
        sentenceOrder: caption.order + 1,
        sentenceText: caption.enText,
      },
      updatedAt: note.updatedAt,
      counters,
    })
  }

  const items = Array.from(itemMap.values()).map((item) => ({
    headword: item.entry.headword,
    headwordKey: item.entry.headwordKey,
    label: formatVocabularyEntry(item.entry),
    senses: item.entry.senses,
    ...(item.entry.phonetic ? { phonetic: item.entry.phonetic } : {}),
    occurrenceCount: item.occurrenceCount,
    trainingItemCount: item.trainingItemIds.size,
    sentences: [...item.sentences].sort(sortSourceRefs),
    lastSeenAt: item.lastSeenAt.toISOString(),
  }))

  const generatedAt = new Date().toISOString()
  return {
    generatedAt,
    summary: {
      uniqueWords: items.length,
      totalOccurrences: counters.totalOccurrences,
      totalTrainingItems: counters.trainingItemIds.size,
      totalSentences: counters.sentenceIds.size,
    },
    items: sortGlobalVocabularyItems(items, 'frequency'),
  }
}

export function toMyqwertyExportWords(items: GlobalVocabularyItem[]) {
  return items.map((item) => {
    const trans = item.senses
      .map((sense) => `${sense.pos}${sense.meaning}`.trim())
      .filter(Boolean)

    const phone = sanitizePhone(item.phonetic)
    const notation = (item.phonetic || '').trim()

    return {
      name: item.headword,
      trans: Array.from(new Set(trans)),
      usphone: phone,
      ukphone: phone,
      ...(notation ? { notation } : {}),
    }
  })
}
