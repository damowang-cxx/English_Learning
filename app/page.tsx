import { unstable_noStore as noStore } from 'next/cache'
import HomeModeShell from '@/components/HomeModeShell'
import HomeTrainingGrid, { type HomeTrainingCardItem } from '@/components/HomeTrainingGrid'
import { isAdminRole } from '@/lib/auth-types'
import { getCurrentUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import type { HomeEntry } from '@/lib/home-entries'

type ListeningHomeEntry = Extract<HomeEntry, { kind: 'listening' }>

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getTrainingItems() {
  noStore()

  const items = await prisma.trainingItem.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      sentences: true,
    },
  })

  const entries = items.map((item) => ({
    kind: 'listening',
    id: item.id,
    title: item.title,
    meta: {
      createdAt: item.createdAt.toISOString(),
      sentencesCount: item.sentences.length,
    },
  })) satisfies ListeningHomeEntry[]

  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    createdAt: entry.meta.createdAt,
    sentencesCount: entry.meta.sentencesCount,
  })) satisfies HomeTrainingCardItem[]
}

export default async function Home() {
  const [items, user] = await Promise.all([getTrainingItems(), getCurrentUser()])
  const isAdmin = isAdminRole(user?.role)

  return (
    <div className="min-h-screen relative">
      <HomeModeShell mode="listening" isAdmin={isAdmin}>
        <HomeTrainingGrid items={items} isAdmin={isAdmin} />
      </HomeModeShell>
    </div>
  )
}
