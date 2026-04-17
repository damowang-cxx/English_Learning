import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueAdminPayload, serializeDialogueAdminScenario } from '@/lib/dialogue-admin'
import { safeJsonStringify } from '@/lib/dialogue'

async function getAdminScenario(id: string) {
  const scenario = await prisma.dialogueScenario.findUnique({
    where: { id },
    include: {
      nodes: {
        orderBy: { order: 'asc' },
      },
      edges: true,
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
        nodes: {
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

    const submittedNodeIds = new Set(payload.nodes.map((node) => node.id))

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
          startNodeId: payload.startNodeId,
          roleVoice: payload.roleVoice,
          coachVoice: payload.coachVoice,
        },
      })

      await tx.dialogueEdge.deleteMany({
        where: { scenarioId: id },
      })

      const nodeIdsToDelete = existing.nodes
        .map((node) => node.id)
        .filter((nodeId) => !submittedNodeIds.has(nodeId))

      if (nodeIdsToDelete.length > 0) {
        await tx.dialogueNode.deleteMany({
          where: {
            scenarioId: id,
            id: {
              in: nodeIdsToDelete,
            },
          },
        })
      }

      for (const node of payload.nodes) {
        const existingNode = await tx.dialogueNode.findUnique({
          where: { id: node.id },
          select: { scenarioId: true },
        })

        if (existingNode && existingNode.scenarioId !== id) {
          throw new Error(`Node id belongs to another scenario: ${node.id}`)
        }

        const nodeData = {
          order: node.order,
          title: node.title,
          roleLineEn: node.roleLineEn,
          roleLineZh: node.roleLineZh,
          goal: node.goal,
          rubricJson: node.rubricJson,
          hintJson: node.hintJson,
          sampleAnswer: node.sampleAnswer,
          retryLimit: node.retryLimit,
          allowDynamicFollowup: node.allowDynamicFollowup,
          positionX: node.positionX,
          positionY: node.positionY,
        }

        await tx.dialogueNode.upsert({
          where: { id: node.id },
          update: nodeData,
          create: {
            id: node.id,
            scenarioId: id,
            ...nodeData,
          },
        })
      }

      for (const edge of payload.edges) {
        await tx.dialogueEdge.create({
          data: {
            ...(edge.id ? { id: edge.id } : {}),
            scenarioId: id,
            fromNodeId: edge.fromNodeId,
            onResult: edge.onResult,
            toNodeId: edge.toNodeId,
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
