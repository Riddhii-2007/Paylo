import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaReloadToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  if (!needRefresh) return null

  return (
    <aside 
      role="alert" 
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-navy text-cream dark:bg-gold dark:text-navy p-4 rounded-2xl shadow-2xl border border-gold/30 flex items-center justify-between gap-3"
    >
      <span className="text-sm font-medium">A new version is available.</span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 bg-gold text-navy dark:bg-navy dark:text-cream rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
          aria-label="Reload to update version"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="px-2 py-1.5 text-cream/70 dark:text-navy/70 text-xs hover:text-cream dark:hover:text-navy"
          aria-label="Dismiss update"
        >
          ✕
        </button>
      </div>
    </aside>
  )
}
