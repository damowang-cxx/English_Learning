import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueAdminPayload, serializeDialogueAdminScenario } from '@/lib/dialogue-admin'
import { safeJsonStringify } from '@/lib/dialogue'

async function getAdminScenario(id: string) {
  const scenario = await prisma.dialogueScenario.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { order: 'asc' },
      },
      transitions: true,
    },
  })

  return scenario ? serializeDialogueAdminScenario(scenario) : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const scenario = await getAdminScenario(id)

    if (!scenario) {
      return NextResponse.json({ error: 'Dialogue scenario not found' }, { status: 404 })
    }

    return NextResponse.json(scenario)
  } catch (error) {
    console.error('Error fetching admin dialogue scenario:', error)
    return NextResponse.json({ error: 'Failed to fetch dialogue scenario' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const body = await request.json()
    const payload = normalizeDialogueAdminPayload(body)
    const existing = await prisma.dialogueScenario.findUnique({
      where: { id },
      include: {
        stages: {
          select: {
            id: true,
            scenarioId: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Dialogue scenario not found' }, { status: 404 })
    }

    const submittedStageIds = new Set(payload.stages.map((stage) => stage.id))

    await prisma.$transaction(async (tx) => {
      await tx.dialogueScenario.update({
        where: { id },
        data: {
          title: payload.title,
          description: payload.description,
          difficulty: payload.difficulty,
          userRole: payload.userRole,
          aiRole: payload.aiRole,
          tagsJson: safeJsonStringify(payload.tags, '[]'),
          coverUrl: payload.coverUrl,
          startStageId: payload.startStageId,
          roleVoice: payload.roleVoice,
          coachVoice: payload.coachVoice,
        },
      })

      await tx.dialogueTransition.deleteMany({
        where: { scenarioId: id },
      })

      const stageIdsToDelete = existing.stages
        .map((stage) => stage.id)
        .filter((stageId) => !submittedStageIds.has(stageId))

      if (stageIdsToDelete.length > 0) {
        await tx.dialogueStage.deleteMany({
          where: {
            scenarioId: id,
            id: {
              in: stageIdsToDelete,
            },
          },
        })
      }

      for (const stage of payload.stages) {
        const existingStage = await tx.dialogueStage.findUnique({
          where: { id: stage.id },
          select: { scenarioId: true },
        })

        if (existingStage && existingStage.scenarioId !== id) {
          throw new Error(`Stage id belongs to another scenario: ${stage.id}`)
        }

        const stageData = {
          order: stage.order,
          title: stage.title,
          openingLineEn: stage.openingLineEn,
          openingLineZh: stage.openingLineZh,
          objective: stage.objective,
          slotsJson: stage.slotsJson,
          completionJson: stage.completionJson,
          assessmentJson: stage.assessmentJson,
          hintsJson: stage.hintsJson,
          outcomesJson: stage.outcomesJson,
          positionX: stage.positionX,
          positionY: stage.positionY,
        }

        await tx.dialogueStage.upsert({
          where: { id: stage.id },
          update: stageData,
          create: {
            id: stage.id,
            scenarioId: id,
            ...stageData,
          },
        })
      }

      for (const transition of payload.transitions) {
        await tx.dialogueTransition.create({
          data: {
            ...(transition.id ? { id: transition.id } : {}),
            scenarioId: id,
            fromStageId: transition.fromStageId,
            outcomeKey: transition.outcomeKey,
            label: transition.label,
            conditionJson: transition.conditionJson,
            priority: transition.priority,
            isFallback: transition.isFallback,
            toStageId: transition.toStageId,
          },
        })
      }
    })

    const updated = await getAdminScenario(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating dialogue scenario:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update dialogue scenario' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    await prisma.dialogueScenario.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting dialogue scenario:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete dialogue scenario' },
      { status: 500 }
    )
  }
}
