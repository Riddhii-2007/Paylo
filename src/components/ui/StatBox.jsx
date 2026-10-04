export function StatBox({ label, value, className = '' }) {
  return (
    <div className={`p-4 border border-navy/10 dark:border-gold/20 flex flex-col justify-center gap-1 ${className}`}>
      <span className="text-sm font-sans text-navy/70 dark:text-silver-muted">{label}</span>
      <span className="font-serif text-xl tabular-nums text-navy dark:text-cream">{value}</span>
    </div>
  )
}
