import { unstable_noStore as noStore } from 'next/cache'
import HomeModeShell from '@/components/HomeModeShell'
import HomeVideoTrainingGrid, { type HomeVideoTrainingCardItem } from '@/components/HomeVideoTrainingGrid'
import { isAdminRole } from '@/lib/auth-types'
import { getCurrentUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import type { HomeEntry } from '@/lib/home-entries'
import { VIDEO_TRAINING_TAGS } from '@/lib/video-training'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type VideoHomeEntry = Extract<HomeEntry, { kind: 'video' }>

interface VideoHomePageProps {
  searchParams: Promise<{
    tag?: string
  }>
}

function sortVideoTags(tags: string[]) {
  const knownOrder = new Map<string, number>(VIDEO_TRAINING_TAGS.map((tag, index) => [tag, index]))

  return [...tags].sort((left, right) => {
    const leftOrder = knownOrder.get(left)
    const rightOrder = knownOrder.get(right)

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder
    }

    if (leftOrder !== undefined) {
      return -1
    }

    if (rightOrder !== undefined) {
      return 1
    }

    return left.localeCompare(right, 'zh-CN')
  })
}

async function getVideoTrainingItems(requestedTag: string | null) {
  noStore()

  const allTags = await prisma.videoTrainingItem.findMany({
    select: {
      tag: true,
    },
  })

  const availableTags = sortVideoTags(Array.from(new Set(allTags.map((item) => item.tag).filter(Boolean))))
  const selectedTag = requestedTag && availableTags.includes(requestedTag) ? requestedTag : null

  const items = await prisma.videoTrainingItem.findMany({
    where: selectedTag ? { tag: selectedTag } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          captions: true,
        },
      },
    },
  })

  const entries = items.map((item) => ({
    kind: 'video',
    id: item.id,
    title: item.title,
    coverUrl: item.coverUrl,
    coverPositionX: item.coverPositionX,
    coverPositionY: item.coverPositionY,
    meta: {
      createdAt: item.createdAt.toISOString(),
      captionsCount: item._count.captions,
      tag: item.tag,
    },
  })) satisfies VideoHomeEntry[]

  return {
    availableTags,
    selectedTag,
    items: entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      coverUrl: entry.coverUrl,
      coverPositionX: entry.coverPositionX,
      coverPositionY: entry.coverPositionY,
      createdAt: entry.meta.createdAt,
      captionsCount: entry.meta.captionsCount,
      tag: entry.meta.tag,
    })) satisfies HomeVideoTrainingCardItem[],
  }
}

export default async function VideoHomePage({ searchParams }: VideoHomePageProps) {
  const params = await searchParams
  const requestedTag = typeof params.tag === 'string' ? params.tag.trim() : ''
  const [videoHomeData, user] = await Promise.all([getVideoTrainingItems(requestedTag || null), getCurrentUser()])
  const isAdmin = isAdminRole(user?.role)

  return (
    <div className="min-h-screen relative">
      <HomeModeShell mode="video" isAdmin={isAdmin}>
        <HomeVideoTrainingGrid
          items={videoHomeData.items}
          isAdmin={isAdmin}
          availableTags={videoHomeData.availableTags}
          selectedTag={videoHomeData.selectedTag}
        />
      </HomeModeShell>
    </div>
  )
}
