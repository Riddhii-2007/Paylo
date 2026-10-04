export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', emoji: '🍔' },
  { id: 'transport', name: 'Transport', emoji: '🚌' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️' },
  { id: 'bills', name: 'Bills', emoji: '📄' },
  { id: 'other', name: 'Other', emoji: '✨' },
]

export function resolveCategory(categoryId, categories = []) {
  if (!categories || categories.length === 0) categories = DEFAULT_CATEGORIES
  return categories.find(c => c.id === categoryId) || { id: categoryId, name: categoryId, emoji: '✨' }
}

export function saveCategory(name, emoji, currentCategories) {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 24) {
    throw new Error('Name must be 1-24 characters')
  }
  
  const lower = trimmed.toLowerCase()
  const existing = currentCategories.find(c => c.name.toLowerCase() === lower || c.id === lower)
  
  if (existing) {
    return { categoryId: existing.id, updatedCategories: currentCategories }
  }
  
  const newId = lower.replace(/\s+/g, '-')
  const newCat = { id: newId, name: trimmed, emoji: emoji || '✨' }
  return { categoryId: newId, updatedCategories: [...currentCategories, newCat] }
}
