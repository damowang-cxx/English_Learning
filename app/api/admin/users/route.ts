import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { requireApiAdmin } from '@/lib/authz'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET() {
  const guard = await requireApiAdmin()

  if (guard.response) {
    return guard.response
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
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

  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin()

  if (guard.response) {
    return guard.response
  }

  const body = await request.json()
  const email = normalizeEmail(body.email)
  const name = normalizeName(body.name)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Email and password with at least 8 characters are required.' }, { status: 400 })
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role: 'USER',
        isActive: true,
      },
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
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user. The email may already exist.' }, { status: 500 })
  }
}
