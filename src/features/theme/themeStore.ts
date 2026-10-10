import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME, isTheme, readStoredTheme, storeTheme, type ThemeId } from './themes'

const listeners = new Set<() => void>()
let current: ThemeId = DEFAULT_THEME

const apply = (id: ThemeId) => {
  document.documentElement.dataset.theme = id
}

export const initTheme = () => {
  current = readStoredTheme()
  apply(current)
}

export const getTheme = (): ThemeId => current

export const setTheme = (id: unknown) => {
  if (!isTheme(id)) return
  current = id
  apply(id)
  storeTheme(id)
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useTheme = (): ThemeId => useSyncExternalStore(subscribe, getTheme, getTheme)
