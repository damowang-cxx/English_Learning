import { unstable_noStore as noStore } from 'next/cache'
import HomeTrainingGrid, { type HomeTrainingCardItem } from '@/components/HomeTrainingGrid'
import { prisma } from '@/lib/prisma'

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

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    sentencesCount: item.sentences.length,
  })) satisfies HomeTrainingCardItem[]
}

export default async function Home() {
  const items = await getTrainingItems()

  return (
    <div className="min-h-screen relative">
      <div
        className="container mx-auto py-8 cockpit-viewport"
        style={{
          position: 'relative',
          zIndex: 10,
          paddingTop: '8vh',
          paddingBottom: '45vh',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          maxHeight: '65vh',
          overflowY: 'auto',
          overflowX: 'visible',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '75%',
          maxWidth: '1000px',
        }}
      >
        <HomeTrainingGrid items={items} />
      </div>
    </div>
  )
}
