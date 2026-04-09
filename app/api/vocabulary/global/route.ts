import { NextRequest, NextResponse } from 'next/server'
import {
  filterGlobalVocabularyItems,
  getGlobalVocabulary,
  sortGlobalVocabularyItems,
} from '@/lib/global-vocabulary'
import { requireApiUser } from '@/lib/authz'
import type { GlobalVocabularySort } from '@/lib/global-vocabulary.types'

const SUPPORTED_SORTS: GlobalVocabularySort[] = ['frequency', 'alphabet', 'recent']
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

function normalizeSort(value: string | null): GlobalVocabularySort {
  if (!value) {
    return 'frequency'
  }

  return SUPPORTED_SORTS.includes(value as GlobalVocabularySort) ? (value as GlobalVocabularySort) : 'frequency'
}

export async function GET(request: NextRequest) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  try {
    const userId = guard.user.id
    const query = request.nextUrl.searchParams.get('q') || ''
    const sort = normalizeSort(request.nextUrl.searchParams.get('sort'))

    const result = await getGlobalVocabulary({ userId })
    const filtered = filterGlobalVocabularyItems(result.items, query)
    const items = sortGlobalVocabularyItems(filtered, sort)

    return NextResponse.json(
      {
        generatedAt: result.generatedAt,
        summary: result.summary,
        filteredCount: items.length,
        query: {
          q: query,
          sort,
        },
        items,
      },
      {
        headers: CORS_HEADERS,
      }
    )
  } catch (error) {
    console.error('Global vocabulary API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch global vocabulary.' },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    )
  }
}
