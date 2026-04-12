export default function HomeBottomHud() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-20 w-full overflow-hidden px-4 py-2 pb-3 md:px-8 md:pb-5">
      <div className="absolute bottom-0 inset-x-0 h-1.5 w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent blur-[2px]" />
      <div className="absolute bottom-[2px] inset-x-1/4 h-px w-2/4 bg-gradient-to-r from-cyan-900/0 via-cyan-400/60 to-cyan-900/0 shadow-[0_-2px_14px_rgba(34,211,238,0.5)]" />
      <div className="home-shuttle-dock hidden md:block" aria-hidden="true">
        <span className="home-shuttle-dock__rail" />
        <span className="home-shuttle-dock__bay" />
        <span className="home-shuttle-dock__signal" />
        <span className="home-shuttle-dock__mast" />
        <span className="home-shuttle-dock__beacon" />
        <span className="home-shuttle-dock__reflection" />
      </div>

      <div className="absolute bottom-3 left-6 flex flex-col gap-1.5 opacity-80 md:left-10">
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] text-cyan-400/60 xl:text-[10px]">
          <span>COORDS: 42.X / 11.Y</span>
          <span className="opacity-40">|</span>
          <span className="text-cyan-200/40">NODE_OPT: STABLE</span>
        </div>
        <div className="mt-1 flex items-end gap-1">
          <div className="h-1.5 w-1.5 rounded-sm bg-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <div className="ml-1 h-[2px] w-8 rounded-full bg-cyan-800/60 md:w-16" />
          <div className="h-[2px] w-3 rounded-full bg-cyan-600/60 animate-pulse md:w-6" />
          <div className="h-[2px] w-1 rounded-full bg-cyan-400/50 md:w-2" />
        </div>
      </div>
    </div>
  )
}
