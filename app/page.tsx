import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
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
        <div className="mb-4 flex items-center justify-end">
          <Link
            href="/vocabulary"
            className="home-global-vocab-button group inline-flex items-center gap-2 rounded-md px-3 py-2"
            title="Open global vocabulary library"
            aria-label="Open global vocabulary library"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 transition-colors group-hover:bg-cyan-300"></span>
            <span className="font-mono text-[11px] tracking-[0.24em] text-cyan-300/78 transition-colors group-hover:text-cyan-200">
              GLOBAL VOCAB
            </span>
          </Link>
        </div>
        <HomeTrainingGrid items={items} />
      </div>
    </div>
  )
}
