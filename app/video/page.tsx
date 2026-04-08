import { unstable_noStore as noStore } from 'next/cache'
import HomeModeShell from '@/components/HomeModeShell'
import HomeVideoTrainingGrid, { type HomeVideoTrainingCardItem } from '@/components/HomeVideoTrainingGrid'
import { prisma } from '@/lib/prisma'
import type { HomeEntry } from '@/lib/home-entries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type VideoHomeEntry = Extract<HomeEntry, { kind: 'video' }>

async function getVideoTrainingItems() {
  noStore()

  const items = await prisma.videoTrainingItem.findMany({
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
    meta: {
      createdAt: item.createdAt.toISOString(),
      captionsCount: item._count.captions,
      tag: item.tag,
    },
  })) satisfies VideoHomeEntry[]

  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    coverUrl: entry.coverUrl,
    createdAt: entry.meta.createdAt,
    captionsCount: entry.meta.captionsCount,
    tag: entry.meta.tag,
  })) satisfies HomeVideoTrainingCardItem[]
}

export default async function VideoHomePage() {
  const items = await getVideoTrainingItems()

  return (
    <div className="min-h-screen relative">
      <HomeModeShell mode="video">
        <HomeVideoTrainingGrid items={items} />
      </HomeModeShell>
    </div>
  )
}
