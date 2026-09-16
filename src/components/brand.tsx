export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3">
    <img src="/favicon.svg" alt="" width={compact ? 36 : 44} height={compact ? 36 : 44} />
    <div><div className="brand-wordmark text-2xl leading-none">Blueprint</div><div className="mt-1.5 text-[9px] font-bold tracking-[0.23em] uppercase opacity-65">Recruiting · New York City</div></div>
  </div>;
}
