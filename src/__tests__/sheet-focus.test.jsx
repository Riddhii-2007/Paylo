import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { BottomSheet } from '../components/layout/BottomSheet'
import { Input } from '../components/ui/Input'

describe('BottomSheet Focus Stability', () => {
  it('keeps focus on the active input when typing multiple characters (does not steal focus)', async () => {
    vi.useFakeTimers()

    function TestSheetComponent() {
      const [isOpen, setIsOpen] = useState(true)
      const [date, setDate] = useState('2026-10-01')
      const [amount, setAmount] = useState('')

      return (
        <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <Input 
            label="Start Date" 
            type="text" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
          />
          <Input 
            label="Amount Received" 
            type="text" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
          />
        </BottomSheet>
      )
    }

    const { container } = render(<TestSheetComponent />)

    // Let the initial open focus effect run
    act(() => {
      vi.advanceTimersByTime(100)
    })

    const inputs = container.querySelectorAll('input')
    const dateInput = inputs[0]
    const amountInput = inputs[1]

    // User explicitly focuses and types into Amount Received
    amountInput.focus()
    expect(document.activeElement).toBe(amountInput)

    // Type 4 characters one by one with timer advancement (simulating typing in real UI)
    const chars = ['3', '3', '4', '5']
    let currentVal = ''
    for (const char of chars) {
      currentVal += char
      act(() => {
        fireEvent.change(amountInput, { target: { value: currentVal } })
      })
      // Advance timers so any re-triggered focus timer would fire
      act(() => {
        vi.advanceTimersByTime(60)
      })
      // Assert that focus has NOT been stolen back to the first input (Start Date)
      expect(document.activeElement).toBe(amountInput)
    }

    vi.useRealTimers()
  })
})
