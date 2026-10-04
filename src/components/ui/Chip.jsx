import { motion } from 'motion/react'

export function Chip({ selected, label, emoji, onClick, className = '' }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-4 py-2 rounded-full font-sans text-sm border transition-colors flex items-center gap-2
        ${selected 
          ? 'bg-navy border-navy text-cream dark:bg-gold dark:border-gold dark:text-navy' 
          : 'bg-transparent border-navy/20 dark:border-gold/20 text-navy dark:text-cream hover:bg-navy/5 dark:hover:bg-gold/10'
        } ${className}`}
    >
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </motion.button>
  )
}
