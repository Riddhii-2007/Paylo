import { describe, it, expect } from 'vitest'
import { saveCategory, DEFAULT_CATEGORIES, resolveCategory, renameCategory, deleteCategoryAndReassign } from '../lib/categories'

describe('saveCategory', () => {
  it('creates a new category when it does not exist', () => {
    const { categoryId, updatedCategories } = saveCategory('Travelling', '✈️', DEFAULT_CATEGORIES)
    expect(categoryId).toBe('travelling')
    expect(updatedCategories).toHaveLength(DEFAULT_CATEGORIES.length + 1)
    
    const newCat = updatedCategories.find(c => c.id === 'travelling')
    expect(newCat).toEqual({ id: 'travelling', name: 'Travelling', emoji: '✈️' })
  })

  it('reuses duplicate name (case-insensitive) instead of creating duplicate', () => {
    const initial = saveCategory('Travelling', '✈️', DEFAULT_CATEGORIES).updatedCategories
    const { categoryId, updatedCategories } = saveCategory('  tRaVeLliNg ', '🌍', initial)
    
    expect(categoryId).toBe('travelling')
    expect(updatedCategories).toBe(initial) // no new category added
  })

  it('enforces name length limits (1-24 characters)', () => {
    expect(() => saveCategory('', '🤷', DEFAULT_CATEGORIES)).toThrow()
    expect(() => saveCategory('   ', '🤷', DEFAULT_CATEGORIES)).toThrow()
    expect(() => saveCategory('ThisCategoryNameIsWayTooLongToBeValid', '🤷', DEFAULT_CATEGORIES)).toThrow()
  })

  it('resolves custom categories correctly', () => {
    const categories = [...DEFAULT_CATEGORIES, { id: 'gaming', name: 'Gaming', emoji: '🎮' }]
    const resolved = resolveCategory('gaming', categories)
    expect(resolved.emoji).toBe('🎮')
    expect(resolved.name).toBe('Gaming')
  })
})

describe('renameCategory', () => {
  it('renames a category and trims the new name', () => {
    const cats = [{ id: 'food', name: 'Food', emoji: '🍔' }]
    const updated = renameCategory('food', '  Groceries ', '🛒', cats)
    expect(updated[0].name).toBe('Groceries')
    expect(updated[0].emoji).toBe('🛒')
  })

  it('rejects duplicate names', () => {
    const cats = [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'transport', name: 'Transport', emoji: '🚌' }
    ]
    expect(() => renameCategory('food', 'transport', '🍔', cats)).toThrow()
  })

  it('allows renaming to the same name (case change)', () => {
    const cats = [{ id: 'food', name: 'Food', emoji: '🍔' }]
    const updated = renameCategory('food', 'FOOD', '🍔', cats)
    expect(updated[0].name).toBe('FOOD')
  })
})

describe('deleteCategoryAndReassign', () => {
  it('deletes the category and reassigns expenses to chosen target', () => {
    const cats = [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'other', name: 'Other', emoji: '✨' },
      { id: 'shopping', name: 'Shopping', emoji: '🛍️' }
    ]
    const exps = [
      { id: 1, categoryId: 'food', amount: 100 },
      { id: 2, categoryId: 'food', amount: 200 },
      { id: 3, categoryId: 'other', amount: 50 }
    ]

    const result = deleteCategoryAndReassign('food', 'shopping', cats, exps)
    expect(result.updatedCategories).toHaveLength(2)
    expect(result.updatedCategories.find(c => c.id === 'food')).toBeUndefined()

    expect(result.updatedExpenses).toHaveLength(3)
    expect(result.updatedExpenses.find(e => e.id === 1).categoryId).toBe('shopping')
    expect(result.updatedExpenses.find(e => e.id === 2).categoryId).toBe('shopping')
    expect(result.updatedExpenses.find(e => e.id === 3).categoryId).toBe('other')
  })

  it('moves to Other by default if target is other', () => {
    const cats = [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'other', name: 'Other', emoji: '✨' }
    ]
    const exps = [{ id: 1, categoryId: 'food', amount: 100 }]
    const result = deleteCategoryAndReassign('food', 'other', cats, exps)
    expect(result.updatedExpenses[0].categoryId).toBe('other')
  })

  it('handles deleting a category with zero expenses', () => {
    const cats = [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'other', name: 'Other', emoji: '✨' }
    ]
    const exps = [{ id: 1, categoryId: 'other', amount: 100 }]
    
    const result = deleteCategoryAndReassign('food', 'other', cats, exps)
    expect(result.updatedCategories).toHaveLength(1)
    expect(result.updatedExpenses[0].categoryId).toBe('other') // unmodified
  })
})
