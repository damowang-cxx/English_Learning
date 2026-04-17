import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueTags, safeJsonStringify } from '@/lib/dialogue'

export async function GET() {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const scenarios = await prisma.dialogueScenario.findMany({
      orderBy: [
        { updatedAt: 'desc' },
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
        isPublished: scenario.isPublished,
        startNodeId: scenario.startNodeId,
        roleVoice: scenario.roleVoice,
        coachVoice: scenario.coachVoice,
        nodesCount: scenario._count.nodes,
        sessionsCount: scenario._count.sessions,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Error fetching admin dialogue scenarios:', error)
    return NextResponse.json({ error: 'Failed to fetch dialogue scenarios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = String(body?.title || 'New dialogue scenario').trim() || 'New dialogue scenario'
    const nodeId = `dlg_node_${Date.now()}`
    const scenario = await prisma.dialogueScenario.create({
      data: {
        title,
        description: 'A short real-life English practice scene.',
        difficulty: 'beginner',
        userRole: 'Learner',
        aiRole: 'Coach',
        tagsJson: safeJsonStringify(['draft'], '[]'),
        roleVoice: 'marin',
        coachVoice: 'cedar',
        startNodeId: nodeId,
        nodes: {
          create: {
            id: nodeId,
            order: 0,
            title: 'Opening',
            roleLineEn: 'Hello. How can I help you today?',
            roleLineZh: '你好。今天我可以怎么帮你？',
            goal: 'Respond appropriately to the opening question.',
            rubricJson: safeJsonStringify({
              requiredMeaning: ['answer the opening question'],
            }),
            hintJson: safeJsonStringify({
              hints: ['Say what you need in this situation.'],
            }),
            sampleAnswer: 'I would like to ask about your service.',
            positionX: 120,
            positionY: 120,
          },
        },
      },
      include: {
        nodes: {
          orderBy: { order: 'asc' },
        },
        edges: true,
      },
    })

    return NextResponse.json(scenario)
  } catch (error) {
    console.error('Error creating dialogue scenario:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dialogue scenario' },
      { status: 500 }
    )
  }
}
