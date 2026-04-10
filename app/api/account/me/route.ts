import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getUploadFile, parseBooleanFormField } from '@/lib/upload-form'
import { deletePublicFile, savePublicUploadFile } from '@/lib/video-training-storage'

export async function GET() {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  return NextResponse.json(guard.user)
}

export async function PATCH(request: Request) {
  const guard = await requireApiUser()
  if (guard.response) {
    return guard.response
  }

  const formData = await request.formData()
  const avatarFile = getUploadFile(formData, 'avatar')
  const removeAvatar = parseBooleanFormField(formData, 'removeAvatar')

  const existingUser = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
  })

  if (!existingUser) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  let nextAvatarUrl = existingUser.avatarUrl
  let newAvatarUrl: string | null = null

  try {
    if (avatarFile) {
      newAvatarUrl = await savePublicUploadFile(avatarFile, 'user-avatars')
      nextAvatarUrl = newAvatarUrl
    } else if (removeAvatar) {
      nextAvatarUrl = null
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: { avatarUrl: nextAvatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    })

    if (avatarFile && existingUser.avatarUrl) {
      deletePublicFile(existingUser.avatarUrl)
    }

    if (removeAvatar && existingUser.avatarUrl) {
      deletePublicFile(existingUser.avatarUrl)
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (newAvatarUrl) {
      deletePublicFile(newAvatarUrl)
    }

    console.error('Failed to update account avatar:', error)
    return NextResponse.json({ error: 'Failed to update account avatar.' }, { status: 500 })
  }
}
