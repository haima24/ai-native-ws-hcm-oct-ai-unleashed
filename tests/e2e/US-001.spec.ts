import { expect, test as base, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { HOME_MESSAGES as MSG, HomePage } from '../page-objects/HomePage'
import { RoomPage } from '../page-objects/RoomPage'

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

async function hostCreatesRoom(newPlayer: NewPlayer, name = 'Maya') {
  const host = await newPlayer()
  await host.home.goto()
  await host.home.create(name)
  const code = await host.room.code()
  return { host, code }
}

async function guestJoins(newPlayer: NewPlayer, code: string, name: string) {
  const guest = await newPlayer()
  await guest.home.goto()
  await guest.home.join(code, name)
  await guest.room.expectInRoom(code)
  return guest
}

const record = (type: string, description: string) => test.info().annotations.push({ type, description })

async function timed(action: () => Promise<unknown>): Promise<number> {
  const start = Date.now()
  await action()
  return Date.now() - start
}

test.describe('US-001 happy path', () => {
  test('TC-001-01 Host creates a room', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.create('Maya')

    await host.room.expectInRoom()
    await expect(host.room.copyLink).toBeVisible()
    await expect(host.room.phase).toHaveText('voting')
    await host.room.expectPlayerCount(1)
    await expect(host.room.row('Maya')).toContainText('Host')
    await expect(host.room.row('Maya')).toContainText('You')
  })

  test('TC-001-06 Guest joins with code', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')

    await guest.room.expectPlayerCount(2)
    await expect(guest.room.row('Maya')).toContainText('Host')
    await expect(guest.room.row('Noah')).toContainText('You')
    await host.room.expectPlayerCount(2)
    await host.room.expectNames(['Maya', 'Noah'])
  })

  test('TC-001-14 Share link prefills the room code and leaves the name empty', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto(code)

    await expect(guest.home.joinCode).toHaveValue(code)
    await expect(guest.home.joinName).toHaveValue('')
  })

  test('TC-001-15 Guest joins after entering a name on the share link', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto(code)
    await guest.home.joinName.fill('Noah')
    await guest.home.joinButton.click()

    await guest.room.expectInRoom(code)
    await guest.room.expectPlayerCount(2)
    await expect(guest.room.row('Maya')).toContainText('Host')
    await expect(guest.room.row('Noah')).toContainText('You')
    await host.room.expectPlayerCount(2)
  })
})

test.describe('US-001 AC-001-01/02/03 create and join', () => {
  test('TC-001-04 Create with an empty name creates no room', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.createButton.click()

    await host.home.expectFieldError(host.home.createName, MSG.nameRequired)
    await host.home.expectOnHome()
  })

  test('TC-001-07 Code is case-insensitive and trimmed', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.join(` ${code.toLowerCase()} `, 'Noah')

    await guest.room.expectInRoom(code)
    await expect(guest.page.getByRole('alert')).toHaveCount(0)
  })

  test('TC-001-11 Guest is not in the roster when the Host rejects the join', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.join(code, 'Maya')

    await guest.home.expectFieldError(guest.home.joinName, MSG.nameTaken)
    await guest.home.expectOnHome()
    await host.room.expectNames(['Maya'])
  })

  test('TC-001-12 Well-formed code of a nonexistent room does not join', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const otherCode = code === 'XYZ789' ? 'XYZ788' : 'XYZ789'
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.join(otherCode, 'Noah')

    await expect(guest.home.formError('join')).toHaveText(MSG.roomUnavailable)
    await guest.home.expectOnHome()
    await host.room.expectPlayerCount(1)
  })

  test('TC-001-16 Opening a share link never auto-joins', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto(code)

    // Absence of an auto-join can only be observed over a time window.
    await guest.page.waitForTimeout(5000)
    await guest.home.expectOnHome()
    await expect(guest.home.joinCode).toHaveValue(code)
    await host.room.expectPlayerCount(1)
  })
})

test.describe('US-001 AC-001-04/06 roster and duplicate names', () => {
  test('TC-001-21 Rejected join does not change the other rosters', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')
    const guest2 = await newPlayer()
    await guest2.home.goto()
    await guest2.home.join(code, 'noah')

    await guest2.home.expectFieldError(guest2.home.joinName, MSG.nameTaken)
    await host.room.expectNames(['Maya', 'Noah'])
    await guest.room.expectNames(['Maya', 'Noah'])
  })

  test('TC-001-36 Unique name is accepted', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Maya2')

    await guest.room.expectPlayerCount(2)
    await host.room.expectNames(['Maya', 'Maya2'])
  })

  for (const [id, typed] of [
    ['TC-001-37', 'maya'],
    ['TC-001-38', ' MAYA '],
  ] as const) {
    test(`${id} Duplicate of the Host name "${typed}" is rejected`, async ({ newPlayer }) => {
      const { host, code } = await hostCreatesRoom(newPlayer)
      const guest = await newPlayer()
      await guest.home.goto()
      await guest.home.join(code, typed)

      await guest.home.expectFieldError(guest.home.joinName, MSG.nameTaken)
      await guest.home.expectOnHome()
      await expect(guest.home.joinCode).toHaveValue(code)
      await expect(guest.home.joinName).toHaveValue(typed)
      await host.room.expectNames(['Maya'])
    })
  }
})

const NAME_20 = 'ABCDEFGHIJKLMNOPQRST'
const NAME_21 = 'ABCDEFGHIJKLMNOPQRSTU'

test.describe('US-001 AC-001-05 display name validation', () => {
  for (const [id, label, typed, message] of [
    ['TC-001-23', 'empty', '', MSG.nameRequired],
    ['TC-001-24', 'only spaces', '     ', MSG.nameRequired],
    ['TC-001-25', '21 characters', NAME_21, MSG.nameTooLong],
  ] as const) {
    test(`${id} Create rejects a display name that is ${label}`, async ({ newPlayer }) => {
      const host = await newPlayer()
      await host.home.goto()
      await host.home.create(typed)

      await host.home.expectFieldError(host.home.createName, message)
      await host.home.expectOnHome()
      await expect(host.home.createName).toHaveValue(typed)
    })
  }

  test('TC-001-26 Create accepts a 20-character display name', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.create(NAME_20)

    await host.room.expectInRoom()
    await expect(host.room.row(NAME_20)).toContainText('Host')
  })

  test('TC-001-28 Create stores a padded display name trimmed', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.create('  Maya  ')

    await host.room.expectInRoom()
    await host.room.expectNames(['Maya'])
  })

  for (const [id, label, typed, message] of [
    ['TC-001-30', 'empty', '', MSG.nameRequired],
    ['TC-001-31', 'only spaces', '   ', MSG.nameRequired],
    ['TC-001-32', '21 characters', NAME_21, MSG.nameTooLong],
  ] as const) {
    test(`${id} Join rejects a display name that is ${label}`, async ({ newPlayer }) => {
      const { host, code } = await hostCreatesRoom(newPlayer)
      const guest = await newPlayer()
      await guest.home.goto()
      await guest.home.join(code, typed)

      await guest.home.expectFieldError(guest.home.joinName, message)
      await guest.home.expectOnHome()
      await expect(guest.home.joinCode).toHaveValue(code)
      await expect(guest.home.joinName).toHaveValue(typed)
      await host.room.expectNames(['Maya'])
    })
  }
})

test.describe('US-001 AC-001-07 room code validation', () => {
  for (const [id, label, typed, message] of [
    ['TC-001-44', 'empty', '', MSG.codeRequired],
    ['TC-001-45', 'only spaces', '   ', MSG.codeRequired],
    ['TC-001-46', '5 characters', 'ABC12', MSG.codeFormat],
    ['TC-001-47', '7 characters', 'ABC1234', MSG.codeFormat],
    ['TC-001-48', 'punctuated', 'ABC-12', MSG.codeFormat],
  ] as const) {
    test(`${id} Join rejects a room code that is ${label}`, async ({ newPlayer }) => {
      const guest = await newPlayer()
      await guest.home.goto()
      await guest.home.join(typed, 'Noah')

      await guest.home.expectFieldError(guest.home.joinCode, message)
      await guest.home.expectOnHome()
      await expect(guest.home.joinCode).toHaveValue(typed)
      await expect(guest.home.joinName).toHaveValue('Noah')
    })
  }
})

const REALTIME_WS = /realtime\/v1\/websocket/

// Holds the realtime socket back so the app stays in the pending state.
async function delayRealtime(page: Page, delayMs: number) {
  await page.routeWebSocket(REALTIME_WS, (ws) => {
    const queued: Array<string | Buffer> = []
    let server: WebSocketRoute | null = null
    ws.onMessage((message) => (server ? server.send(message) : queued.push(message)))
    setTimeout(() => {
      server = ws.connectToServer()
      for (const message of queued) server.send(message)
    }, delayMs)
  })
}

// Drops Host frames that name the given Broadcast events before they reach the page.
async function dropHostEvents(page: Page, events: string[]) {
  await page.routeWebSocket(REALTIME_WS, (ws) => {
    const server = ws.connectToServer()
    server.onMessage((message) => {
      const text = typeof message === 'string' ? message : message.toString('latin1')
      if (events.some((event) => text.includes(event))) return
      ws.send(message)
    })
  })
}

test.describe('US-001 AC-001-08/11 connecting, timeouts and unavailable rooms', () => {
  test('TC-001-53 Create shows Connecting and disables submit', async ({ newPlayer }) => {
    const host = await newPlayer()
    await delayRealtime(host.page, 1500)
    await host.home.goto()
    await host.home.create('Maya')

    await expect(host.home.connectionStatus('create')).toHaveText(MSG.connecting)
    await expect(host.home.createButton).toBeDisabled()
    await host.room.expectInRoom()
  })

  test('TC-001-54 Double-click on Create room creates one room', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.fillCreate('Maya')
    await host.home.createButton.dblclick()

    await host.room.expectInRoom()
    await expect(host.room.roomCode).toHaveCount(1)
    await host.room.expectNames(['Maya'])
  })

  test('TC-001-54 Two rapid click events on Create room create one room', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.home.fillCreate('Maya')
    await host.home.createButton.evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })

    await host.room.expectInRoom()
    await expect(host.room.roomCode).toHaveCount(1)
    await host.room.expectNames(['Maya'])
  })

  test('TC-001-55 Double-click on Join room joins once', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.fillJoin(code, 'Noah')
    await guest.home.joinButton.dblclick()

    await guest.room.expectInRoom(code)
    await host.room.expectNames(['Maya', 'Noah'])
    await expect(guest.page.getByText(MSG.nameTaken)).toHaveCount(0)
  })

  test('TC-001-56 Join times out when realtime cannot be reached', async ({ newPlayer }) => {
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.context.setOffline(true)
    await guest.home.fillJoin('ABC234', 'Noah')

    const start = Date.now()
    await guest.home.joinButton.click()
    await expect(guest.home.connectionStatus('join')).toHaveText(MSG.connecting)
    await expect(guest.home.formError('join')).toHaveText(MSG.connectionTimeout)
    const elapsed = Date.now() - start
    record('join-timeout-ms', String(elapsed))

    expect.soft(elapsed, 'join timeout expected at about 5 s').toBeGreaterThanOrEqual(4000)
    expect.soft(elapsed, 'join timeout expected at about 5 s').toBeLessThanOrEqual(7000)
    await expect(guest.home.connectionStatus('join')).toHaveCount(0)
    await expect(guest.home.joinButton).toBeEnabled()
    await expect(guest.home.joinCode).toHaveValue('ABC234')
    await expect(guest.home.joinName).toHaveValue('Noah')
  })

  test('TC-001-57 Create times out when realtime cannot be reached', async ({ newPlayer }) => {
    const host = await newPlayer()
    await host.home.goto()
    await host.context.setOffline(true)
    await host.home.fillCreate('Maya')

    const start = Date.now()
    await host.home.createButton.click()
    await expect(host.home.connectionStatus('create')).toHaveText(MSG.connecting)
    await expect(host.home.formError('create')).toHaveText(MSG.connectionTimeout, { timeout: 15_000 })
    const elapsed = Date.now() - start
    record('create-timeout-ms', String(elapsed))

    expect.soft(elapsed, 'create timeout expected at about 10 s').toBeGreaterThanOrEqual(9000)
    expect.soft(elapsed, 'create timeout expected at about 10 s').toBeLessThanOrEqual(12000)
    await expect(host.home.createButton).toBeEnabled()
    await expect(host.home.createName).toHaveValue('Maya')
    await expect(host.room.roomCode).toHaveCount(0)
  })

  test('TC-001-76 Never-created code shows the unavailable error', async ({ newPlayer }) => {
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.fillJoin('ABC234', 'Noah')

    const start = Date.now()
    await guest.home.joinButton.click()
    await expect(guest.home.formError('join')).toHaveText(MSG.roomUnavailable)
    const elapsed = Date.now() - start
    record('room-unavailable-ms', String(elapsed))

    expect.soft(elapsed, 'unavailable error expected at about 5 s').toBeLessThanOrEqual(7000)
    // Form-level only: no field is flagged.
    await expect(guest.home.joinRegion.getByRole('alert')).toHaveCount(1)
    await guest.home.expectNoFieldError(guest.home.joinCode)
    await guest.home.expectNoFieldError(guest.home.joinName)
    await expect(guest.home.joinButton).toBeEnabled()
    await expect(guest.home.joinCode).toHaveValue('ABC234')
    await expect(guest.home.joinName).toHaveValue('Noah')
  })

  test('TC-001-78 Subscribed but no Host acknowledgement shows the unavailable error', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await dropHostEvents(guest.page, ['room:join-accepted', 'room:join-rejected'])
    await guest.home.goto()
    await guest.home.fillJoin(code, 'Noah')

    const start = Date.now()
    await guest.home.joinButton.click()
    await expect(guest.home.formError('join')).toHaveText(MSG.roomUnavailable)
    record('no-ack-ms', String(Date.now() - start))

    await expect(guest.page.getByText(MSG.connectionTimeout)).toHaveCount(0)
    await guest.home.expectOnHome()
    await expect(guest.home.joinButton).toBeEnabled()
  })

  test('TC-001-81 Existing room never shows the unavailable error', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await newPlayer()
    await guest.page.addInitScript((message) => {
      const flagged = window as unknown as { sawRoomUnavailable?: boolean }
      new MutationObserver(() => {
        if (document.body?.textContent?.includes(message)) flagged.sawRoomUnavailable = true
      }).observe(document, { childList: true, subtree: true, characterData: true })
    }, MSG.roomUnavailable)
    await guest.home.goto()
    await guest.home.join(code, 'Noah')

    await guest.room.expectInRoom(code)
    const saw = await guest.page.evaluate(() => (window as unknown as { sawRoomUnavailable?: boolean }).sawRoomUnavailable)
    expect(saw).toBeFalsy()
  })
})

test.describe('US-001 business rules 5 and 8 phase on join and Guest reload', () => {
  test('TC-001-84 Guest joining in voting sees the phase and no vote', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')

    await expect(guest.room.phase).toHaveText('voting')
    await expect(guest.room.row('Noah')).toContainText('Not voted')
    await expect(guest.room.row('Maya')).toContainText('Not voted')
  })

  test('TC-001-89 Guest reload returns to Home with code and name prefilled', async ({ newPlayer }) => {
    const { code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')
    await guest.page.reload()

    await guest.home.expectOnHome()
    await expect(guest.home.joinCode).toHaveValue(code)
    await expect(guest.home.joinName).toHaveValue('Noah')
  })

  test('TC-001-90 Guest reload does not rejoin automatically', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')
    await host.room.expectNames(['Maya', 'Noah'])
    await guest.page.reload()

    // Absence of an automatic rejoin can only be observed over a time window.
    await guest.page.waitForTimeout(5000)
    await guest.home.expectOnHome()
    expect((await host.room.names()).filter((name) => name === 'Noah').length).toBeLessThanOrEqual(1)

    // The old entry is removed by Presence; time it for the record.
    const start = Date.now()
    await expect.soft(host.room.playersHeading).toHaveText('Players (1)')
    record('guest-reload-removal-ms', String(Date.now() - start + 5000))
    await host.room.expectNames(['Maya'])
  })
})

// Presence departure detection was measured at about 3 s worst case (D-020 spike); waits use the 10 s expect timeout.
async function hostWithTwoGuests(newPlayer: NewPlayer) {
  const { host, code } = await hostCreatesRoom(newPlayer)
  const guest = await guestJoins(newPlayer, code, 'Noah')
  const guest2 = await guestJoins(newPlayer, code, 'Linh')
  const everyone = ['Maya', 'Noah', 'Linh']
  await Promise.all([host, guest, guest2].map((player) => player.room.expectNames(everyone)))
  return { host, guest, guest2, code }
}

async function sinceNow(action: () => Promise<unknown>): Promise<number> {
  const start = Date.now()
  await action()
  return Date.now() - start
}

test.describe('US-001 AC-001-04 roster latency', () => {
  test('TC-001-18 Second Guest appears for everyone within 2 s', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')
    await host.room.expectNames(['Maya', 'Noah'])
    const guest2 = await newPlayer()
    await guest2.home.goto()
    await guest2.home.join(code, 'Linh')
    await guest2.room.expectInRoom(code)

    // t0 = Guest2 sees the room shell.
    const names = ['Maya', 'Noah', 'Linh']
    const [hostMs, guestMs] = await Promise.all([
      sinceNow(() => host.room.expectNames(names)),
      sinceNow(() => guest.room.expectNames(names)),
    ])
    record('roster-latency-host-ms', String(hostMs))
    record('roster-latency-guest-ms', String(guestMs))
    record('environment', `local dev server (${process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'}) + Supabase Realtime`)

    expect.soft(hostMs, 'Host roster latency').toBeLessThanOrEqual(2000)
    expect.soft(guestMs, 'Guest roster latency').toBeLessThanOrEqual(2000)
    await guest2.room.expectNames(names)
  })
})

// Labelled assertions so a failure names the stale page.
async function expectRoster(label: string, player: Player, names: string[]) {
  await expect
    .poll(async () => (await player.room.names()).sort(), { message: `${label} roster is stale` })
    .toEqual([...names].sort())
}

test.describe('US-001 AC-001-09/10/11 Presence lifecycle', () => {
  test.describe.configure({ timeout: 60_000 })

  for (const mode of ['page', 'context'] as const) {
    test(`TC-001-61 Guest closes the ${mode} and is removed from the rosters`, async ({ newPlayer }) => {
      const { host, guest, guest2 } = await hostWithTwoGuests(newPlayer)

      if (mode === 'page') await guest.page.close()
      else await guest.context.close()
      const remaining = ['Maya', 'Linh']
      const start = Date.now()
      await expectRoster('Host', host, remaining)
      const hostMs = Date.now() - start
      await expectRoster('Guest2', guest2, remaining)
      const guest2Ms = Date.now() - start
      record(`guest-leave-${mode}-host-ms`, String(hostMs))
      record(`guest-leave-${mode}-guest2-ms`, String(guest2Ms))
      await expect(host.room.row('Noah')).toHaveCount(0)
    })
  }

  test('TC-001-62 Departed name can be reused', async ({ newPlayer }) => {
    const { host, guest, code } = await hostWithTwoGuests(newPlayer)
    await guest.page.close()
    await host.room.expectNames(['Maya', 'Linh'])

    const returning = await guestJoins(newPlayer, code, 'Noah')
    await returning.room.expectPlayerCount(3)
    await host.room.expectNames(['Maya', 'Linh', 'Noah'])
  })

  test('TC-001-67 Non-Host leave does not end the room', async ({ newPlayer }) => {
    const { host, guest, guest2 } = await hostWithTwoGuests(newPlayer)
    await guest.context.close()
    await Promise.all([host, guest2].map((player) => player.room.expectNames(['Maya', 'Linh'])))

    for (const player of [host, guest2]) {
      await expect(player.room.hostLeftAlert).toHaveCount(0)
      await expect(player.room.roomCode).toBeVisible()
    }
  })

  test('TC-001-68 Host closes the tab and Guests see Host-left', async ({ newPlayer }) => {
    const { host, guest, guest2 } = await hostWithTwoGuests(newPlayer)

    await host.context.close()
    const [guestMs, guest2Ms] = await Promise.all([
      sinceNow(() => guest.room.expectHostLeft()),
      sinceNow(() => guest2.room.expectHostLeft()),
    ])
    record('host-left-guest-ms', String(guestMs))
    record('host-left-guest2-ms', String(guest2Ms))
  })

  test('TC-001-69 Return to Home, then the old code fails', async ({ newPlayer }) => {
    const { host, guest, code } = await hostWithTwoGuests(newPlayer)
    await host.context.close()
    await guest.room.expectHostLeft()

    await guest.room.returnHome.click()
    await guest.home.expectOnHome()
    await guest.home.join(code, 'Noah')

    await expect(guest.home.formError('join')).toHaveText(MSG.roomUnavailable)
    await expect(guest.home.joinCode).toHaveValue(code)
    await expect(guest.home.joinName).toHaveValue('Noah')
  })

  test('TC-001-70 Host reload ends the room for Guests and Home is empty', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Noah')
    await host.room.expectNames(['Maya', 'Noah'])

    await host.page.reload()
    await expect(guest.room.hostLeftAlert, 'Guest did not show Host-left').toBeVisible({ timeout: 10_000 })
    await expect(guest.room.returnHome, 'Guest has no Return to Home').toBeVisible()
    await host.home.expectOnHome()
    await expect(host.room.playersList).toHaveCount(0)
    await expect(host.home.createName).toHaveValue('')
    await expect(host.home.joinCode).toHaveValue('')
    await expect(host.home.joinName).toHaveValue('')
  })

  test('TC-001-72 Guest reload does not end the room', async ({ newPlayer }) => {
    const { host, guest, guest2 } = await hostWithTwoGuests(newPlayer)

    await guest.page.reload()
    await guest.home.expectOnHome()
    await expectRoster('Host', host, ['Maya', 'Linh'])
    await expectRoster('Guest2', guest2, ['Maya', 'Linh'])
    for (const player of [host, guest2]) {
      await expect(player.room.hostLeftAlert).toHaveCount(0)
      await expect(player.room.roomCode).toBeVisible()
    }
  })

  test('TC-001-77 Ended room code shows the unavailable error', async ({ newPlayer }) => {
    const { host, code } = await hostCreatesRoom(newPlayer)
    const guest = await guestJoins(newPlayer, code, 'Linh')
    await host.context.close()
    await guest.room.expectHostLeft()

    const late = await newPlayer()
    await late.home.goto()
    await late.home.fillJoin(code, 'Noah')
    const start = Date.now()
    await late.home.joinButton.click()
    await expect(late.home.formError('join')).toHaveText(MSG.roomUnavailable)
    record('ended-room-unavailable-ms', String(Date.now() - start))
    await expect(late.home.joinCode).toHaveValue(code)
    await expect(late.home.joinName).toHaveValue('Noah')
  })
})
