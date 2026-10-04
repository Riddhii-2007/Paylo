import { describe, it, expect } from 'vitest'
import { toPaise, formatMoney } from '../lib/format'

describe('Format Logic', () => {
  describe('toPaise', () => {
    it('handles standard amounts', () => {
      expect(toPaise(1234.56)).toBe(123456)
      expect(toPaise(0)).toBe(0)
    })

    it('handles floating point math (0.1 + 0.2)', () => {
      // 0.1 + 0.2 = 0.30000000000000004
      expect(toPaise(0.1 + 0.2)).toBe(30)
    })

    it('handles empty or invalid input', () => {
      expect(toPaise('')).toBe(0)
      expect(toPaise(null)).toBe(0)
      expect(toPaise(undefined)).toBe(0)
      expect(toPaise('abc')).toBe(0)
    })

    it('handles large amounts', () => {
      expect(toPaise(10000000)).toBe(1000000000)
    })
  })

  describe('formatMoney', () => {
    it('formats with default currency', () => {
      // 1234.56 rupees
      expect(formatMoney(123456)).toBe('₹ 1,234.56')
    })
    
    it('drops decimals if whole number', () => {
      expect(formatMoney(123400)).toBe('₹ 1,234')
    })

    it('uses correct Indian comma grouping for large amounts', () => {
      // 10,00,000 rupees
      expect(formatMoney(100000000)).toBe('₹ 10,00,000')
    })

    it('accepts custom currency symbols', () => {
      expect(formatMoney(123456, '$')).toBe('$ 1,234.56')
    })

    it('handles invalid paise values', () => {
      expect(formatMoney(NaN)).toBe('₹ 0')
      expect(formatMoney(null)).toBe('₹ 0')
    })
  })
})
