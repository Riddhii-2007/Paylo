import { HomeIcon, HistoryIcon, SettingsIcon } from '../icons'

export function BottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-cream/90 dark:bg-navy/90 backdrop-blur-md border-t border-navy/10 dark:border-gold/20 pb-safe z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-4">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
                isActive ? 'text-gold-dark dark:text-gold' : 'text-navy/50 dark:text-silver-muted hover:text-navy/80 dark:hover:text-silver'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-sans font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
