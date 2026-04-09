import AdminUsersPanel from '@/components/AdminUsersPanel'
import { requirePageAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  await requirePageAdmin('/admin/users')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  return (
    <div className="relative min-h-screen px-4 py-[8vh]" style={{ zIndex: 45 }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="text-xs cyber-label text-cyan-400/70">ADMIN</div>
          <h1 className="mt-2 text-2xl cyber-title text-cyan-200">[ USER CONTROL ]</h1>
        </div>
        <AdminUsersPanel initialUsers={users} />
      </div>
    </div>
  )
}
