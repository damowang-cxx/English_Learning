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
        nodes: {
          orderBy: { order: 'asc' },
        },
        edges: true,
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
      startNodeId: scenario.startNodeId,
      roleVoice: scenario.roleVoice,
      coachVoice: scenario.coachVoice,
      nodes: scenario.nodes.map((node) => ({
        id: node.id,
        order: node.order,
        title: node.title,
        roleLineEn: node.roleLineEn,
        roleLineZh: node.roleLineZh,
        goal: node.goal,
        rubric: parseJsonString<Record<string, unknown>>(node.rubricJson, {}),
        hints: parseJsonString<Record<string, unknown>>(node.hintJson, {}),
        sampleAnswer: node.sampleAnswer,
        retryLimit: node.retryLimit,
      })),
      edges: scenario.edges.map((edge) => ({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        onResult: edge.onResult,
        toNodeId: edge.toNodeId,
      })),
    })
  } catch (error) {
    console.error('Error fetching dialogue scenario:', error)
    return NextResponse.json({ error: 'Failed to fetch dialogue scenario' }, { status: 500 })
  }
}
