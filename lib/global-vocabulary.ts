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
} from '@/lib/global-vocabulary.types'

interface MutableGlobalVocabularyItem {
  entry: VocabularyEntry
  occurrenceCount: number
  lastSeenAt: Date
  sentences: GlobalVocabularySentenceRef[]
  sentenceIds: Set<string>
  trainingItemIds: Set<string>
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
    return item.sentences.some((sentence) => sentence.trainingTitle.toLowerCase().includes(normalizedQuery))
  })
}

export async function getGlobalVocabulary({
  userId = 'default',
}: {
  userId?: string
} = {}): Promise<GlobalVocabularyResult> {
  const notes = await prisma.userNote.findMany({
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
  })

  const itemMap = new Map<string, MutableGlobalVocabularyItem>()
  const trainingItemIds = new Set<string>()
  const sentenceIds = new Set<string>()
  let totalOccurrences = 0

  for (const note of notes) {
    const sentence = note.sentence
    const trainingItem = sentence.trainingItem

    const structuredEntries = mergeVocabularyWords([], parseVocabularyWords(note.words || '')).filter(
      isVocabularyEntryStructured
    )

    if (structuredEntries.length === 0) {
      continue
    }

    trainingItemIds.add(trainingItem.id)
    sentenceIds.add(sentence.id)

    for (const entry of structuredEntries) {
      const key = getVocabularyEntryKey(entry)
      const existing = itemMap.get(key)
      const sentenceRef: GlobalVocabularySentenceRef = {
        trainingItemId: trainingItem.id,
        trainingTitle: trainingItem.title,
        sentenceId: sentence.id,
        sentenceOrder: sentence.order + 1,
        sentenceText: sentence.text,
      }

      totalOccurrences += 1

      if (!existing) {
        itemMap.set(key, {
          entry,
          occurrenceCount: 1,
          lastSeenAt: note.updatedAt,
          sentences: [sentenceRef],
          sentenceIds: new Set([sentence.id]),
          trainingItemIds: new Set([trainingItem.id]),
        })
        continue
      }

      const mergedEntry = mergeVocabularyWords([existing.entry], [entry]).find(isVocabularyEntryStructured)
      if (mergedEntry) {
        existing.entry = mergedEntry
      }

      existing.occurrenceCount += 1
      if (note.updatedAt.getTime() > existing.lastSeenAt.getTime()) {
        existing.lastSeenAt = note.updatedAt
      }

      if (!existing.sentenceIds.has(sentence.id)) {
        existing.sentenceIds.add(sentence.id)
        existing.sentences.push(sentenceRef)
      }
      existing.trainingItemIds.add(trainingItem.id)
    }
  }

  const items = Array.from(itemMap.values()).map((item) => ({
    headword: item.entry.headword,
    headwordKey: item.entry.headwordKey,
    label: formatVocabularyEntry(item.entry),
    senses: item.entry.senses,
    ...(item.entry.phonetic ? { phonetic: item.entry.phonetic } : {}),
    occurrenceCount: item.occurrenceCount,
    trainingItemCount: item.trainingItemIds.size,
    sentences: [...item.sentences].sort((left, right) => {
      if (left.trainingItemId !== right.trainingItemId) {
        return compareAlphabetically(left.trainingTitle, right.trainingTitle)
      }
      return left.sentenceOrder - right.sentenceOrder
    }),
    lastSeenAt: item.lastSeenAt.toISOString(),
  }))

  const generatedAt = new Date().toISOString()
  return {
    generatedAt,
    summary: {
      uniqueWords: items.length,
      totalOccurrences,
      totalTrainingItems: trainingItemIds.size,
      totalSentences: sentenceIds.size,
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
