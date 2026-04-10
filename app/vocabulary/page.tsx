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
          paddingTop: '6vh',
          paddingBottom: '24vh',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          minHeight: '76vh',
          maxHeight: '84vh',
          overflowY: 'auto',
          overflowX: 'visible',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '90%',
          maxWidth: '1440px',
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
