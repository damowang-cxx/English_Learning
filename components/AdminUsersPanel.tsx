'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { withBasePath } from '@/lib/base-path'

export interface AdminUserListItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string | Date
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminUsersPanel({ initialUsers }: { initialUsers: AdminUserListItem[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({})
  const statusTone = status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')
    ? 'error'
    : status
      ? 'success'
      : 'idle'

  const summary = useMemo(() => {
    const total = users.length
    const active = users.filter((user) => user.isActive).length
    const disabled = total - active
    const admins = users.filter((user) => user.role === 'ADMIN').length

    return { total, active, disabled, admins }
  }, [users])

  const refreshUsers = async () => {
    const response = await fetch(withBasePath('/api/admin/users'), { cache: 'no-store' })

    if (response.ok) {
      setUsers(await response.json())
    }
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('')
    setIsSubmitting(true)

    try {
      const response = await fetch(withBasePath('/api/admin/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || `Create failed: ${response.status}`)
      }

      setUsers((prev) => [...prev, data])
      setEmail('')
      setName('')
      setPassword('')
      setStatus('User created.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Create failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateUser = async (userId: string, patch: Record<string, unknown>) => {
    setStatus('')
    const response = await fetch(withBasePath(`/api/admin/users/${userId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await response.json()

    if (!response.ok) {
      setStatus(data?.error || `Update failed: ${response.status}`)
      return
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? data : user)))
    setStatus('User updated.')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black/45 p-5 shadow-[0_0_28px_rgba(34,211,238,0.1)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-10 w-10 border-b border-r border-cyan-400/20" />
          <div className="text-xs cyber-label text-cyan-400/70">ACCOUNT SUMMARY</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-3">
              <div className="text-[10px] cyber-label text-cyan-300/65">TOTAL</div>
              <div className="mt-1 text-2xl font-mono text-cyan-100">{summary.total}</div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-3">
              <div className="text-[10px] cyber-label text-cyan-300/65">ACTIVE</div>
              <div className="mt-1 text-2xl font-mono text-cyan-100">{summary.active}</div>
            </div>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-3">
              <div className="text-[10px] cyber-label text-yellow-200/65">DISABLED</div>
              <div className="mt-1 text-2xl font-mono text-yellow-100">{summary.disabled}</div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-3">
              <div className="text-[10px] cyber-label text-cyan-300/65">ADMIN</div>
              <div className="mt-1 text-2xl font-mono text-cyan-100">{summary.admins}</div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleCreateUser}
          className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black/45 p-5 shadow-[0_0_28px_rgba(34,211,238,0.1)] backdrop-blur-md"
        >
          <div className="pointer-events-none absolute left-0 top-14 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
          <div className="text-xs cyber-label text-cyan-400/70">ACCESS PROVISIONING</div>
          <h2 className="mt-2 text-lg cyber-title text-cyan-300">CREATE USER</h2>
          <p className="mt-2 text-xs leading-5 text-cyan-100/65">
            Add controlled user accounts for learning access. New accounts are created as standard users.
          </p>
          <div className="mt-5 space-y-4">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-cyan-500/30 bg-black/50 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
              placeholder="email"
              type="email"
              required
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-cyan-500/30 bg-black/50 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
              placeholder="name"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-cyan-500/30 bg-black/50 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
              placeholder="password, at least 8 characters"
              type="password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 w-full rounded-lg border border-cyan-500/45 bg-cyan-500/[0.12] px-4 py-3 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 hover:bg-cyan-500/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'CREATING...' : 'CREATE USER'}
          </button>
        </form>

        {status ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              statusTone === 'error'
                ? 'border-red-500/35 bg-red-500/[0.08] text-red-100'
                : 'border-cyan-500/35 bg-cyan-500/[0.08] text-cyan-100'
            }`}
          >
            {status}
          </div>
        ) : null}
      </div>

      <section className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black/45 p-5 shadow-[0_0_28px_rgba(34,211,238,0.1)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
        <div className="pointer-events-none absolute left-5 top-5 h-8 w-8 border-l border-t border-cyan-400/20" />
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs cyber-label text-cyan-400/70">USER DIRECTORY</div>
            <h2 className="mt-2 text-lg cyber-title text-cyan-300">USERS</h2>
            <p className="mt-2 text-xs leading-5 text-cyan-100/65">
              Enable or disable standard accounts and rotate passwords without leaving the control panel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshUsers()}
            className="rounded-lg border border-cyan-500/35 px-4 py-2 text-xs text-cyan-300 transition-colors hover:border-cyan-300/70 hover:text-cyan-100"
          >
            REFRESH LIST
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-cyan-300/70">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-1.5">{summary.total} accounts</span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-1.5">{summary.active} active</span>
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-1.5">{summary.disabled} disabled</span>
        </div>

        <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
          {users.map((user, index) => (
            <div
              key={user.id}
              className="rounded-xl border border-cyan-500/18 bg-black/40 p-4 transition-colors hover:border-cyan-400/35"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-cyan-500/25 px-2 py-0.5 font-mono text-[10px] text-cyan-300/75">
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="truncate font-mono text-sm text-cyan-100">{user.email}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] px-2.5 py-1 text-cyan-200/80">
                      {user.name || 'No name'}
                    </span>
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] px-2.5 py-1 text-cyan-200/80">
                      {user.role}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        user.isActive
                          ? 'border-green-500/20 bg-green-500/[0.08] text-green-100/85'
                          : 'border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-100/85'
                      }`}
                    >
                      {user.isActive ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] text-cyan-300/55">
                    Created: {formatDateTime(user.createdAt)}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {user.role === 'ADMIN' ? (
                    <span className="rounded-lg border border-cyan-500/18 bg-cyan-500/[0.05] px-3 py-2 text-[11px] text-cyan-300/65">
                      ADMIN LOCKED
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateUser(user.id, { isActive: !user.isActive })}
                      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                        user.isActive
                          ? 'border-yellow-500/35 text-yellow-200 hover:border-yellow-300/65'
                          : 'border-cyan-500/35 text-cyan-300 hover:border-cyan-300/70'
                      }`}
                    >
                      {user.isActive ? 'DISABLE USER' : 'ENABLE USER'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 md:flex-row">
                <input
                  value={resetPasswordById[user.id] || ''}
                  onChange={(event) => setResetPasswordById((prev) => ({ ...prev, [user.id]: event.target.value }))}
                  className="flex-1 rounded-lg border border-cyan-500/25 bg-black/50 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
                  placeholder="new password"
                  type="password"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextPassword = resetPasswordById[user.id] || ''
                    void updateUser(user.id, { password: nextPassword })
                    setResetPasswordById((prev) => ({ ...prev, [user.id]: '' }))
                  }}
                  className="rounded-lg border border-cyan-500/35 px-4 py-2 text-xs text-cyan-300 transition-colors hover:border-cyan-300/70 hover:text-cyan-100"
                >
                  RESET PASSWORD
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
