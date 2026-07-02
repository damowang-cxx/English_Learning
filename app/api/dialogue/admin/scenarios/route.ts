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
            stages: true,
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
        startStageId: scenario.startStageId,
        roleVoice: scenario.roleVoice,
        coachVoice: scenario.coachVoice,
        nodesCount: scenario._count.stages,
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
    const stageId = `dlg_stage_${Date.now()}`
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
        startStageId: stageId,
        stages: {
          create: {
            id: stageId,
            order: 0,
            title: 'Opening stage',
            openingLineEn: 'Hello. What would you like to do?',
            openingLineZh: '你好，你想做什么？',
            objective: 'Help the learner clearly state what they want in this situation.',
            slotsJson: safeJsonStringify([
              {
                key: 'user_need',
                label: 'User need',
                required: true,
                description: 'What the learner wants or chooses.',
              },
            ], '[]'),
            completionJson: safeJsonStringify({
              rule: 'Complete when the learner clearly states the required information.',
            }),
            assessmentJson: safeJsonStringify({
              scoringFocus: ['communicative goal', 'natural expression'],
            }),
            hintsJson: safeJsonStringify({
              hints: ['Say what you need in this situation.'],
            }),
            outcomesJson: safeJsonStringify([], '[]'),
            positionX: 120,
            positionY: 120,
          },
        },
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
        transitions: true,
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
