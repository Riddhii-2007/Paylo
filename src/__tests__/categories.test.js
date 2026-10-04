import { describe, it, expect } from 'vitest'
import { saveCategory, DEFAULT_CATEGORIES, resolveCategory } from '../lib/categories'

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
