import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAdmin } from '@/lib/authz'
import { hashPassword } from '@/lib/password'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAdmin()

  if (guard.response) {
    return guard.response
  }

  const { id } = await params
  const body = await request.json()
  const data: {
    name?: string
    isActive?: boolean
    passwordHash?: string
  } = {}

  if (typeof body.name === 'string') {
    data.name = body.name.trim()
  }

  if (typeof body.isActive === 'boolean') {
    if (body.isActive === false) {
      const target = await prisma.user.findUnique({
        where: { id },
        select: { role: true },
      })

      if (target?.role === 'ADMIN') {
        return NextResponse.json({ error: 'The administrator account cannot be disabled.' }, { status: 400 })
      }
    }

    data.isActive = body.isActive
  }

  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    data.passwordHash = await hashPassword(body.password)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 })
  }
}
