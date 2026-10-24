export function StatBox({ label, value, className = '' }) {
  return (
    <div className={`bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/10 rounded-2xl p-4 flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-navy/60 dark:text-silver-muted">{label}</span>
      <span className="font-serif text-xl tabular-nums text-navy dark:text-cream">{value}</span>
    </div>
  )
}

