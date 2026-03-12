export interface DictationWordToken {
  type: 'word'
  displayText: string
  answerText: string
  maxLength: number
  wordIndex: number
}

export interface DictationSymbolToken {
  type: 'punctuation' | 'hyphen'
  value: string
}

export type DictationToken = DictationWordToken | DictationSymbolToken

export interface DictationSegment {
  tokens: DictationToken[]
}

export interface DictationSentenceModel {
  segments: DictationSegment[]
  words: DictationWordToken[]
}

export interface DictationCheckEntry {
  expected: string
  actual: string
  isCorrect: boolean
}

export interface DictationSentenceResult {
  correctCount: number
  totalCount: number
  entries: DictationCheckEntry[]
}

const APOSTROPHE_PATTERN = /['’]/g
const NON_INPUT_PATTERN = /[^a-zA-Z0-9]/g
const WORD_CHAR_PATTERN = /[a-zA-Z0-9'’]/
const HYPHEN_CHARS = new Set(['-'])

function isWordCharacter(char: string) {
  return WORD_CHAR_PATTERN.test(char)
}

function isHyphenCharacter(char: string) {
  return HYPHEN_CHARS.has(char)
}

function buildWordToken(rawWord: string, wordIndex: number): DictationWordToken | null {
  const answerText = rawWord.replace(APOSTROPHE_PATTERN, '')
  const normalizedAnswer = answerText.replace(NON_INPUT_PATTERN, '')

  if (!normalizedAnswer) {
    return null
  }

  return {
    type: 'word',
    displayText: rawWord,
    answerText: normalizedAnswer,
    maxLength: normalizedAnswer.length,
    wordIndex,
  }
}

function tokenizeSegment(segment: string, startingWordIndex: number) {
  const tokens: DictationToken[] = []
  let wordIndex = startingWordIndex
  let cursor = 0

  while (cursor < segment.length) {
    const char = segment[cursor]

    if (isWordCharacter(char)) {
      let nextCursor = cursor + 1

      while (nextCursor < segment.length && isWordCharacter(segment[nextCursor])) {
        nextCursor += 1
      }

      const rawWord = segment.slice(cursor, nextCursor)
      const wordToken = buildWordToken(rawWord, wordIndex)

      if (wordToken) {
        tokens.push(wordToken)
        wordIndex += 1
      } else {
        tokens.push({ type: 'punctuation', value: rawWord })
      }

      cursor = nextCursor
      continue
    }

    if (isHyphenCharacter(char)) {
      tokens.push({ type: 'hyphen', value: char })
      cursor += 1
      continue
    }

    tokens.push({ type: 'punctuation', value: char })
    cursor += 1
  }

  return { tokens, wordIndex }
}

export function buildDictationSentenceModel(text: string): DictationSentenceModel {
  const rawSegments = text.trim().split(/\s+/).filter(Boolean)
  const segments: DictationSegment[] = []
  const words: DictationWordToken[] = []
  let wordIndex = 0

  for (const rawSegment of rawSegments) {
    const tokenizedSegment = tokenizeSegment(rawSegment, wordIndex)
    segments.push({ tokens: tokenizedSegment.tokens })

    for (const token of tokenizedSegment.tokens) {
      if (token.type === 'word') {
        words.push(token)
      }
    }

    wordIndex = tokenizedSegment.wordIndex
  }

  return { segments, words }
}

export function sanitizeDictationInput(value: string) {
  return value.replace(NON_INPUT_PATTERN, '')
}

export function normalizeDictationValue(value: string) {
  return sanitizeDictationInput(value).toLowerCase()
}

export function createEmptyDictationInputs(model: DictationSentenceModel) {
  return model.words.map(() => '')
}

export function isDictationSentenceComplete(model: DictationSentenceModel, inputs: string[]) {
  return model.words.every((word) => normalizeDictationValue(inputs[word.wordIndex] || '').length === word.maxLength)
}

export function evaluateDictationSentence(
  model: DictationSentenceModel,
  inputs: string[],
): DictationSentenceResult {
  const entries = model.words.map((word) => {
    const actual = sanitizeDictationInput(inputs[word.wordIndex] || '')
    const isCorrect = normalizeDictationValue(actual) === normalizeDictationValue(word.answerText)

    return {
      expected: word.displayText,
      actual,
      isCorrect,
    }
  })

  return {
    correctCount: entries.filter((entry) => entry.isCorrect).length,
    totalCount: model.words.length,
    entries,
  }
}
