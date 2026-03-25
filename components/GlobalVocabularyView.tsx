'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type GlobalVocabularyItem, type GlobalVocabularySummary } from '@/lib/global-vocabulary.types'

type SortOption = 'frequency' | 'alphabet' | 'recent'

interface GlobalVocabularyViewProps {
  generatedAt: string
  summary: GlobalVocabularySummary
  items: GlobalVocabularyItem[]
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sortItems(items: GlobalVocabularyItem[], sort: SortOption) {
  const next = [...items]

  if (sort === 'alphabet') {
    next.sort((left, right) => left.headword.localeCompare(right.headword, 'en', { sensitivity: 'base' }))
    return next
  }

  if (sort === 'recent') {
    next.sort((left, right) => {
      const delta = new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime()
      if (delta !== 0) {
        return delta
      }
      return left.headword.localeCompare(right.headword, 'en', { sensitivity: 'base' })
    })
    return next
  }

  next.sort((left, right) => {
    const countDelta = right.occurrenceCount - left.occurrenceCount
    if (countDelta !== 0) {
      return countDelta
    }
    return left.headword.localeCompare(right.headword, 'en', { sensitivity: 'base' })
  })
  return next
}

function filterItems(items: GlobalVocabularyItem[], query: string) {
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

export default function GlobalVocabularyView({ generatedAt, summary, items }: GlobalVocabularyViewProps) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('frequency')
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

  const filteredItems = useMemo(() => {
    const filtered = filterItems(items, query)
    return sortItems(filtered, sort)
  }, [items, query, sort])

  const filteredOccurrenceCount = useMemo(
    () => filteredItems.reduce((total, item) => total + item.occurrenceCount, 0),
    [filteredItems]
  )

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-cyan-500/25 bg-black/40 p-4 shadow-[0_0_18px_rgba(0,255,255,0.12)] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-400/80">[ GLOBAL VOCABULARY ]</div>
            <h1 className="mt-2 font-mono text-2xl text-cyan-100 drop-shadow-[0_0_10px_rgba(0,255,255,0.25)]">
              GLOBAL VOCAB LIBRARY
            </h1>
            <p className="mt-2 font-mono text-xs text-cyan-200/65">
              Last generated: {formatDateTime(generatedAt)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] text-cyan-300/70">UNIQUE</div>
              <div className="font-mono text-lg text-cyan-100">{summary.uniqueWords}</div>
            </div>
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] text-cyan-300/70">OCCURRENCES</div>
              <div className="font-mono text-lg text-cyan-100">{summary.totalOccurrences}</div>
            </div>
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] text-cyan-300/70">TRAININGS</div>
              <div className="font-mono text-lg text-cyan-100">{summary.totalTrainingItems}</div>
            </div>
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] text-cyan-300/70">SENTENCES</div>
              <div className="font-mono text-lg text-cyan-100">{summary.totalSentences}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-black/35 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by word / meaning / training title..."
            className="flex-1 rounded-md border border-cyan-500/30 bg-black/45 px-3 py-2 font-mono text-sm text-cyan-100 outline-none transition-colors placeholder:text-cyan-300/45 focus:border-cyan-400/60"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-md border border-cyan-500/30 bg-black/45 px-3 py-2 font-mono text-sm text-cyan-100 outline-none transition-colors focus:border-cyan-400/60"
          >
            <option value="frequency">Sort: Frequency</option>
            <option value="alphabet">Sort: Alphabet</option>
            <option value="recent">Sort: Recent</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-xs text-cyan-200/70">
          <span>{filteredItems.length} words matched</span>
          <span>{filteredOccurrenceCount} occurrences in matched result</span>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-cyan-500/18 bg-black/30 px-4 py-8 text-center font-mono text-sm text-cyan-200/70">
          No vocabulary matched your current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const isExpanded = Boolean(expandedKeys[item.headwordKey])
            return (
              <div
                key={item.headwordKey}
                className="rounded-lg border border-cyan-500/20 bg-black/38 p-4 transition-colors hover:border-cyan-400/35"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-cyan-500/25 px-2 py-0.5 font-mono text-[10px] text-cyan-300/75">
                        #{String(index + 1).padStart(3, '0')}
                      </span>
                      <span className="font-mono text-xl text-cyan-100">{item.headword}</span>
                      {item.phonetic && (
                        <span className="font-mono text-xs text-cyan-300/75">{item.phonetic}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.senses.map((sense, senseIndex) => (
                        <span
                          key={`${item.headwordKey}-sense-${senseIndex}`}
                          className="rounded border border-green-500/20 bg-green-500/[0.08] px-2 py-1 font-mono text-xs text-green-200/90"
                        >
                          {sense.pos}
                          {sense.meaning}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-start">
                    <div className="rounded border border-cyan-500/25 bg-cyan-500/[0.06] px-2 py-1 font-mono text-xs text-cyan-100/90">
                      {item.occurrenceCount} OCC
                    </div>
                    <div className="rounded border border-cyan-500/25 bg-cyan-500/[0.06] px-2 py-1 font-mono text-xs text-cyan-100/90">
                      {item.trainingItemCount} DOCS
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedKeys((prev) => ({
                          ...prev,
                          [item.headwordKey]: !prev[item.headwordKey],
                        }))
                      }
                      className="rounded border border-cyan-500/28 px-2 py-1 font-mono text-xs text-cyan-200/85 transition-colors hover:border-cyan-400/55 hover:text-cyan-100"
                    >
                      {isExpanded ? 'HIDE' : 'DETAIL'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-cyan-300/60">
                  <span>{item.label}</span>
                  <span>Updated: {formatDateTime(item.lastSeenAt)}</span>
                </div>

                {isExpanded && (
                  <div className="mt-3 rounded-md border border-cyan-500/18 bg-black/32 p-3">
                    <div className="mb-2 font-mono text-[11px] text-cyan-300/75">SOURCE SENTENCES</div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {item.sentences.map((source) => (
                        <Link
                          key={`${item.headwordKey}-${source.sentenceId}`}
                          href={`/training/${source.trainingItemId}`}
                          className="block rounded border border-cyan-500/16 bg-cyan-500/[0.03] px-3 py-2 transition-colors hover:border-cyan-400/38"
                        >
                          <div className="font-mono text-xs text-cyan-200/90">
                            {source.trainingTitle} | S{source.sentenceOrder}
                          </div>
                          <div className="mt-1 font-mono text-xs text-cyan-100/72">{source.sentenceText}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
