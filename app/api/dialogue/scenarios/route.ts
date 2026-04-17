import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueTags } from '@/lib/dialogue'

export async function GET() {
  try {
    const scenarios = await prisma.dialogueScenario.findMany({
      where: { isPublished: true },
      orderBy: [
        { createdAt: 'desc' },
        { title: 'asc' },
      ],
      include: {
        _count: {
          select: {
            nodes: true,
            sessions: true,
          },
        },
      },
    })

    return NextResponse.json(
      scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        difficulty: scenario.difficulty,
        userRole: scenario.userRole,
        aiRole: scenario.aiRole,
        tags: normalizeDialogueTags(scenario.tagsJson),
        coverUrl: scenario.coverUrl,
        roleVoice: scenario.roleVoice,
        coachVoice: scenario.coachVoice,
        nodesCount: scenario._count.nodes,
        sessionsCount: scenario._count.sessions,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Error fetching dialogue scenarios:', error)
    return NextResponse.json({ error: 'Failed to fetch dialogue scenarios' }, { status: 500 })
  }
}
