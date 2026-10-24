export function StatBox({ label, value, caption, className = '' }) {
  return (
    <div className={`bg-cream-surface dark:bg-navy-surface border border-navy/5 dark:border-gold/10 rounded-2xl p-4 flex flex-col justify-between gap-1 ${className}`}>
      <div>
        <span className="text-xs text-navy/60 dark:text-silver-muted block">{label}</span>
        <span className="font-serif text-xl tabular-nums text-navy dark:text-cream block">{value}</span>
      </div>
      {caption && (
        <span className="text-[10px] text-navy/50 dark:text-silver-muted/70 leading-tight block mt-0.5">{caption}</span>
      )}
    </div>
  )
}

