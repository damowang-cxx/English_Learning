const LEGACY_LINE_SPLIT_PATTERN = /\r?\n+/
const LEGACY_SENSE_SPLIT_PATTERN = /[；;]+/
const LEGACY_NUMBER_PREFIX_PATTERN = /^\s*\d+\s*[.)、．]\s*/
const POS_MEANING_PATTERN = /^([a-zA-Z]+)\s*[.．]\s*(.+)$/

export interface VocabularySense {
  pos: string
  meaning: string
}

export interface VocabularyEntry {
  headword: string
  headwordKey: string
  senses: VocabularySense[]
  rawText?: string
  isLegacyInvalid?: boolean
}

export interface VocabularyFormSenseDraft {
  pos: string
  meaning: string
}

export interface VocabularyFormState {
  headword: string
  senses: VocabularyFormSenseDraft[]
}

export interface SentenceVocabularySnapshot {
  items: VocabularyEntry[]
}

export interface VocabularyBookSentenceRef {
  sentenceId: string
  sentenceOrder: number
  sentenceText: string
}

export interface VocabularyBookItem {
  headword: string
  label: string
  normalizedKey: string
  senses: VocabularySense[]
  count: number
  sentences: VocabularyBookSentenceRef[]
}

function normalizeSpacing(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function stripLegacyNumberPrefix(value: string) {
  return value.replace(LEGACY_NUMBER_PREFIX_PATTERN, '').trim()
}

function normalizeHeadwordLabel(value: string) {
  return normalizeSpacing(value).toLocaleLowerCase()
}

export function normalizeVocabularyKey(value: string) {
  return normalizeHeadwordLabel(value)
}

export function normalizeVocabularyPos(value: string) {
  const cleaned = normalizeSpacing(value)
    .replace(/[：:;；,.．。]+$/g, '')
    .toLocaleLowerCase()

  if (!cleaned) {
    return ''
  }

  return `${cleaned}.`
}

export function normalizeVocabularyMeaning(value: string) {
  return normalizeSpacing(value)
}

export function createEmptyVocabularySenseDraft(): VocabularyFormSenseDraft {
  return {
    pos: '',
    meaning: '',
  }
}

export function createEmptyVocabularyFormState(): VocabularyFormState {
  return {
    headword: '',
    senses: [createEmptyVocabularySenseDraft()],
  }
}

function normalizeVocabularySense(sense: VocabularySense) {
  const pos = normalizeVocabularyPos(sense.pos)
  const meaning = normalizeVocabularyMeaning(sense.meaning)

  if (!pos || !meaning) {
    return null
  }

  return {
    pos,
    meaning,
  }
}

function getVocabularySenseKey(sense: VocabularySense) {
  return `${sense.pos}${sense.meaning}`
}

function dedupeVocabularySenses(senses: VocabularySense[]) {
  const deduped: VocabularySense[] = []
  const seen = new Set<string>()

  for (const sense of senses) {
    const normalizedSense = normalizeVocabularySense(sense)

    if (!normalizedSense) {
      continue
    }

    const senseKey = getVocabularySenseKey(normalizedSense)
    if (seen.has(senseKey)) {
      continue
    }

    seen.add(senseKey)
    deduped.push(normalizedSense)
  }

  return deduped
}

function createLegacyVocabularyEntry(rawText: string): VocabularyEntry {
  const normalizedRawText = stripLegacyNumberPrefix(rawText)

  return {
    headword: normalizedRawText,
    headwordKey: `legacy:${normalizeSpacing(normalizedRawText).toLocaleLowerCase()}`,
    senses: [],
    rawText: normalizedRawText,
    isLegacyInvalid: true,
  }
}

function normalizeVocabularyEntry(entry: VocabularyEntry) {
  if (entry.isLegacyInvalid || entry.rawText) {
    const rawText = stripLegacyNumberPrefix(entry.rawText || entry.headword)
    if (!rawText) {
      return null
    }

    return createLegacyVocabularyEntry(rawText)
  }

  const headword = normalizeHeadwordLabel(entry.headword)
  const senses = dedupeVocabularySenses(entry.senses || [])

  if (!headword || senses.length === 0) {
    return null
  }

  return {
    headword,
    headwordKey: normalizeVocabularyKey(headword),
    senses,
  }
}

function parseVocabularySenseBlock(value: string) {
  const cleaned = normalizeSpacing(value)
  if (!cleaned) {
    return null
  }

  const match = cleaned.match(POS_MEANING_PATTERN)
  if (!match) {
    return null
  }

  const pos = normalizeVocabularyPos(match[1])
  const meaning = normalizeVocabularyMeaning(match[2])

  if (!pos || !meaning) {
    return null
  }

  return {
    pos,
    meaning,
  }
}

function parseStructuredVocabularyEntry(value: string) {
  const cleaned = stripLegacyNumberPrefix(value)
  const separatorIndex = cleaned.search(/[:：]/)

  if (separatorIndex <= 0) {
    return null
  }

  const headword = normalizeHeadwordLabel(cleaned.slice(0, separatorIndex))
  const sensesText = cleaned.slice(separatorIndex + 1).trim()

  if (!headword || !sensesText) {
    return null
  }

  const senses = dedupeVocabularySenses(
    sensesText
      .split(LEGACY_SENSE_SPLIT_PATTERN)
      .map(parseVocabularySenseBlock)
      .filter((sense): sense is VocabularySense => Boolean(sense))
  )

  if (senses.length === 0) {
    return null
  }

  return {
    headword,
    headwordKey: normalizeVocabularyKey(headword),
    senses,
  }
}

function parseLegacyVocabularyEntry(value: string) {
  const structuredEntry = parseStructuredVocabularyEntry(value)
  if (structuredEntry) {
    return structuredEntry
  }

  return createLegacyVocabularyEntry(value)
}

function normalizeVocabularyEntryFromUnknown(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>

  if (record.isLegacyInvalid || typeof record.rawText === 'string') {
    return createLegacyVocabularyEntry(String(record.rawText || record.headword || ''))
  }

  if (typeof record.headword !== 'string' || !Array.isArray(record.senses)) {
    return null
  }

  const senses = record.senses
    .map((sense) => {
      if (!sense || typeof sense !== 'object') {
        return null
      }

      const senseRecord = sense as Record<string, unknown>
      if (typeof senseRecord.pos !== 'string' || typeof senseRecord.meaning !== 'string') {
        return null
      }

      return {
        pos: senseRecord.pos,
        meaning: senseRecord.meaning,
      }
    })
    .filter((sense): sense is VocabularySense => Boolean(sense))

  return normalizeVocabularyEntry({
    headword: record.headword,
    headwordKey: typeof record.headwordKey === 'string' ? record.headwordKey : normalizeVocabularyKey(record.headword),
    senses,
  })
}

export function getVocabularyEntryKey(entry: VocabularyEntry) {
  return entry.headwordKey
}

export function isVocabularyEntryStructured(entry: VocabularyEntry) {
  return !entry.isLegacyInvalid && entry.senses.length > 0
}

export function formatVocabularyEntry(entry: VocabularyEntry) {
  if (!isVocabularyEntryStructured(entry)) {
    return entry.rawText || entry.headword
  }

  return `${entry.headword}:${entry.senses.map((sense) => `${sense.pos}${sense.meaning}`).join('；')}`
}

export function mergeVocabularyWords(existing: VocabularyEntry[], incoming: VocabularyEntry[]) {
  const mergedEntries: VocabularyEntry[] = []
  const structuredEntryIndex = new Map<string, number>()
  const legacyEntryKeys = new Set<string>()

  for (const sourceEntry of [...existing, ...incoming]) {
    const normalizedEntry = normalizeVocabularyEntry(sourceEntry)

    if (!normalizedEntry) {
      continue
    }

    if (!isVocabularyEntryStructured(normalizedEntry)) {
      const legacyKey = getVocabularyEntryKey(normalizedEntry)
      if (legacyEntryKeys.has(legacyKey)) {
        continue
      }

      legacyEntryKeys.add(legacyKey)
      mergedEntries.push(normalizedEntry)
      continue
    }

    const existingIndex = structuredEntryIndex.get(normalizedEntry.headwordKey)

    if (existingIndex === undefined) {
      structuredEntryIndex.set(normalizedEntry.headwordKey, mergedEntries.length)
      mergedEntries.push(normalizedEntry)
      continue
    }

    const currentEntry = mergedEntries[existingIndex]
    mergedEntries[existingIndex] = {
      ...currentEntry,
      senses: dedupeVocabularySenses([...currentEntry.senses, ...normalizedEntry.senses]),
    }
  }

  return mergedEntries
}

export function parseVocabularyWords(value: string) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (Array.isArray(parsed)) {
      const parsedEntries = parsed
        .map((item) => {
          if (typeof item === 'string') {
            return parseLegacyVocabularyEntry(item)
          }

          return normalizeVocabularyEntryFromUnknown(item)
        })
        .filter((item): item is VocabularyEntry => Boolean(item))

      return mergeVocabularyWords([], parsedEntries)
    }
  } catch {
    // Fall through to legacy plain-text parsing.
  }

  const legacyEntries = value
    .split(LEGACY_LINE_SPLIT_PATTERN)
    .map(parseLegacyVocabularyEntry)

  return mergeVocabularyWords([], legacyEntries)
}

function serializeVocabularyEntry(entry: VocabularyEntry) {
  if (!isVocabularyEntryStructured(entry)) {
    return {
      rawText: entry.rawText || entry.headword,
      isLegacyInvalid: true,
    }
  }

  return {
    headword: entry.headword,
    headwordKey: entry.headwordKey,
    senses: entry.senses.map((sense) => ({
      pos: sense.pos,
      meaning: sense.meaning,
    })),
  }
}

export function serializeVocabularyWords(words: VocabularyEntry[]) {
  return JSON.stringify(mergeVocabularyWords([], words).map(serializeVocabularyEntry))
}

export function areVocabularyListsEqual(left: VocabularyEntry[], right: VocabularyEntry[]) {
  return serializeVocabularyWords(left) === serializeVocabularyWords(right)
}

export function buildVocabularyEntryFromForm(form: VocabularyFormState) {
  if (!isVocabularyFormSubmittable(form)) {
    return null
  }

  const headword = normalizeHeadwordLabel(form.headword)
  const senses = dedupeVocabularySenses(
    form.senses
      .map((sense) => normalizeVocabularySense({ pos: sense.pos, meaning: sense.meaning }))
      .filter((sense): sense is VocabularySense => Boolean(sense))
  )

  if (!headword || senses.length === 0) {
    return null
  }

  return {
    headword,
    headwordKey: normalizeVocabularyKey(headword),
    senses,
  }
}

export function isVocabularyFormSubmittable(form: VocabularyFormState) {
  const headword = normalizeHeadwordLabel(form.headword)

  if (!headword) {
    return false
  }

  let hasCompleteSense = false

  for (const sense of form.senses) {
    const normalizedPos = normalizeVocabularyPos(sense.pos)
    const normalizedMeaning = normalizeVocabularyMeaning(sense.meaning)

    if (!normalizedPos && !normalizedMeaning) {
      continue
    }

    if (!normalizedPos || !normalizedMeaning) {
      return false
    }

    hasCompleteSense = true
  }

  return hasCompleteSense
}

export function buildVocabularyBook(
  sentences: Array<{ id: string; order: number; text: string }>,
  vocabularyBySentence: Record<string, SentenceVocabularySnapshot | undefined>
) {
  const bookItems: VocabularyBookItem[] = []
  const itemMap = new Map<string, VocabularyBookItem>()

  for (const sentence of [...sentences].sort((left, right) => left.order - right.order)) {
    const items = vocabularyBySentence[sentence.id]?.items || []

    for (const item of items) {
      const label = formatVocabularyEntry(item).trim()

      if (!label) {
        continue
      }

      const itemKey = isVocabularyEntryStructured(item)
        ? item.headwordKey
        : getVocabularyEntryKey(item)

      let vocabularyBookItem = itemMap.get(itemKey)

      if (!vocabularyBookItem) {
        vocabularyBookItem = {
          headword: item.headword,
          label,
          normalizedKey: itemKey,
          senses: [...item.senses],
          count: 0,
          sentences: [],
        }
        itemMap.set(itemKey, vocabularyBookItem)
        bookItems.push(vocabularyBookItem)
      } else if (isVocabularyEntryStructured(item)) {
        vocabularyBookItem.senses = dedupeVocabularySenses([...vocabularyBookItem.senses, ...item.senses])
        vocabularyBookItem.label = formatVocabularyEntry({
          headword: vocabularyBookItem.headword,
          headwordKey: vocabularyBookItem.normalizedKey,
          senses: vocabularyBookItem.senses,
        })
      }

      vocabularyBookItem.count += 1

      if (!vocabularyBookItem.sentences.some((source) => source.sentenceId === sentence.id)) {
        vocabularyBookItem.sentences.push({
          sentenceId: sentence.id,
          sentenceOrder: sentence.order + 1,
          sentenceText: sentence.text,
        })
      }
    }
  }

  return bookItems
}
