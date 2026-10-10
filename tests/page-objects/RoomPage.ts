import { expect, type Locator, type Page } from '@playwright/test'

export const HOST_LEFT_MESSAGE = 'The Host closed the room. Return to Home to start or join another room.'
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export class RoomPage {
  readonly roomCode: Locator
  readonly phase: Locator
  readonly copyLink: Locator
  readonly playersHeading: Locator
  readonly playersList: Locator
  readonly hostLeftAlert: Locator
  readonly returnHome: Locator

  constructor(readonly page: Page) {
    this.roomCode = page.getByTestId('room-code')
    this.phase = page.getByTestId('room-phase')
    this.copyLink = page.getByRole('button', { name: 'Copy link' })
    this.playersHeading = page.getByRole('heading', { name: /^Players \(\d+\)$/ })
    this.playersList = page.getByTestId('players-list')
    this.hostLeftAlert = page.getByRole('alert').filter({ hasText: HOST_LEFT_MESSAGE })
    this.returnHome = page.getByRole('button', { name: 'Return to Home' })
  }

  /** Room code shown in the header; waits until the room shell is open. */
  async code(): Promise<string> {
    await expect(this.roomCode).toBeVisible()
    return (await this.roomCode.innerText()).trim()
  }

  async expectInRoom(code?: string) {
    if (code === undefined) await expect(this.roomCode).toHaveText(ROOM_CODE_PATTERN)
    else await expect(this.roomCode).toHaveText(code)
  }

  /** Row for a participant name; anchored so `Maya` does not match `Maya2`. */
  row(name: string): Locator {
    return this.playersList.getByRole('listitem').filter({ hasText: new RegExp(`^${escapeRegExp(name)}(?: ·|$)`) })
  }

  async names(): Promise<string[]> {
    const rows = await this.playersList.getByRole('listitem').allInnerTexts()
    return rows.map((text) => text.split(' · ')[0].trim())
  }

  async expectPlayerCount(count: number) {
    await expect(this.playersHeading).toHaveText(`Players (${count})`)
    await expect(this.playersList.getByRole('listitem')).toHaveCount(count)
  }

  /** Order is not asserted. */
  async expectNames(names: string[]) {
    await expect.poll(async () => (await this.names()).sort()).toEqual([...names].sort())
    await this.expectPlayerCount(names.length)
  }

  async expectHostLeft() {
    await expect(this.hostLeftAlert).toBeVisible()
    await expect(this.returnHome).toBeVisible()
    await expect(this.playersList).toHaveCount(0)
  }
}
