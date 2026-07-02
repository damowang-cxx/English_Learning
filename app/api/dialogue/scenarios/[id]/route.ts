import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueTags, parseJsonString } from '@/lib/dialogue'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scenario = await prisma.dialogueScenario.findFirst({
      where: {
        id,
        isPublished: true,
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
        transitions: true,
      },
    })

    if (!scenario) {
      return NextResponse.json({ error: 'Dialogue scenario not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      difficulty: scenario.difficulty,
      userRole: scenario.userRole,
      aiRole: scenario.aiRole,
      tags: normalizeDialogueTags(scenario.tagsJson),
      coverUrl: scenario.coverUrl,
      startStageId: scenario.startStageId,
      roleVoice: scenario.roleVoice,
      coachVoice: scenario.coachVoice,
      stages: scenario.stages.map((stage) => ({
        id: stage.id,
        order: stage.order,
        title: stage.title,
        openingLineEn: stage.openingLineEn,
        openingLineZh: stage.openingLineZh,
        objective: stage.objective,
        slots: parseJsonString<unknown[]>(stage.slotsJson, []),
        completion: parseJsonString<Record<string, unknown>>(stage.completionJson, {}),
        assessment: parseJsonString<Record<string, unknown>>(stage.assessmentJson, {}),
        hints: parseJsonString<Record<string, unknown>>(stage.hintsJson, {}),
        outcomes: parseJsonString<unknown[]>(stage.outcomesJson, []),
      })),
      transitions: scenario.transitions.map((transition) => ({
        id: transition.id,
        fromStageId: transition.fromStageId,
        outcomeKey: transition.outcomeKey,
        label: transition.label,
        condition: parseJsonString<Record<string, unknown>>(transition.conditionJson, {}),
        priority: transition.priority,
        isFallback: transition.isFallback,
        toStageId: transition.toStageId,
      })),
    })
  } catch (error) {
    console.error('Error fetching dialogue scenario:', error)
    return NextResponse.json({ error: 'Failed to fetch dialogue scenario' }, { status: 500 })
  }
}
