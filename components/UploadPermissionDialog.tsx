'use client'

interface UploadPermissionDialogProps {
  onClose: () => void
}

export default function UploadPermissionDialog({ onClose }: UploadPermissionDialogProps) {
  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center px-4 pointer-events-auto">
      <button
        type="button"
        aria-label="Close permission dialog"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-red-500/42 bg-[linear-gradient(160deg,rgba(18,6,8,0.96),rgba(5,8,12,0.94))] p-5 shadow-[0_0_36px_rgba(255,0,64,0.2),inset_0_0_24px_rgba(255,0,64,0.06)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,0,64,0.06)_50%,transparent_100%)] bg-[length:100%_4px] opacity-45" />
        <div className="pointer-events-none absolute left-0 top-0 h-12 w-12 border-l border-t border-red-500/50" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-b border-r border-red-500/50" />

        <div className="relative z-10">
          <div className="text-[10px] cyber-label tracking-[0.28em] text-red-400/75">ACCESS DENIED</div>
          <h2 className="mt-2 text-xl cyber-title text-red-100">UPLOAD PERMISSION REQUIRED</h2>
          <p className="mt-4 text-sm leading-6 text-red-100/72">
            Only the administrator account can upload, edit, or delete training data. You can continue browsing and training with the existing content.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-red-500/36 bg-red-500/[0.12] px-4 py-2 text-xs text-red-100 transition-colors hover:border-red-300/65 hover:bg-red-500/[0.2]"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
