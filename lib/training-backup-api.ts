import { NextResponse } from 'next/server'
import { isAdminUser, requireApiUser } from '@/lib/authz'

export async function requireApiTrainingBackupAdmin() {
  const guard = await requireApiUser()

  if (guard.response) {
    return guard
  }

  if (!isAdminUser(guard.user)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return guard
}
