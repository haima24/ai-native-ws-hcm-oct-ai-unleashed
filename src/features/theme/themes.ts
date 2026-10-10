export const THEMES = [
  { id: 'vintage', label: 'Vintage' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunny', label: 'Sunny' },
  { id: 'forest', label: 'Forest' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'vintage'
export const THEME_STORAGE_KEY = 'story-pointing:theme'

export const isTheme = (value: unknown): value is ThemeId => THEMES.some((theme) => theme.id === value)

export const themeLabel = (id: ThemeId): string => THEMES.find((theme) => theme.id === id)?.label ?? ''

export const readStoredTheme = (): ThemeId => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export const storeTheme = (id: ThemeId) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // Storage is a convenience only.
  }
}
