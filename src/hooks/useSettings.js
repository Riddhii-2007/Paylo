import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export function useSettings() {
  const settingsArray = useLiveQuery(() => db.settings.toArray())
  
  if (!settingsArray) return { loading: true, settings: {} }
  
  const settings = settingsArray.reduce((acc, curr) => {
    acc[curr.key] = curr.value
    return acc
  }, {})
  
  return { loading: false, settings }
}

export async function updateSetting(key, value) {
  await db.settings.put({ key, value })
}

export async function updateSettings(updates) {
  const arr = Object.entries(updates).map(([key, value]) => ({ key, value }))
  await db.settings.bulkPut(arr)
}
