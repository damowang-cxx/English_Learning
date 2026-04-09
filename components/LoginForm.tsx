'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { normalizeAppRedirectPath, normalizeAppRouterPath } from '@/lib/base-path'

interface LoginFormProps {
  callbackUrl: string
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    const normalizedCallbackUrl = normalizeAppRedirectPath(callbackUrl, '/')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: normalizedCallbackUrl,
      })

      if (result?.error) {
        setError('Invalid email or password.')
        return
      }

      const targetUrl = normalizeAppRouterPath(result?.url, normalizedCallbackUrl)

      router.replace(targetUrl)
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-xs text-cyan-300 cyber-label">EMAIL</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs text-cyan-300 cyber-label">PASSWORD</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="w-full rounded-md border border-cyan-500/30 bg-black/45 px-4 py-3 text-gray-100 focus:border-cyan-300/60 focus:outline-none"
          required
        />
      </label>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md border-2 border-cyan-500/55 bg-cyan-500/[0.12] px-6 py-3 text-sm text-cyan-100 transition-colors hover:border-cyan-300/80 hover:bg-cyan-500/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
      </button>
    </form>
  )
}
