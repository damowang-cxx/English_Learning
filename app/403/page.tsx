import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4" style={{ zIndex: 45 }}>
      <div className="w-full max-w-lg rounded-lg border border-red-500/40 bg-black/78 p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.15)]">
        <div className="text-xs cyber-label text-red-300/75">FORBIDDEN</div>
        <h1 className="mt-3 text-2xl cyber-title text-red-200">[ ADMIN ACCESS REQUIRED ]</h1>
        <p className="mt-4 text-sm leading-6 text-red-100/70">
          This area is reserved for the site administrator.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md border border-cyan-500/40 px-4 py-2 text-xs text-cyan-200 transition-colors hover:border-cyan-300/70 hover:text-cyan-100"
        >
          BACK HOME
        </Link>
      </div>
    </div>
  )
}
