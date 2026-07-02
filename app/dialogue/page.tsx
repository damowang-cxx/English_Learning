import { unstable_noStore as noStore } from 'next/cache'
import HomeModeShell from '@/components/HomeModeShell'
import HomeDialogueScenarioGrid, {
  type HomeDialogueScenarioCardItem,
} from '@/components/dialogue/HomeDialogueScenarioGrid'
import DialogueHomeCoach from '@/components/dialogue/DialogueHomeCoach'
import { isAdminRole } from '@/lib/auth-types'
import { getCurrentUser } from '@/lib/authz'
import { normalizeDialogueTags } from '@/lib/dialogue'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getDialogueScenarios() {
  noStore()

  const scenarios = await prisma.dialogueScenario.findMany({
    where: { isPublished: true },
    orderBy: [
      { updatedAt: 'desc' },
      { title: 'asc' },
    ],
    include: {
      _count: {
        select: {
          stages: true,
          sessions: true,
        },
      },
    },
  })

  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    difficulty: scenario.difficulty,
    userRole: scenario.userRole,
    aiRole: scenario.aiRole,
    tags: normalizeDialogueTags(scenario.tagsJson),
    coverUrl: scenario.coverUrl,
    nodesCount: scenario._count.stages,
    sessionsCount: scenario._count.sessions,
    updatedAt: scenario.updatedAt.toISOString(),
  })) satisfies HomeDialogueScenarioCardItem[]
}

export default async function DialogueHomePage() {
  const [items, user] = await Promise.all([getDialogueScenarios(), getCurrentUser()])
  const isAdmin = isAdminRole(user?.role)

  return (
    <div className="relative min-h-screen">
      <HomeModeShell mode="dialogue" isAdmin={isAdmin}>
        <div className="space-y-5">
          <DialogueHomeCoach scenarios={items} isAuthenticated={Boolean(user?.id)} />
          <HomeDialogueScenarioGrid items={items} />
        </div>
      </HomeModeShell>
    </div>
  )
}
