import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import LoginForm from '@/components/LoginForm'
import { normalizeAppRedirectPath } from '@/lib/base-path'

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()
  const params = await searchParams
  const callbackUrl = normalizeAppRedirectPath(params.callbackUrl, '/')

  if (session?.user?.id) {
    redirect(callbackUrl)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4" style={{ zIndex: 45 }}>
      <div className="w-full max-w-md overflow-hidden rounded-lg border-2 border-cyan-500/45 bg-black/82 p-6 shadow-[0_0_35px_rgba(34,211,238,0.18)] backdrop-blur-md">
        <div className="mb-6">
          <div className="text-xs cyber-label text-cyan-400/70">ACCOUNT ACCESS</div>
          <h1 className="mt-2 text-2xl cyber-title text-cyan-200">[ SIGN IN ]</h1>
          <p className="mt-2 text-sm text-cyan-100/65">Sign in to train, save notes, and track your heatmap.</p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  )
}
