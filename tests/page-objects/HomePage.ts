import { expect, type Locator, type Page } from '@playwright/test'

export const HOME_MESSAGES = {
  nameRequired: 'Enter a display name.',
  nameTooLong: 'Display name must be 20 characters or fewer.',
  nameTaken: 'That name is already taken in this room.',
  codeRequired: 'Enter the room code.',
  codeFormat: 'Room code must be 6 letters or digits.',
  roomUnavailable: 'Room not found or unreachable. Check the code and try again.',
  connectionTimeout: 'Could not connect in time. Try again.',
  connecting: 'Connecting…',
} as const

export type FormName = 'create' | 'join'

export class HomePage {
  readonly createRegion: Locator
  readonly joinRegion: Locator
  readonly createName: Locator
  readonly createButton: Locator
  readonly joinCode: Locator
  readonly joinName: Locator
  readonly joinButton: Locator

  constructor(readonly page: Page) {
    this.createRegion = page.getByRole('region', { name: 'Create room' })
    this.joinRegion = page.getByRole('region', { name: 'Join room' })
    this.createName = this.createRegion.getByLabel('Display name')
    this.createButton = this.createRegion.getByRole('button', { name: 'Create room' })
    this.joinCode = this.joinRegion.getByLabel('Room code')
    this.joinName = this.joinRegion.getByLabel('Display name')
    this.joinButton = this.joinRegion.getByRole('button', { name: 'Join room' })
  }

  async goto(roomCode?: string) {
    await this.page.goto(roomCode === undefined ? '/' : `/?room=${encodeURIComponent(roomCode)}`)
    await expect(this.createButton).toBeVisible()
  }

  async fillCreate(name: string) {
    await this.createName.fill(name)
  }

  async create(name: string) {
    await this.fillCreate(name)
    await this.createButton.click()
  }

  async fillJoin(code: string, name: string) {
    await this.joinCode.fill(code)
    await this.joinName.fill(name)
  }

  async join(code: string, name: string) {
    await this.fillJoin(code, name)
    await this.joinButton.click()
  }

  region(form: FormName): Locator {
    return form === 'create' ? this.createRegion : this.joinRegion
  }

  connectionStatus(form: FormName): Locator {
    return this.region(form).getByTestId('connection-status')
  }

  formError(form: FormName): Locator {
    return this.region(form).getByTestId('form-error')
  }

  /** Field-level error: shown as an alert and linked to the input through aria-describedby. */
  async expectFieldError(input: Locator, message: string) {
    await expect(input).toHaveAccessibleDescription(message)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  }

  async expectNoFieldError(input: Locator) {
    await expect(input).not.toHaveAttribute('aria-invalid', 'true')
  }

  async expectOnHome() {
    await expect(this.createButton).toBeVisible()
    await expect(this.page.getByTestId('room-code')).toHaveCount(0)
    await expect(this.page.getByTestId('connection-status')).toHaveCount(0)
  }
}
