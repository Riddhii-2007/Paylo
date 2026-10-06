import { BottomSheet } from './layout/BottomSheet'

export function PayDayPickerSheet({ isOpen, onClose, onSelect, selectedDay }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-[70vh]">
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-4">Select Pay Day</h3>
        
        <div className="flex-1 overflow-y-auto mb-4 border border-navy/10 dark:border-gold/20 rounded-xl">
          {days.map(day => (
            <button
              key={day}
              onClick={() => { onSelect(day); onClose() }}
              className={`w-full text-left px-4 py-3 border-b border-navy/5 dark:border-gold/10 hover:bg-navy/5 dark:hover:bg-gold/10 transition-colors flex items-center justify-between last:border-b-0 ${selectedDay === day ? 'bg-navy/5 dark:bg-gold/10 font-bold' : ''}`}
            >
              <span className={`font-medium ${selectedDay === day ? 'text-navy dark:text-gold' : 'text-navy dark:text-cream'}`}>{day}</span>
            </button>
          ))}
          <button
            onClick={() => { onSelect('last'); onClose() }}
            className={`w-full text-left px-4 py-3 hover:bg-navy/5 dark:hover:bg-gold/10 transition-colors flex items-center justify-between ${selectedDay === 'last' ? 'bg-navy/5 dark:bg-gold/10 font-bold' : ''}`}
          >
            <span className={`font-medium ${selectedDay === 'last' ? 'text-navy dark:text-gold' : 'text-navy dark:text-cream'}`}>Last day of the month</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
