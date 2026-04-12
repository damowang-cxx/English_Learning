export default function HomeBottomHud() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-20 w-full overflow-hidden px-4 py-2 pb-3 md:px-8 md:pb-5">
      <div className="absolute bottom-0 inset-x-0 h-1.5 w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent blur-[2px]" />
      <div className="absolute bottom-[2px] inset-x-1/4 h-px w-2/4 bg-gradient-to-r from-cyan-900/0 via-cyan-400/60 to-cyan-900/0 shadow-[0_-2px_14px_rgba(34,211,238,0.5)]" />
      <div className="absolute bottom-[17px] right-[8.1rem] hidden h-[4px] w-[11.8rem] rounded-[2px] border border-slate-300/15 bg-[linear-gradient(90deg,rgba(15,23,42,0.95),rgba(30,41,59,0.92))] shadow-[0_0_10px_rgba(34,211,238,0.08),inset_0_0_0_1px_rgba(255,255,255,0.02)] md:block" />
      <div className="absolute bottom-[22px] right-[10.4rem] hidden h-px w-[6.6rem] bg-gradient-to-l from-cyan-100/30 via-cyan-300/12 to-transparent md:block" />
      <div className="absolute bottom-[18px] right-[19.4rem] hidden h-[6px] w-[1.35rem] rounded-[2px] border border-slate-300/14 bg-slate-800/90 shadow-[0_0_8px_rgba(34,211,238,0.06)] md:block" />
      <div className="absolute bottom-[13px] right-[8.55rem] hidden h-[11px] w-[4px] rounded-[1px] border border-slate-300/14 bg-slate-900/95 shadow-[0_0_8px_rgba(34,211,238,0.08)] md:block" />
      <div className="absolute bottom-[11px] right-[7.92rem] hidden h-[14px] w-[14px] rotate-45 border border-slate-300/16 bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.94))] shadow-[0_0_10px_rgba(34,211,238,0.1)] md:block" />
      <div className="absolute bottom-[16px] right-[7.58rem] hidden h-1.5 w-1.5 rounded-full bg-cyan-100/55 shadow-[0_0_10px_rgba(224,242,254,0.22),0_0_14px_rgba(34,211,238,0.1)] md:block" />
      <div className="absolute bottom-[21px] right-[8.92rem] hidden h-px w-[4.9rem] bg-gradient-to-l from-fuchsia-400/20 via-fuchsia-400/6 to-transparent blur-[0.35px] md:block" />

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
