import { expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import { HomePage } from '../page-objects/HomePage'
import { NO_VOTE, REVEAL_ERROR, RoomPage, WAIT_FOR_REVEAL, WAIT_FOR_REVOTE, type CardValue } from '../page-objects/RoomPage'

interface Player {
  context: BrowserContext
  page: Page
  home: HomePage
  room: RoomPage
  name: string
}

// Every player gets its own browser context so sessionStorage is never shared.
const test = base.extend<{ newPlayer: (name: string) => Promise<Player> }>({
  newPlayer: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (name) => {
      const context = await browser.newContext()
      contexts.push(context)
      const page = await context.newPage()
      return { context, page, home: new HomePage(page), room: new RoomPage(page), name }
    })
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)))
  },
})

type NewPlayer = (name: string) => Promise<Player>

async function hostCreatesRoom(newPlayer: NewPlayer, name = 'Maya') {
  const host = await newPlayer(name)
  await host.home.goto()
  await host.home.create(name)
  const code = await host.room.code()
  return { host, code }
}

async function guestJoins(newPlayer: NewPlayer, code: string, name: string) {
  const guest = await newPlayer(name)
  await guest.home.goto()
  await guest.home.join(code, name)
  await guest.room.expectInRoom(code)
  return guest
}

async function roomWithGuest(newPlayer: NewPlayer) {
  const { host, code } = await hostCreatesRoom(newPlayer, 'Maya')
  const guest = await guestJoins(newPlayer, code, 'Noah')
  await host.room.expectNames(['Maya', 'Noah'])
  return { host, guest }
}

const cast = (player: Player, value: CardValue) => player.room.vote(player.name, value)

/** Marks the page so a later reload is detectable (the marker is lost on navigation). */
const markPage = (page: Page) => page.evaluate(() => ((window as unknown as Record<string, unknown>).__noReload = true))
const expectNoReload = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__noReload)).toBe(true)

async function expectRevealed(...players: Player[]) {
  for (const p of players) await p.room.expectPhase('revealed')
}

test.describe('US-003 reveal and results', () => {
  test('TC-003-01 Host reveals after votes, no reload, cards disabled', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '5')
    await cast(guest, '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
    await markPage(host.page)
    await markPage(guest.page)

    await host.room.reveal()

    await expectRevealed(host, guest)
    await expectNoReload(host.page)
    await expectNoReload(guest.page)
    await expect(host.room.revealButton).toHaveCount(0)
    await expect(host.room.resultsPanel).toBeVisible()
    await expect(guest.room.resultsPanel).toBeVisible()
    await host.room.expectAllCardsDisabled()
    await guest.room.expectAllCardsDisabled()
  })

  test('TC-003-02 Both clients show identical revealed state', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '5')
    await cast(guest, '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')

    await host.room.reveal()
    await expectRevealed(host, guest)

    const expected = { Maya: '5', Noah: '8' }
    const hostCells = await host.room.expectVoteCells(expected)
    const guestCells = await guest.room.expectVoteCells(expected)
    expect(guestCells).toEqual(hostCells)
    for (const p of [host, guest]) {
      await p.room.expectResultGroups([['5', '1 vote'], ['8', '1 vote']])
      await expect(p.room.participation).toHaveText('2 of 2 voted')
    }
  })

  test('TC-003-05 Reveal with no votes is blocked, then works after a vote', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)

    await host.room.reveal()

    await expect(host.room.revealError).toHaveText(REVEAL_ERROR)
    await expect(host.room.revealError).toHaveAttribute('role', 'alert')
    await expect(host.room.revealButton).toHaveAccessibleDescription(REVEAL_ERROR)
    await host.room.expectPhase('voting')
    await guest.room.expectPhase('voting')
    await expect(host.room.resultsPanel).toHaveCount(0)
    await expect(guest.room.resultsPanel).toHaveCount(0)
    await expect(host.room.revealButton).toBeFocused()

    await cast(host, '5')
    await host.room.reveal()

    await expectRevealed(host, guest)
    await expect(host.room.revealError).toHaveCount(0)
  })

  test('TC-003-10 Value, ? and No vote are distinct on every client', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer, 'Maya')
    const noah = await guestJoins(newPlayer, code, 'Noah')
    const linh = await guestJoins(newPlayer, code, 'Linh')
    const all = [host, noah, linh]
    for (const p of all) await p.room.expectNames(['Maya', 'Noah', 'Linh'])
    await cast(host, '0')
    await cast(noah, '?')

    await host.room.reveal()
    await expectRevealed(...all)

    const expected = { Maya: '0', Noah: '?', Linh: NO_VOTE }
    const [hostCells, noahCells, linhCells] = [
      await host.room.expectVoteCells(expected),
      await noah.room.expectVoteCells(expected),
      await linh.room.expectVoteCells(expected),
    ]
    expect(noahCells).toEqual(hostCells)
    expect(linhCells).toEqual(hostCells)
    expect(new Set(Object.values(hostCells)).size).toBe(3)
  })

  test('TC-003-25 Different numeric votes are grouped separately in ascending order', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '8')
    await cast(guest, '5')

    await host.room.reveal()
    await expectRevealed(host, guest)

    await host.room.expectResultGroups([['5', '1 vote'], ['8', '1 vote']])
    await guest.room.expectResultGroups([['5', '1 vote'], ['8', '1 vote']])
  })

  test('TC-003-26 Zero votes are numeric', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '0')
    await cast(guest, '0')

    await host.room.reveal()
    await expectRevealed(host, guest)

    for (const p of [host, guest]) {
      await p.room.expectResultGroups([['0', '2 votes']])
      await p.room.expectVoteCells({ Maya: '0', Noah: '0' })
      await expect(p.room.voteCell('Maya')).not.toHaveText(NO_VOTE)
      await expect(p.room.voteCell('Noah')).not.toHaveText(NO_VOTE)
    }
  })

  test('TC-003-27 All ? is grouped as its own value', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '?')
    await cast(guest, '?')

    await host.room.reveal()
    await expectRevealed(host, guest)

    for (const p of [host, guest]) {
      await p.room.expectResultGroups([['?', '2 votes']])
      await p.room.expectVoteCells({ Maya: '?', Noah: '?' })
    }
  })
})

test.describe('US-003 Host-only controls', () => {
  test('TC-003-08 Guest has no Reveal control', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)

    await expect(guest.room.revealButton).toHaveCount(0)
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVEAL)
    await expect(host.room.revealButton).toBeVisible()

    await cast(host, '5')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
    await expect(guest.room.revealButton).toHaveCount(0)
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVEAL)
    await expect(host.room.revealButton).toBeVisible()
  })

  test('TC-003-32 Guest has no Revote control', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '5')
    await cast(guest, '8')
    await host.room.reveal()
    await expectRevealed(host, guest)

    await expect(guest.room.revoteButton).toHaveCount(0)
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVOTE)
    await expect(host.room.revoteButton).toBeVisible()
  })
})

test.describe('US-003 revote', () => {
  test('TC-003-28 Revote clears the round and allows a new vote', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await cast(host, '5')
    await cast(guest, '8')
    await host.room.reveal()
    await expectRevealed(host, guest)
    await markPage(host.page)
    await markPage(guest.page)

    await host.room.revote()

    for (const p of [host, guest]) {
      await p.room.expectPhase('voting')
      await expect(p.room.voteCell('Maya')).toHaveText('Not voted')
      await expect(p.room.voteCell('Noah')).toHaveText('Not voted')
      await expect(p.room.resultsPanel).toHaveCount(0)
      await p.room.expectAllCardsEnabledAndUnselected()
    }
    await expectNoReload(host.page)
    await expectNoReload(guest.page)

    await cast(host, '3')
    await cast(guest, '3')
    await host.room.reveal()
    await expectRevealed(host, guest)

    for (const p of [host, guest]) {
      await p.room.expectResultGroups([['3', '2 votes']])
      await p.room.expectVoteCells({ Maya: '3', Noah: '3' })
    }
  })

  test('TC-003-38 Host focus moves to the phase heading', async ({ newPlayer }) => {
    const { host, guest } = await roomWithGuest(newPlayer)
    await guest.room.card('3').focus()
    await cast(host, '5')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
    await expect(guest.room.card('3')).toBeFocused()

    await host.room.reveal()
    await expectRevealed(host, guest)
    await expect(host.room.phaseHeading).toBeFocused()
    await expect(guest.room.phaseHeading).not.toBeFocused()

    await host.room.revote()
    await guest.room.expectPhase('voting')
    await expect(host.room.phaseHeading).toBeFocused()
    await expect(guest.room.phaseHeading).not.toBeFocused()

    await guest.room.vote(guest.name, '3')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(host.room.phaseHeading).toBeFocused()
  })
})
