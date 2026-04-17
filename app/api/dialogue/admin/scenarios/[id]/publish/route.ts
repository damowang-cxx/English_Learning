import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { normalizeDialogueAdminPayload, validateDialoguePublishGraph } from '@/lib/dialogue-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiAdmin()
  if (guard.response) {
    return guard.response
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const isPublished = body?.isPublished !== false
    const scenario = await prisma.dialogueScenario.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: { order: 'asc' },
        },
        edges: true,
      },
    })

    if (!scenario) {
      return NextResponse.json({ error: 'Dialogue scenario not found' }, { status: 404 })
    }

    if (isPublished) {
      validateDialoguePublishGraph(normalizeDialogueAdminPayload({
        ...scenario,
        tags: scenario.tagsJson,
        nodes: scenario.nodes,
        edges: scenario.edges,
      }))
    }

    const updated = await prisma.dialogueScenario.update({
      where: { id },
      data: { isPublished },
      select: {
        id: true,
        isPublished: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error publishing dialogue scenario:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update publish state' },
      { status: 400 }
    )
  }
}
