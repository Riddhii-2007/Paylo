export function Input({ label, type = 'text', error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <label className="text-sm text-navy/70 dark:text-silver-muted">{label}</label>}
      <input
        type={type}
        className={`bg-transparent border-b ${error ? 'border-terracotta text-terracotta' : 'border-gold/30 dark:border-gold/30 focus:border-gold dark:focus:border-gold'} 
          py-2 font-sans text-lg text-navy dark:text-cream focus:outline-none transition-colors w-full`}
        {...props}
      />
      {(error && typeof error === 'string') && <span className="text-xs text-terracotta">{error}</span>}
    </div>
  )
}
