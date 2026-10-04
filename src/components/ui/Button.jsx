import { motion } from 'motion/react'

export function Button({ 
  children, 
  variant = 'primary', // 'primary', 'secondary', 'danger', 'ghost'
  className = '', 
  onClick, 
  disabled = false,
  ...props 
}) {
  let baseClasses = "px-6 py-3 rounded-xl font-sans font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 dark:focus:ring-offset-navy flex items-center justify-center gap-2 "
  
  if (variant === 'primary') {
    baseClasses += "bg-navy dark:bg-gold text-cream dark:text-navy hover:bg-navy-surface dark:hover:bg-cream"
  } else if (variant === 'secondary') {
    baseClasses += "border border-gold text-navy dark:text-gold hover:bg-cream-surface dark:hover:bg-navy-surface"
  } else if (variant === 'danger') {
    baseClasses += "bg-terracotta dark:bg-terracotta text-white hover:bg-terracotta-dark"
  } else if (variant === 'ghost') {
    baseClasses += "text-navy dark:text-cream hover:bg-cream-surface dark:hover:bg-navy-surface"
  }
  
  if (disabled) {
    baseClasses += " opacity-50 cursor-not-allowed"
  }

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${baseClasses} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}
