'use client'

import { useState, type FormEvent } from 'react'
import { withBasePath } from '@/lib/base-path'

export interface AdminUserListItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string | Date
}

export default function AdminUsersPanel({ initialUsers }: { initialUsers: AdminUserListItem[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({})

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
    <div className="space-y-8">
      <form onSubmit={handleCreateUser} className="rounded-lg border border-cyan-500/25 bg-black/35 p-5">
        <h2 className="text-lg cyber-title text-cyan-300">CREATE USER</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
            placeholder="email"
            type="email"
            required
          />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
            placeholder="name"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
            placeholder="password, at least 8 characters"
            type="password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 rounded-md border border-cyan-500/45 bg-cyan-500/[0.1] px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'CREATING...' : 'CREATE'}
        </button>
      </form>

      {status ? (
        <div className="rounded-md border border-yellow-500/35 bg-yellow-500/[0.08] px-4 py-3 text-sm text-yellow-100">
          {status}
        </div>
      ) : null}

      <div className="rounded-lg border border-cyan-500/25 bg-black/35 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg cyber-title text-cyan-300">USERS</h2>
          <button
            type="button"
            onClick={() => void refreshUsers()}
            className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-300 hover:border-cyan-300/70"
          >
            REFRESH
          </button>
        </div>
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-md border border-cyan-500/18 bg-black/35 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-mono text-sm text-cyan-100">{user.email}</div>
                  <div className="mt-1 text-xs text-cyan-300/55">
                    {user.name || 'No name'} | {user.role} | {user.isActive ? 'ACTIVE' : 'DISABLED'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.role === 'ADMIN' ? null : (
                    <button
                      type="button"
                      onClick={() => void updateUser(user.id, { isActive: !user.isActive })}
                      className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-300 hover:border-cyan-300/70"
                    >
                      {user.isActive ? 'DISABLE' : 'ENABLE'}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 md:flex-row">
                <input
                  value={resetPasswordById[user.id] || ''}
                  onChange={(event) => setResetPasswordById((prev) => ({ ...prev, [user.id]: event.target.value }))}
                  className="flex-1 rounded-md border border-cyan-500/25 bg-black/45 px-3 py-2 text-sm text-gray-100 focus:border-cyan-300/60 focus:outline-none"
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
                  className="rounded-md border border-cyan-500/35 px-3 py-2 text-xs text-cyan-300 hover:border-cyan-300/70"
                >
                  RESET PASSWORD
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
