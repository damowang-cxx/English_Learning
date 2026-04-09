import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminRole, normalizeUserRole } from '@/lib/auth-types'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  })

  if (!user?.isActive) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeUserRole(user.role),
  }
}

export function isAdminUser(user: { role?: string } | null | undefined) {
  return isAdminRole(user?.role)
}

export async function requireApiUser() {
  const user = await getCurrentUser()

  if (!user?.id) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, response: null }
}

export async function requireApiAdmin() {
  const user = await getCurrentUser()

  if (!user?.id || !isAdminUser(user)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user, response: null }
}

export async function requirePageUser(callbackUrl: string) {
  const user = await getCurrentUser()

  if (!user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return user
}

export async function requirePageAdmin(callbackUrl: string) {
  const user = await getCurrentUser()

  if (!user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  if (!isAdminUser(user)) {
    redirect('/403')
  }

  return user
}
