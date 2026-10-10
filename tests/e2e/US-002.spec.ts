import { expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import { HomePage } from '../page-objects/HomePage'
import { CARD_VALUES, RoomPage, VOTE_FAILED_MESSAGE, VOTE_PENDING_MESSAGE } from '../page-objects/RoomPage'

interface Player {
  context: BrowserContext
  page: Page
  home: HomePage
  room: RoomPage
}

// Every player gets its own browser context so sessionStorage is never shared.
const test = base.extend<{ newPlayer: () => Promise<Player> }>({
  newPlayer: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const context = await browser.newContext()
      contexts.push(context)
      const page = await context.newPage()
      return { context, page, home: new HomePage(page), room: new RoomPage(page) }
    })
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)))
  },
})

type NewPlayer = () => Promise<Player>

const record = (type: string, description: string) => test.info().annotations.push({ type, description })

const REALTIME_WS = /realtime\/v1\/websocket/
const ACK_DELAY_MS = 1500

// Toggled at any time during a test; the route reads the flags per frame.
interface FrameFlags {
  dropIntent: boolean
  dropAck: boolean
  delayAck: boolean
}

const frameText = (message: string | Buffer) => (typeof message === 'string' ? message : message.toString('latin1'))

async function controlFrames(page: Page): Promise<FrameFlags> {
  const flags: FrameFlags = { dropIntent: false, dropAck: false, delayAck: false }
  await page.routeWebSocket(REALTIME_WS, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((message) => {
      if (flags.dropIntent && frameText(message).includes('room:vote-intent')) return
      server.send(message)
    })
    server.onMessage((message) => {
      if (frameText(message).includes('room:vote-accepted')) {
        if (flags.dropAck) return
        if (flags.delayAck) {
          setTimeout(() => ws.send(message), ACK_DELAY_MS)
          return
        }
      }
      ws.send(message)
    })
  })
  return flags
}

async function room(newPlayer: NewPlayer, { controlGuest = false, watchHostPending = false } = {}) {
  const host = await newPlayer()
  if (watchHostPending) {
    await host.page.addInitScript((message) => {
      const flagged = window as unknown as { sawPending?: boolean }
      new MutationObserver(() => {
        if (document.body?.textContent?.includes(message)) flagged.sawPending = true
      }).observe(document, { childList: true, subtree: true, characterData: true })
    }, VOTE_PENDING_MESSAGE)
  }
  await host.home.goto()
  await host.home.create('Maya')
  const code = await host.room.code()

  const guest = await newPlayer()
  const flags = controlGuest ? await controlFrames(guest.page) : undefined
  await guest.home.goto()
  await guest.home.join(code, 'Noah')
  await guest.room.expectInRoom(code)
  await Promise.all([host, guest].map((player) => player.room.expectNames(['Maya', 'Noah'])))
  await Promise.all([host, guest].map((player) => expect(player.room.phase).toHaveText('voting')))
  return { host, guest, flags: flags as FrameFlags }
}

const CARD_TEXT = /\b(?:0|1|2|3|5|8|13|21)\b|\?/

test.describe('US-002 AC-002-01 fixed voting cards', () => {
  test('TC-002-01 Host and Guest see the same nine cards in order', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer)

    for (const { room: view } of [host, guest]) {
      await expect.poll(() => view.cardLabels()).toEqual([...CARD_VALUES])
      await view.expectCardsEnabled(true)
      await view.expectPressed(null)
      await expect(view.cardGroup.getByRole('textbox')).toHaveCount(0)
      await expect(view.cardGroup.locator('input')).toHaveCount(0)
    }
  })
})

test.describe('US-002 AC-002-02 select and change a vote', () => {
  test('TC-002-03 Guest selects a card and the vote is confirmed', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer)
    await guest.room.card('5').click()

    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')
    await expect(guest.room.voteCell('Noah')).toHaveText('Voted')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(host.room.voteCell('Maya')).toHaveText('Not voted')
    await expect(host.room.row('Noah')).not.toHaveText(CARD_TEXT)
    await expect(guest.room.row('Maya')).not.toHaveText(CARD_TEXT)
    await guest.room.expectNoVoteFeedback()
  })

  test('TC-002-04 Host votes with its own card', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer, { watchHostPending: true })
    await host.room.card('8').click()

    await host.room.expectPressed('8')
    await expect(host.room.voteCell('Maya')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
    await expect(guest.room.voteCell('Noah')).toHaveText('Not voted')
    await host.room.expectNoVoteFeedback()
    const sawPending = await host.page.evaluate(() => (window as unknown as { sawPending?: boolean }).sawPending)
    expect(sawPending).toBeFalsy()
  })

  test('TC-002-05 Guest changes the vote before reveal', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer)
    await guest.room.card('5').click()
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')

    await guest.room.card('8').click()
    await guest.room.expectPressed('8')
    await expect(guest.room.voteCell('Noah')).toHaveText('Voted')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await guest.room.expectNoVoteFeedback()
    // One vote, not two: still exactly one voted row for the Guest.
    await expect(host.room.playersList.getByText('Voted', { exact: true })).toHaveCount(1)
  })

  test('TC-002-06 Sending vote is shown while the acknowledgement is delayed', async ({ newPlayer }) => {
    const { guest, flags } = await room(newPlayer, { controlGuest: true })
    flags.delayAck = true
    await guest.room.card('5').click()

    await expect(guest.room.voteStatus).toHaveText(VOTE_PENDING_MESSAGE)
    await expect(guest.room.card('5')).toHaveAttribute('data-selection', 'pending')
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'false')
    await guest.room.expectCardsEnabled(false)

    await expect(guest.room.voteStatus).toHaveCount(0)
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')
    await expect(guest.room.card('5')).not.toHaveAttribute('data-selection', /.+/)
    await guest.room.expectCardsEnabled(true)
  })

  test('TC-002-07 Cards are selectable by keyboard', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer)

    await guest.room.card('3').focus()
    await guest.page.keyboard.press('Enter')
    await guest.room.expectPressed('3')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')

    await guest.room.card('13').focus()
    await guest.page.keyboard.press('Space')
    await guest.room.expectPressed('13')
  })
})

test.describe('US-002 AC-002-03 vote values stay hidden', () => {
  test('TC-002-13 Others see only status and the own selection is visible', async ({ newPlayer }) => {
    const { host, guest } = await room(newPlayer)

    await guest.room.card('5').click()
    await guest.room.expectPressed('5')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Not voted')

    await host.room.card('13').click()
    await host.room.expectPressed('13')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')

    for (const [viewer, other] of [
      [host, 'Noah'],
      [guest, 'Maya'],
    ] as const) {
      await expect(viewer.room.voteCell(other)).toHaveText('Voted')
      await expect(viewer.room.row(other)).not.toHaveText(CARD_TEXT)
    }
    await guest.room.expectPressed('5')
  })

  test('TC-002-14 A pending selection is not an accepted vote', async ({ newPlayer }) => {
    const { host, guest, flags } = await room(newPlayer, { controlGuest: true })
    flags.dropIntent = true
    await guest.room.card('8').click()

    await expect(guest.room.card('8')).toHaveAttribute('data-selection', 'pending')
    await expect(guest.room.card('8')).toHaveAttribute('aria-pressed', 'false')
    await expect(guest.room.voteCell('Noah')).toHaveText('Not voted')
    await expect(host.room.voteCell('Noah')).toHaveText('Not voted')

    // Absence of an accepted vote can only be observed over a time window (before the 5 s failure).
    await guest.page.waitForTimeout(2000)
    await expect(guest.room.card('8')).toHaveAttribute('data-selection', 'pending')
    await expect(guest.room.voteCell('Noah')).toHaveText('Not voted')
    await expect(host.room.voteCell('Noah')).toHaveText('Not voted')
  })
})

test.describe('US-002 AC-002-04 vote not confirmed', () => {
  test('TC-002-16 Intent never reaches the Host, then Retry', async ({ newPlayer }) => {
    const { host, guest, flags } = await room(newPlayer, { controlGuest: true })
    flags.dropIntent = true

    const start = Date.now()
    await guest.room.card('8').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    const elapsed = Date.now() - start
    record('vote-not-confirmed-ms', String(elapsed))
    expect.soft(elapsed, 'vote failure expected at about 5 s').toBeGreaterThanOrEqual(4000)
    expect.soft(elapsed, 'vote failure expected at about 5 s').toBeLessThanOrEqual(7000)

    await expect(guest.room.card('8')).toHaveAttribute('data-selection', 'failed')
    await expect(guest.room.card('8')).toHaveAttribute('aria-pressed', 'false')
    await expect(guest.room.retry).toBeVisible()
    await expect(host.room.voteCell('Noah')).toHaveText('Not voted')

    flags.dropIntent = false
    await guest.room.retry.click()
    await guest.room.expectPressed('8')
    await expect(guest.room.voteError).toHaveCount(0)
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
  })

  test('TC-002-17 Replacement vote fails, then Retry', async ({ newPlayer }) => {
    const { host, guest, flags } = await room(newPlayer, { controlGuest: true })
    await guest.room.card('5').click()
    await guest.room.expectPressed('5')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')

    flags.dropIntent = true
    await guest.room.card('8').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    await expect(guest.room.card('8')).toHaveAttribute('data-selection', 'failed')
    await expect(guest.room.card('8')).toHaveAttribute('aria-pressed', 'false')
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')

    flags.dropIntent = false
    await guest.room.retry.click()
    await guest.room.expectPressed('8')
    await expect(guest.room.voteError).toHaveCount(0)
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
  })

  test('TC-002-18 Ack lost, Retry resends the same card', async ({ newPlayer }) => {
    const { host, guest, flags } = await room(newPlayer, { controlGuest: true })
    flags.dropAck = true

    const start = Date.now()
    await guest.room.card('5').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    record('ack-lost-ms', String(Date.now() - start))
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'false')
    // The Host may have stored the vote; record what it shows.
    record('host-row-after-lost-ack', (await host.room.voteCell('Noah').innerText()).trim())

    flags.dropAck = false
    await guest.room.retry.click()
    await guest.room.expectPressed('5')
    await expect(guest.room.voteError).toHaveCount(0)
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(host.room.playersList.getByText('Voted', { exact: true })).toHaveCount(1)
  })
})
