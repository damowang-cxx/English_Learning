import { unstable_noStore as noStore } from 'next/cache'
import GlobalVocabularyView from '@/components/GlobalVocabularyView'
import { requirePageUser } from '@/lib/authz'
import { getGlobalVocabulary } from '@/lib/global-vocabulary'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VocabularyPage() {
  noStore()
  const user = await requirePageUser('/vocabulary')
  const result = await getGlobalVocabulary({ userId: user.id })

  return (
    <div className="min-h-screen relative">
      <div
        className="container mx-auto cockpit-viewport py-8"
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
          width: '82%',
          maxWidth: '1200px',
        }}
      >
        <GlobalVocabularyView
          generatedAt={result.generatedAt}
          summary={result.summary}
          items={result.items}
        />
      </div>
    </div>
  )
}
