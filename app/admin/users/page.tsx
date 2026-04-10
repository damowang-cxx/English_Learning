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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-[8vh]" style={{ zIndex: 45 }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex justify-center">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-cyan-500/35 bg-black/55 px-6 py-7 text-center shadow-[0_0_36px_rgba(34,211,238,0.12)] backdrop-blur-md md:px-10 md:py-9">
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" />
            <div className="pointer-events-none absolute left-5 top-5 h-6 w-6 border-l border-t border-cyan-400/30" />
            <div className="pointer-events-none absolute bottom-5 right-5 h-6 w-6 border-b border-r border-cyan-400/30" />
            <div className="text-xs cyber-label text-cyan-400/70">ADMIN CONSOLE</div>
            <h1 className="mt-3 text-3xl cyber-title text-cyan-200 md:text-4xl">[ USER CONTROL ]</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-cyan-100/70 md:text-base">
              Manage access, account status, and password resets for the site&apos;s controlled user list.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-cyan-300/65">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5">
                {users.length} TOTAL USERS
              </span>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5">
                {users.filter((user) => user.isActive).length} ACTIVE
              </span>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5">
                {users.filter((user) => user.role === 'ADMIN').length} ADMIN
              </span>
            </div>
          </div>
        </div>
        <AdminUsersPanel initialUsers={users} />
      </div>
    </div>
  )
}
