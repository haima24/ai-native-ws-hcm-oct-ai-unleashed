import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTheme, initTheme, setTheme } from './themeStore'
import { DEFAULT_THEME, isTheme, readStoredTheme, THEME_STORAGE_KEY, THEMES } from './themes'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('themes', () => {
  it('offers the six themes in order', () => {
    expect(THEMES.map((t) => t.label)).toEqual(['Vintage', 'Light', 'Dark', 'Ocean', 'Sunny', 'Forest'])
    expect(DEFAULT_THEME).toBe('vintage')
  })

  it('accepts only known theme ids', () => {
    for (const { id } of THEMES) expect(isTheme(id)).toBe(true)
    for (const bad of ['', 'Dark', ' dark', 'neon', null, undefined, 5]) expect(isTheme(bad)).toBe(false)
  })

  it('falls back to the default for missing or invalid stored values', () => {
    expect(readStoredTheme()).toBe('vintage')
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    expect(readStoredTheme()).toBe('vintage')
    localStorage.setItem(THEME_STORAGE_KEY, 'ocean')
    expect(readStoredTheme()).toBe('ocean')
  })

  it('falls back to the default when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredTheme()).toBe('vintage')
  })

  it('keeps the first-paint script in index.html in sync with THEMES', () => {
    const html = readFileSync('index.html', 'utf8')
    const listed = html.match(/\[([^\]]*)\]\.indexOf/)?.[1].match(/'([a-z]+)'/g)?.map((s) => s.replaceAll("'", ''))
    expect(listed).toEqual(THEMES.map((t) => t.id))
    expect(html).toContain(THEME_STORAGE_KEY)
  })
})

describe('themeStore', () => {
  it('applies and stores a chosen theme', () => {
    setTheme('forest')
    expect(getTheme()).toBe('forest')
    expect(document.documentElement.dataset.theme).toBe('forest')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('forest')
  })

  it('ignores an unknown theme', () => {
    setTheme('dark')
    setTheme('neon')
    expect(getTheme()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('restores the stored theme on init and defaults when none is stored', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sunny')
    initTheme()
    expect(getTheme()).toBe('sunny')
    expect(document.documentElement.dataset.theme).toBe('sunny')

    localStorage.clear()
    initTheme()
    expect(getTheme()).toBe('vintage')
  })

  it('still switches in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setTheme('ocean')).not.toThrow()
    expect(getTheme()).toBe('ocean')
    expect(document.documentElement.dataset.theme).toBe('ocean')
  })
})
