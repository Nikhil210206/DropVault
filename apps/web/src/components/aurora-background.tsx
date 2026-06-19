/** Fixed, animated aurora gradient backdrop sitting behind all content. */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[10%] -top-[15%] h-[42rem] w-[42rem] rounded-full bg-violet-500/30 blur-[130px] animate-aurora-1" />
      <div className="absolute -right-[12%] top-[20%] h-[38rem] w-[38rem] rounded-full bg-fuchsia-500/25 blur-[130px] animate-aurora-2" />
      <div className="absolute bottom-[-15%] left-[20%] h-[40rem] w-[40rem] rounded-full bg-cyan-400/20 blur-[130px] animate-aurora-3" />
      <div className="absolute right-[15%] bottom-[5%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/20 blur-[120px] animate-aurora-2" />
      {/* Tint to keep contrast readable over the glow */}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
}
