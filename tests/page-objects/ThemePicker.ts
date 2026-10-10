import { expect, type Locator, type Page } from '@playwright/test'

export const THEME_NAMES = ['Vintage', 'Light', 'Dark', 'Ocean', 'Sunny', 'Forest'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export const themeStatusText = (name: ThemeName) => `Theme set to ${name}.`

export class ThemePicker {
  readonly group: Locator
  readonly radios: Locator
  readonly status: Locator

  constructor(readonly page: Page) {
    this.group = page.getByRole('group', { name: 'Theme', exact: true })
    this.radios = this.group.getByRole('radio')
    this.status = page.getByTestId('theme-status')
  }

  radio(name: ThemeName): Locator {
    return this.group.getByRole('radio', { name, exact: true })
  }

  /** The visible choice: the radio itself is visually hidden, so clicks go to its label. */
  label(name: ThemeName): Locator {
    return this.group.locator('label').filter({ hasText: name })
  }

  async names(): Promise<string[]> {
    const labels = await this.group.locator('label').allInnerTexts()
    return labels.map((text) => text.trim())
  }

  async choose(name: ThemeName) {
    await this.label(name).click()
    await expect(this.radio(name)).toBeChecked()
  }

  async expectSelected(name: ThemeName) {
    for (const other of THEME_NAMES) {
      if (other === name) await expect(this.radio(other)).toBeChecked()
      else await expect(this.radio(other)).not.toBeChecked()
    }
  }
}
