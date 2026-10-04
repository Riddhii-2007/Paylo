import { motion, AnimatePresence } from 'motion/react'
import { Button } from './Button'

export function ConfirmDialog({ isOpen, title, description, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, danger = false }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-navy/60 dark:bg-black/80"
            onClick={onCancel}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative bg-cream-surface dark:bg-navy-surface p-6 rounded-2xl shadow-xl w-full max-w-sm border border-navy/10 dark:border-gold/20"
          >
            <h3 className="font-serif text-xl text-navy dark:text-cream mb-2">{title}</h3>
            <p className="text-navy/70 dark:text-silver-muted mb-6 text-sm">{description}</p>
            
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onCancel} className="px-4 py-2">
                {cancelText}
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="px-4 py-2">
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
