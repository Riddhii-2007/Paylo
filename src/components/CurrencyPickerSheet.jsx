import { useState, useMemo } from 'react'
import { BottomSheet } from './layout/BottomSheet'
import { Input } from './ui/Input'

const SUPPORTED_CURRENCIES = (() => {
  try {
    const codes = Intl.supportedValuesOf('currency')
    const names = new Intl.DisplayNames(['en'], { type: 'currency' })
    return codes.map(code => {
      let symbol = code
      try {
        const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(0)
        const symPart = parts.find(p => p.type === 'currency')
        if (symPart) symbol = symPart.value
      } catch (e) {}
      return { code, name: names.of(code), symbol }
    })
  } catch (e) {
    return []
  }
})()

export function CurrencyPickerSheet({ isOpen, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [custom, setCustom] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return SUPPORTED_CURRENCIES.filter(c => 
      c.code.toLowerCase().includes(q) || 
      (c.name && c.name.toLowerCase().includes(q)) || 
      c.symbol.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-[70vh]">
        <h3 className="font-serif text-2xl text-navy dark:text-gold mb-4">Select Currency</h3>
        
        <Input 
          placeholder="Search currencies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-4"
        />

        <div className="flex-1 overflow-y-auto mb-4 border border-navy/10 dark:border-gold/20 rounded-xl">
          {filtered.length > 0 ? (
            filtered.map(c => (
              <button
                key={c.code}
                onClick={() => { onSelect(c.symbol); onClose() }}
                className="w-full text-left px-4 py-3 border-b border-navy/5 dark:border-gold/10 hover:bg-navy/5 dark:hover:bg-gold/10 transition-colors flex items-center justify-between last:border-b-0"
              >
                <div>
                  <span className="font-medium text-navy dark:text-cream">{c.code}</span>
                  <span className="text-navy/50 dark:text-silver-muted text-sm ml-2">{c.name}</span>
                </div>
                <span className="font-medium text-navy/70 dark:text-gold">{c.symbol}</span>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-navy/50 dark:text-silver-muted">
              No results found.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-navy/10 dark:border-gold/20 flex gap-2">
          <Input 
            placeholder="Custom symbol..."
            value={custom}
            onChange={e => setCustom(e.target.value)}
            className="flex-1"
          />
          <button 
            onClick={() => { if (custom) { onSelect(custom); onClose() } }}
            disabled={!custom}
            className="bg-navy dark:bg-gold text-cream dark:text-navy px-4 rounded-xl disabled:opacity-50"
          >
            Use
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
