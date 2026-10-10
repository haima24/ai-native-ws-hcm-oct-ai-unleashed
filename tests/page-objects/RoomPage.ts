import { expect, type Locator, type Page } from '@playwright/test'

export const HOST_LEFT_MESSAGE = 'The Host closed the room. Return to Home to start or join another room.'
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21', '?'] as const
export const VOTE_PENDING_MESSAGE = 'Sending vote…'
export const VOTE_FAILED_MESSAGE = 'Vote was not confirmed. Try again.'
export type CardValue = (typeof CARD_VALUES)[number]
export const WAIT_FOR_REVEAL = 'Waiting for Host to reveal.'
export const WAIT_FOR_REVOTE = 'Waiting for Host to start a revote.'
export const REVEAL_ERROR = 'At least one vote is required to reveal'
export const NO_VOTE = 'No vote'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export class RoomPage {
  readonly roomCode: Locator
  readonly phase: Locator
  readonly copyLink: Locator
  readonly playersHeading: Locator
  readonly playersList: Locator
  readonly hostLeftAlert: Locator
  readonly returnHome: Locator
  readonly revealButton: Locator
  readonly revoteButton: Locator
  readonly revealError: Locator
  readonly phaseWaiting: Locator
  readonly phaseHeading: Locator
  readonly resultsPanel: Locator
  readonly resultGroups: Locator
  readonly participation: Locator
  readonly cardButtons: Locator
  readonly cardGroup: Locator
  readonly voteStatus: Locator
  readonly voteError: Locator
  readonly retry: Locator

  constructor(readonly page: Page) {
    this.roomCode = page.getByTestId('room-code')
    this.phase = page.getByTestId('room-phase')
    this.copyLink = page.getByRole('button', { name: 'Copy link' })
    this.playersHeading = page.getByRole('heading', { name: /^Players \(\d+\)$/ })
    this.playersList = page.getByTestId('players-list')
    this.hostLeftAlert = page.getByRole('alert').filter({ hasText: HOST_LEFT_MESSAGE })
    this.returnHome = page.getByRole('button', { name: 'Return to Home' })
    this.revealButton = page.getByRole('button', { name: 'Reveal estimates' })
    this.revoteButton = page.getByRole('button', { name: 'Revote' })
    this.revealError = page.getByTestId('reveal-error')
    this.phaseWaiting = page.getByTestId('phase-waiting')
    this.phaseHeading = page.getByTestId('phase-heading')
    this.resultsPanel = page.getByTestId('results-panel')
    this.resultGroups = page.getByTestId('results-group')
    this.participation = page.getByTestId('results-participation')
    this.cardButtons = page.getByTestId('vote-cards').getByRole('button')
    this.cardGroup = page.getByRole('group', { name: 'Voting cards' })
    this.voteStatus = page.getByTestId('vote-status')
    this.voteError = page.getByTestId('vote-error')
    this.retry = page.getByRole('button', { name: 'Retry' })
  }

  card(value: CardValue): Locator {
    return this.cardGroup.getByRole('button', { name: value, exact: true })
  }

  async cardLabels(): Promise<string[]> {
    const labels = await this.cardGroup.getByRole('button').allInnerTexts()
    return labels.map((label) => label.trim())
  }

  /** Only `value` is `aria-pressed=true`; `null` means no card is pressed. */
  async expectPressed(value: CardValue | null) {
    for (const card of CARD_VALUES) await expect(this.card(card)).toHaveAttribute('aria-pressed', String(card === value))
  }

  async expectCardsEnabled(enabled: boolean) {
    for (const card of CARD_VALUES) {
      if (enabled) await expect(this.card(card)).toBeEnabled()
      else await expect(this.card(card)).toBeDisabled()
    }
  }

  async expectNoVoteFeedback() {
    await expect(this.voteStatus).toHaveCount(0)
    await expect(this.voteError).toHaveCount(0)
    await expect(this.retry).toHaveCount(0)
  }

  /** Roster cell of one participant: Voted / Not voted while voting, value / ? / No vote once revealed. */
  voteCell(name: string): Locator {
    return this.row(name).getByTestId('player-vote')
  }

  /** Clicks a card and waits until the own row shows `Voted`. */
  async vote(ownName: string, value: CardValue) {
    await this.card(value).click()
    await expect(this.voteCell(ownName)).toHaveText('Voted')
  }

  async reveal() {
    await this.revealButton.click()
  }

  async revote() {
    await this.revoteButton.click()
  }

  async expectPhase(phase: 'voting' | 'revealed') {
    await expect(this.phase).toHaveText(phase)
  }

  async expectAllCardsDisabled() {
    await expect(this.cardButtons).toHaveCount(CARD_VALUES.length)
    for (const value of CARD_VALUES) await expect(this.card(value)).toBeDisabled()
  }

  async expectAllCardsEnabledAndUnselected() {
    await expect(this.cardButtons).toHaveCount(CARD_VALUES.length)
    for (const value of CARD_VALUES) {
      await expect(this.card(value)).toBeEnabled()
      await expect(this.card(value)).toHaveAttribute('aria-pressed', 'false')
    }
  }

  /** D-024: one entry per cast card value, numeric ascending with `?` last, e.g. `['5', '1 vote']`. */
  async expectResultGroups(expected: [CardValue, string][]) {
    await expect(this.resultsPanel).toBeVisible()
    await expect(this.resultGroups).toHaveCount(expected.length)
    for (const [index, [card, count]] of expected.entries()) {
      const group = this.resultGroups.nth(index)
      await expect(group).toContainText(card)
      await expect(group.getByTestId('results-group-count')).toHaveText(count)
    }
  }

  /** Roster cell text per name; order is not asserted. */
  async voteCells(names: string[]): Promise<Record<string, string>> {
    const cells: Record<string, string> = {}
    for (const name of names) cells[name] = (await this.voteCell(name).innerText()).trim()
    return cells
  }

  /** Waits for the expected cells, then returns them for cross-client comparison. */
  async expectVoteCells(expected: Record<string, string>) {
    for (const [name, text] of Object.entries(expected)) await expect(this.voteCell(name)).toHaveText(text)
    return this.voteCells(Object.keys(expected))
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
