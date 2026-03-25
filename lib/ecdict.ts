import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { normalizeVocabularyPos, type VocabularyFormSenseDraft } from './vocabulary'

const ECDICT_DATA_DIR = path.join(process.cwd(), 'data')
const ECDICT_CSV_PATH = path.join(ECDICT_DATA_DIR, 'ecdict.source.csv')
const ECDICT_DB_PATH = path.join(ECDICT_DATA_DIR, 'ecdict.sqlite')
const ECDICT_BUILD_STAMP = 'ecdict-v1'
const ECDICT_SUGGESTION_LIMIT = 8
const MEANING_SEPARATOR = '\uFF1B'

interface DictionaryRow {
  word: string
  phonetic: string
  translation: string
  pos: string
}

export interface ECDICTSuggestion {
  word: string
  phonetic: string
  translationPreview: string
}

export interface ECDICTAutofillEntry {
  word: string
  phonetic: string
  senses: VocabularyFormSenseDraft[]
}

let cachedDb: Database.Database | null = null

const POS_FALLBACK_ORDER = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'phr.'] as const

const POS_ALIASES: Record<string, string> = {
  n: 'n.',
  noun: 'n.',
  c: 'n.',
  u: 'n.',
  v: 'v.',
  vt: 'v.',
  vi: 'v.',
  verb: 'v.',
  aux: 'v.',
  modal: 'v.',
  a: 'adj.',
  adj: 'adj.',
  adjective: 'adj.',
  s: 'adj.',
  adv: 'adv.',
  ad: 'adv.',
  adverb: 'adv.',
  prep: 'prep.',
  preposition: 'prep.',
  pron: 'pron.',
  pronoun: 'pron.',
  conj: 'conj.',
  conjunction: 'conj.',
  phr: 'phr.',
  phrase: 'phr.',
  phrasal: 'phr.',
  int: 'phr.',
  interj: 'phr.',
  abbr: 'phr.',
}

function ensureDataDirectory() {
  fs.mkdirSync(ECDICT_DATA_DIR, { recursive: true })
}

function stripSearchWord(word: string) {
  return Array.from(word)
    .filter((character) => /[a-z0-9]/i.test(character))
    .join('')
    .toLowerCase()
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeTranslationSource(value: string) {
  return value.replace(/\\n/g, '\n')
}

function normalizePhonetic(value: string) {
  const cleaned = normalizeWhitespace(value)

  if (!cleaned) {
    return ''
  }

  if (
    (cleaned.startsWith('/') && cleaned.endsWith('/')) ||
    (cleaned.startsWith('[') && cleaned.endsWith(']'))
  ) {
    return cleaned
  }

  return `/${cleaned}/`
}

function previewTranslation(value: string) {
  const cleaned = normalizeWhitespace(
    normalizeTranslationSource(value).replace(/\r?\n+/g, MEANING_SEPARATOR)
  )

  if (cleaned.length <= 72) {
    return cleaned
  }

  return `${cleaned.slice(0, 69)}...`
}

function mapECDICTPos(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z]/g, '')
  return POS_ALIASES[cleaned] || ''
}

function extractPosCandidates(posField: string) {
  const candidates: string[] = []

  for (const segment of posField.split('/')) {
    const pos = mapECDICTPos(segment.split(':')[0] || '')

    if (!pos || candidates.includes(pos)) {
      continue
    }

    candidates.push(pos)
  }

  return candidates
}

function buildFallbackSense(translation: string, posField: string): VocabularyFormSenseDraft[] {
  const normalizedMeaning = normalizeWhitespace(
    normalizeTranslationSource(translation)
      .replace(/\r?\n+/g, MEANING_SEPARATOR)
      .replace(/\s*[;；]\s*/g, MEANING_SEPARATOR)
      .replace(/^\[.*?\]\s*/, '')
  )

  if (!normalizedMeaning) {
    return []
  }

  const posCandidates = extractPosCandidates(posField)
  const pos = posCandidates[0] || 'phr.'

  return [{
    pos: normalizeVocabularyPos(pos),
    meaning: normalizedMeaning,
  }]
}

function mergeSenseBuckets(buckets: Map<string, string[]>, pos: string, meaning: string) {
  const normalizedPos = normalizeVocabularyPos(pos)
  const normalizedMeaning = normalizeWhitespace(meaning.replace(/^\[.*?\]\s*/, ''))

  if (!normalizedPos || !normalizedMeaning) {
    return
  }

  const current = buckets.get(normalizedPos) || []
  if (!current.includes(normalizedMeaning)) {
    current.push(normalizedMeaning)
  }
  buckets.set(normalizedPos, current)
}

function parseTranslationToSenses(translation: string, posField: string) {
  const lines = normalizeTranslationSource(translation)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const buckets = new Map<string, string[]>()
  const fallbackLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^([a-z]{1,8})\.\s*(.+)$/i)

    if (!match) {
      fallbackLines.push(line)
      continue
    }

    const mappedPos = mapECDICTPos(match[1])

    if (!mappedPos) {
      fallbackLines.push(line)
      continue
    }

    mergeSenseBuckets(buckets, mappedPos, match[2])
  }

  if (buckets.size === 0) {
    return buildFallbackSense(translation, posField)
  }

  if (fallbackLines.length > 0) {
    const fallbackSense = buildFallbackSense(fallbackLines.join(MEANING_SEPARATOR), posField)[0]
    if (fallbackSense) {
      mergeSenseBuckets(buckets, fallbackSense.pos, fallbackSense.meaning)
    }
  }

  const ordered: VocabularyFormSenseDraft[] = []

  for (const pos of POS_FALLBACK_ORDER) {
    const meanings = buckets.get(pos)
    if (!meanings || meanings.length === 0) {
      continue
    }

    ordered.push({
      pos,
      meaning: meanings.join(MEANING_SEPARATOR),
    })
  }

  for (const [pos, meanings] of buckets.entries()) {
    if (ordered.some((sense) => sense.pos === pos) || meanings.length === 0) {
      continue
    }

    ordered.push({
      pos,
      meaning: meanings.join(MEANING_SEPARATOR),
    })
  }

  return ordered.slice(0, 6)
}

function parseCSV(content: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]

    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && content[index + 1] === '\n') {
        index += 1
      }

      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += character
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function buildDatabase() {
  if (!fs.existsSync(ECDICT_CSV_PATH)) {
    throw new Error(`ECDICT CSV not found at ${ECDICT_CSV_PATH}`)
  }

  ensureDataDirectory()

  const tempDbPath = `${ECDICT_DB_PATH}.tmp`
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath)
  }

  const csvContent = fs.readFileSync(ECDICT_CSV_PATH, 'utf8')
  const rows = parseCSV(csvContent)
  const db = new Database(tempDbPath)

  try {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')

    db.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE entries (
        word TEXT PRIMARY KEY,
        search_word TEXT NOT NULL,
        phonetic TEXT NOT NULL DEFAULT '',
        translation TEXT NOT NULL DEFAULT '',
        pos TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX idx_entries_search_word ON entries(search_word);
    `)

    const insert = db.prepare(`
      INSERT OR REPLACE INTO entries (
        word,
        search_word,
        phonetic,
        translation,
        pos
      ) VALUES (
        @word,
        @search_word,
        @phonetic,
        @translation,
        @pos
      )
    `)

    const insertMany = db.transaction((records: DictionaryRow[]) => {
      for (const record of records) {
        insert.run({
          word: record.word,
          search_word: stripSearchWord(record.word),
          phonetic: record.phonetic,
          translation: record.translation,
          pos: record.pos,
        })
      }
    })

    const [, ...dataRows] = rows
    const records: DictionaryRow[] = []

    for (const row of dataRows) {
      const word = normalizeWhitespace(row[0] || '')

      if (!word) {
        continue
      }

      records.push({
        word,
        phonetic: normalizeWhitespace(row[1] || ''),
        translation: (row[3] || '').trim(),
        pos: normalizeWhitespace(row[4] || ''),
      })
    }

    insertMany(records)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('build_stamp', ECDICT_BUILD_STAMP)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('source_csv', path.basename(ECDICT_CSV_PATH))
  } catch (error) {
    db.close()
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath)
    }
    throw error
  }

  db.close()

  if (fs.existsSync(ECDICT_DB_PATH)) {
    fs.unlinkSync(ECDICT_DB_PATH)
  }

  fs.renameSync(tempDbPath, ECDICT_DB_PATH)
}

function needsDatabaseRebuild() {
  if (!fs.existsSync(ECDICT_DB_PATH)) {
    return true
  }

  try {
    const db = new Database(ECDICT_DB_PATH, { readonly: true })
    const buildStamp = db.prepare('SELECT value FROM meta WHERE key = ?').pluck().get('build_stamp') as string | undefined
    db.close()

    if (buildStamp !== ECDICT_BUILD_STAMP) {
      return true
    }
  } catch {
    return true
  }

  const dbStat = fs.statSync(ECDICT_DB_PATH)
  const csvStat = fs.statSync(ECDICT_CSV_PATH)
  return dbStat.mtimeMs < csvStat.mtimeMs
}

function getDatabase() {
  ensureDataDirectory()

  if (!fs.existsSync(ECDICT_CSV_PATH)) {
    throw new Error(`ECDICT CSV not found at ${ECDICT_CSV_PATH}`)
  }

  if (needsDatabaseRebuild()) {
    buildDatabase()
  }

  if (!cachedDb) {
    cachedDb = new Database(ECDICT_DB_PATH, { readonly: true })
  }

  return cachedDb
}

export function getECDICTSuggestions(query: string, limit = ECDICT_SUGGESTION_LIMIT) {
  const normalizedQuery = stripSearchWord(query)

  if (!normalizedQuery) {
    return []
  }

  const db = getDatabase()
  const statement = db.prepare(`
    SELECT word, phonetic, translation
    FROM entries
    WHERE search_word LIKE @prefix
    ORDER BY
      CASE
        WHEN lower(word) = @queryLower THEN 0
        WHEN word LIKE @queryPrefix THEN 1
        ELSE 2
      END,
      length(word) ASC,
      word ASC
    LIMIT @limit
  `)

  const rows = statement.all({
    prefix: `${normalizedQuery}%`,
    queryLower: query.trim().toLowerCase(),
    queryPrefix: `${query.trim()}%`,
    limit,
  }) as Array<{ word: string; phonetic: string; translation: string }>

  return rows.map((row) => ({
    word: row.word,
    phonetic: normalizePhonetic(row.phonetic),
    translationPreview: previewTranslation(row.translation),
  }))
}

export function getECDICTEntry(word: string): ECDICTAutofillEntry | null {
  const normalizedWord = normalizeWhitespace(word)
  const strippedWord = stripSearchWord(word)

  if (!normalizedWord || !strippedWord) {
    return null
  }

  const db = getDatabase()
  const statement = db.prepare(`
    SELECT word, phonetic, translation, pos
    FROM entries
    WHERE lower(word) = @queryLower OR search_word = @searchWord
    ORDER BY
      CASE
        WHEN lower(word) = @queryLower THEN 0
        ELSE 1
      END,
      length(word) ASC,
      word ASC
    LIMIT 1
  `)

  const row = statement.get({
    queryLower: normalizedWord.toLowerCase(),
    searchWord: strippedWord,
  }) as { word: string; phonetic: string; translation: string; pos: string } | undefined

  if (!row) {
    return null
  }

  return {
    word: row.word,
    phonetic: normalizePhonetic(row.phonetic),
    senses: parseTranslationToSenses(row.translation, row.pos),
  }
}
