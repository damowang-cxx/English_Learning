import { NextResponse } from 'next/server'
import { isAdminRole } from '@/lib/auth-types'
import { requireApiUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatGuideState(userGuideSeenAt: Date | null) {
  return {
    seen: Boolean(userGuideSeenAt),
    userGuideSeenAt: userGuideSeenAt ? userGuideSeenAt.toISOString() : null,
  }
}

function forbiddenForAdmins() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET() {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  if (isAdminRole(guard.user.role)) {
    return forbiddenForAdmins()
  }

  const account = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: {
      userGuideSeenAt: true,
    },
  })

  if (!account) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  return NextResponse.json(formatGuideState(account.userGuideSeenAt))
}

export async function PATCH() {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  if (isAdminRole(guard.user.role)) {
    return forbiddenForAdmins()
  }

  try {
    const account = await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        userGuideSeenAt: new Date(),
      },
      select: {
        userGuideSeenAt: true,
      },
    })

    return NextResponse.json(formatGuideState(account.userGuideSeenAt))
  } catch (error) {
    console.error('Failed to update user help guide state:', error)
    return NextResponse.json({ error: 'Failed to update help guide state.' }, { status: 500 })
  }
}
