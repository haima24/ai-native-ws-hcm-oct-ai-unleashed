import {
  expect,
  test as base,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test'
import { HOME_MESSAGES as MSG, HomePage } from '../page-objects/HomePage'
import {
  CARD_VALUES,
  HOST_LEFT_MESSAGE,
  REVEAL_ERROR,
  RoomPage,
  VOTE_FAILED_MESSAGE,
  VOTE_PENDING_MESSAGE,
  WAIT_FOR_REVEAL,
  WAIT_FOR_REVOTE,
  type CardValue,
} from '../page-objects/RoomPage'

interface Player {
  context: BrowserContext
  page: Page
  home: HomePage
  room: RoomPage
}

type NewPlayer = (options?: BrowserContextOptions) => Promise<Player>

// Every player gets its own browser context so sessionStorage and localStorage are never shared.
const test = base.extend<{ newPlayer: NewPlayer }>({
  newPlayer: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (options) => {
      const context = await browser.newContext(options)
      contexts.push(context)
      const page = await context.newPage()
      return { context, page, home: new HomePage(page), room: new RoomPage(page) }
    })
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)))
  },
})

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720, padding: 24, columns: 5, gap: 12, sidebar: 220, cardMin: 112 },
  { name: 'tablet', width: 768, height: 1024, padding: 16, columns: 3, gap: 12, sidebar: 180, cardMin: 96 },
  { name: 'narrow', width: 390, height: 844, padding: 12, columns: 3, gap: 8, sidebar: 0, cardMin: 88 },
] as const

const ROOM_TIMEOUT = 120_000
const LONG_NAMES = ['Aaaaaaaaaaaaaaaaaaaa', 'Bbbbbbbbbbbbbbbbbbbb']
const OLD_PALETTE = ['rgb(69, 90, 100)', 'rgb(241, 243, 244)', 'rgb(38, 50, 56)', 'rgb(84, 110, 122)', 'rgb(179, 38, 30)', 'rgb(0, 95, 204)']

// ---------- colour probes ----------

type Rgba = [number, number, number, number]
type Box = { x: number; y: number; width: number; height: number }

async function textColors(locator: Locator): Promise<{ fg: Rgba; bg: Rgba }> {
  return locator.first().evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const toRgba = (value: string): Rgba => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000000'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const fg = toRgba(getComputedStyle(el).color)
    let bg: Rgba = [255, 255, 255, 1]
    for (let node: Element | null = el; node; node = node.parentElement) {
      const candidate = toRgba(getComputedStyle(node).backgroundColor)
      if (candidate[3] > 0) {
        bg = candidate
        break
      }
    }
    return { fg, bg }
  })
}

const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (c: Rgba) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
const contrastOf = (a: number, b: number) => {
  const [hi, lo] = [a, b].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const ratio = (a: Rgba, b: Rgba) => contrastOf(luminance(a), luminance(b))

function hsl([r, g, b]: Rgba) {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

// Palette classes from the cases file: hue/lightness bands written from the AC wording, not from token values.
const isPaperTone = (c: Rgba) => {
  const { h, s, l } = hsl(c)
  return l >= 0.75 && s <= 0.7 && h >= 25 && h <= 55 && !(c[0] === 255 && c[1] === 255 && c[2] === 255)
}
const isInkBrown = (c: Rgba) => {
  const { h, s, l } = hsl(c)
  return l <= 0.25 && h <= 40 && s >= 0.1
}
const isMutedInk = (c: Rgba) => {
  const { h, s, l } = hsl(c)
  return l <= 0.45 && h <= 40 && s >= 0.1
}
const isBrickAccent = (c: Rgba) => {
  const { h, s, l } = hsl(c)
  return h <= 30 && s >= 0.3 && s <= 0.8 && l >= 0.15 && l <= 0.4
}
const isMutedRed = (c: Rgba) => {
  const { h, s, l } = hsl(c)
  return (h <= 15 || h >= 345) && s <= 0.8 && l <= 0.45
}
const rgbText = (c: Rgba) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

async function expectContrast(log: string[], label: string, locator: Locator) {
  const { fg, bg } = await textColors(locator)
  const value = ratio(fg, bg)
  log.push(`${label}=${value.toFixed(2)}`)
  expect.soft(value, `${label} contrast`).toBeGreaterThanOrEqual(4.5)
}

const recordContrast = (log: string[]) => test.info().annotations.push({ type: 'contrast', description: log.join('; ') })

const colorSnapshot = (page: Page) =>
  page.evaluate(() => {
    const out = new Set<string>()
    for (const el of document.querySelectorAll('body, body *')) {
      const s = getComputedStyle(el)
      out.add(s.color)
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') out.add(s.backgroundColor)
      if (parseFloat(s.borderTopWidth) > 0) out.add(s.borderTopColor)
      if (el instanceof SVGElement) {
        if (s.fill !== 'none') out.add(s.fill)
        if (s.stroke !== 'none') out.add(s.stroke)
      }
    }
    return [...out].sort()
  })

const styleOf = (locator: Locator) =>
  locator.first().evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      fontWeight: s.fontWeight,
      boxShadow: s.boxShadow,
      borderStyle: s.borderTopStyle,
      borderWidth: s.borderTopWidth,
      opacity: s.opacity,
      cursor: s.cursor,
      background: s.backgroundColor,
    }
  })

type Style = Awaited<ReturnType<typeof styleOf>>
const nonColorDiffers = (a: Style, b: Style) =>
  a.fontWeight !== b.fontWeight || a.boxShadow !== b.boxShadow || a.borderStyle !== b.borderStyle || a.borderWidth !== b.borderWidth

// ---------- layout probes ----------

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const mainPadding = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')!).paddingLeft))

async function box(locator: Locator): Promise<Box> {
  const b = await locator.first().boundingBox()
  if (!b) throw new Error('element has no box')
  return b
}

const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Boxes of decoration only: the large Home illustration (>= 48 px) and the ornament dividers. */
const decorationBoxes = (page: Page) =>
  page.evaluate(() => {
    const out: Box[] = []
    for (const el of document.querySelectorAll('svg, .ornament-divider')) {
      const r = el.getBoundingClientRect()
      const isIllustration = el instanceof SVGElement && r.width >= 48
      if (isIllustration || el.classList.contains('ornament-divider')) out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
    }
    return out
  })

const contentBoxes = (page: Page) =>
  page.evaluate(() => {
    const out: Box[] = []
    for (const el of document.querySelectorAll('h1, h2, h3, label, input, button, p, li, dt, dd')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
    }
    return out
  })

const markPage = (page: Page) => page.evaluate(() => ((window as unknown as Record<string, unknown>).__noReload = true))
const expectNoReload = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__noReload)).toBe(true)

/** Decoration markup and ornament counts outside the Results panel, for cross-state comparison. */
const decorationInventory = (page: Page) =>
  page.evaluate(() => {
    const results = document.querySelector('[data-testid="results-panel"]')
    const outside = (el: Element) => !results || !results.contains(el)
    const pseudo = (el: Element) => ['::before', '::after'].map((p) => getComputedStyle(el, p).content)
    return {
      svgs: [...document.querySelectorAll('svg')].filter(outside).map((svg) => svg.innerHTML),
      dividers: [...document.querySelectorAll('.ornament-divider')].filter(outside).map(pseudo),
      panels: [...document.querySelectorAll('.ornate')].filter(outside).map(pseudo),
    }
  })

// ---------- room helpers ----------

async function roomOf(newPlayer: NewPlayer, guestNames: string[], guestSetup?: (page: Page) => Promise<void>) {
  const host = await newPlayer()
  await host.home.goto()
  await host.home.create('Maya')
  const code = await host.room.code()

  const guests: Player[] = []
  for (const name of guestNames) {
    const guest = await newPlayer()
    await guestSetup?.(guest.page)
    await guest.home.goto()
    await guest.home.join(code, name)
    await guest.room.expectInRoom(code)
    guests.push(guest)
  }
  const names = ['Maya', ...guestNames]
  await Promise.all([host, ...guests].map((player) => player.room.expectNames(names)))
  return { host, guests, code }
}

async function room(newPlayer: NewPlayer, guestSetup?: (page: Page) => Promise<void>) {
  const { host, guests } = await roomOf(newPlayer, ['Noah'], guestSetup)
  return { host, guest: guests[0] }
}

const cast = (player: Player, name: string, value: CardValue) => player.room.vote(name, value)

const REALTIME_WS = /realtime\/v1\/websocket/
const ACK_DELAY_MS = 1500
interface FrameFlags {
  dropIntent: boolean
  delayAck: boolean
}
const frameText = (message: string | Buffer) => (typeof message === 'string' ? message : message.toString('latin1'))

async function controlFrames(page: Page): Promise<FrameFlags> {
  const flags: FrameFlags = { dropIntent: false, delayAck: false }
  await page.routeWebSocket(REALTIME_WS, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((message) => {
      if (flags.dropIntent && frameText(message).includes('room:vote-intent')) return
      server.send(message)
    })
    server.onMessage((message) => {
      if (flags.delayAck && frameText(message).includes('room:vote-accepted')) {
        setTimeout(() => ws.send(message), ACK_DELAY_MS)
        return
      }
      ws.send(message)
    })
  })
  return flags
}

/** Create > join > vote > reveal > revote > reveal; results are checked per Participant (D-024 replaced Average and Consensus). */
async function fullFlow(newPlayer: NewPlayer) {
  const { host, guest } = await room(newPlayer)
  await markPage(host.page)
  await markPage(guest.page)

  await cast(host, 'Maya', '5')
  await cast(guest, 'Noah', '8')
  await expect(host.room.voteCell('Noah')).toHaveText('Voted')
  await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
  await host.room.reveal()
  for (const player of [host, guest]) {
    await player.room.expectPhase('revealed')
    await expect(player.room.voteCell('Maya')).toHaveText('5')
    await expect(player.room.voteCell('Noah')).toHaveText('8')
    await expect(player.room.participation).toHaveText('2 of 2 voted')
    await player.room.expectAllCardsDisabled()
  }

  await host.room.revote()
  for (const player of [host, guest]) {
    await player.room.expectPhase('voting')
    await expect(player.room.resultsPanel).toHaveCount(0)
    await player.room.expectAllCardsEnabledAndUnselected()
  }
  await cast(host, 'Maya', '5')
  await cast(guest, 'Noah', '5')
  await expect(host.room.voteCell('Noah')).toHaveText('Voted')
  await host.room.reveal()
  for (const player of [host, guest]) {
    await player.room.expectPhase('revealed')
    await expect(player.room.voteCell('Maya')).toHaveText('5')
    await expect(player.room.voteCell('Noah')).toHaveText('5')
  }
  await expectNoReload(host.page)
  await expectNoReload(guest.page)
}

// ======================================================================
// 1. Home screen (AC-004-01)
// ======================================================================
test.describe('US-004 AC-004-01 Home', () => {
  test('TC-004-01 Home panels and primary buttons use the vintage style', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()

    for (const region of [p.home.createRegion, p.home.joinRegion]) {
      const style = await region.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          widths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(parseFloat),
          styles: [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle],
        }
      })
      for (const w of style.widths) expect(w).toBeGreaterThanOrEqual(1)
      for (const s of style.styles) expect(s).not.toBe('none')
      const { bg } = await textColors(region)
      expect(isPaperTone(bg), `panel background ${rgbText(bg)} is paper-tone`).toBe(true)
      expect(rgbText(bg)).not.toBe('rgb(241, 243, 244)')
    }
    for (const button of [p.home.createButton, p.home.joinButton]) {
      const { fg, bg } = await textColors(button)
      expect(isBrickAccent(bg), `button background ${rgbText(bg)} is brick-accent`).toBe(true)
      expect(luminance(fg)).toBeGreaterThan(0.5)
    }
    await expect(p.page.getByRole('heading', { name: 'Story Pointing', level: 1 })).toBeVisible()
    await expect(p.page.getByText('Estimate together, without signing up.')).toBeVisible()
    await expect(p.home.createName).toBeVisible()
    await expect(p.home.joinCode).toBeVisible()
    await expect(p.home.joinName).toBeVisible()
  })

  test('TC-004-02 Share-link prefill still works with the restyle', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto('abc123')

    await expect(p.home.joinCode).toHaveValue(/abc123/i)
    await expect(p.home.joinName).toHaveValue('')
    await p.home.expectOnHome()
  })
})

// ======================================================================
// 2. Room shell (AC-004-02)
// ======================================================================
test.describe('US-004 AC-004-02 Room shell', () => {
  test('TC-004-03 Room elements use the theme and keep their structure', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host } = await room(newPlayer)
    const page = host.page
    const elements: [string, Locator][] = [
      ['header', page.locator('header')],
      ['Copy link', host.room.copyLink],
      ['Players heading', host.room.playersHeading],
      ['roster row', host.room.row('Noah')],
      ['unselected card', host.room.card('3')],
      ['Reveal estimates', host.room.revealButton],
      ['Phase heading', host.room.phaseHeading],
    ]
    const colors = await colorSnapshot(page)
    for (const old of OLD_PALETTE) expect(colors).not.toContain(old)
    for (const [name, locator] of elements) {
      const { fg, bg } = await textColors(locator)
      expect.soft(isPaperTone(bg) || isBrickAccent(bg), `${name} background ${rgbText(bg)}`).toBe(true)
      expect.soft(isInkBrown(fg) || isMutedInk(fg) || isPaperTone(fg), `${name} text ${rgbText(fg)}`).toBe(true)
    }

    const roster = await box(page.getByRole('region', { name: /^Players/ }))
    const grid = await box(host.room.cardGroup)
    const reveal = await box(host.room.revealButton)
    expect(roster.x + roster.width, 'roster is left of the cards').toBeLessThanOrEqual(grid.x)
    expect(reveal.y, 'Reveal is below the card grid').toBeGreaterThan(grid.y + grid.height)
    await expect(page.locator('header').getByTestId('room-code')).toBeVisible()
    await expect(page.locator('header').getByRole('button', { name: 'Copy link' })).toBeVisible()
  })

  test('TC-004-04 Results panel uses the theme after reveal', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await cast(host, 'Maya', '5')
    await cast(guest, 'Noah', '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await host.room.reveal()
    await host.room.expectPhase('revealed')

    const colors = await colorSnapshot(host.page)
    for (const old of OLD_PALETTE) expect(colors).not.toContain(old)
    for (const [name, locator] of [
      ['Results panel', host.room.resultsPanel],
      ['Results heading', host.room.resultsPanel.getByRole('heading')],
      ['participation', host.room.participation],
    ] as [string, Locator][]) {
      const { fg, bg } = await textColors(locator)
      expect.soft(isPaperTone(bg), `${name} background ${rgbText(bg)}`).toBe(true)
      expect.soft(isInkBrown(fg) || isMutedInk(fg), `${name} text ${rgbText(fg)}`).toBe(true)
    }
    await expect(host.room.participation).toHaveText('2 of 2 voted')
    await expect(host.room.voteCell('Maya')).toHaveText('5')
    await expect(host.room.voteCell('Noah')).toHaveText('8')
  })
})

// ======================================================================
// 3. One vintage theme (AC-004-03)
// ======================================================================
test.describe('US-004 AC-004-03 one theme', () => {
  test('TC-004-05 Page background and text are paper and ink on every screen', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const home = await newPlayer()
    await home.home.goto()
    const homeBg = await bodyBg(home.page)

    const { host, guest } = await room(newPlayer)
    const states: [string, Page][] = [['Home', home.page], ['Room voting', host.page]]
    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await host.room.expectPhase('revealed')
    states.push(['Room revealed', host.page])
    await host.page.close()
    await guest.room.expectHostLeft()
    states.push(['Host-left', guest.page])

    for (const [name, page] of states) {
      const { fg, bg } = await textColors(page.locator('body'))
      expect.soft(isPaperTone(bg), `${name} background ${rgbText(bg)}`).toBe(true)
      expect.soft(isInkBrown(fg), `${name} text ${rgbText(fg)}`).toBe(true)
      if (name !== 'Room revealed') expect.soft(rgbText(bg), `${name} equals Home`).toBe(homeBg)
    }
  })

  test('TC-004-06 One accent for primary actions and selected cards', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const first = await newPlayer()
    await first.home.goto()
    const accents: [string, Rgba][] = []
    for (const [name, button] of [['Create room', first.home.createButton], ['Join room', first.home.joinButton]] as [string, Locator][]) {
      accents.push([name, (await textColors(button)).bg])
    }

    const { host, guest } = await room(newPlayer)
    await cast(host, 'Maya', '5')
    accents.push(['Copy link', (await textColors(host.room.copyLink)).bg])
    accents.push(['Reveal estimates', (await textColors(host.room.revealButton)).bg])
    accents.push(['selected card', (await textColors(host.room.card('5'))).bg])
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
    await host.room.reveal()
    await host.room.expectPhase('revealed')
    accents.push(['Revote', (await textColors(host.room.revoteButton)).bg])
    await host.page.close()
    await guest.room.expectHostLeft()
    accents.push(['Return to Home', (await textColors(guest.room.returnHome)).bg])

    const [, reference] = accents[0]
    for (const [name, color] of accents) {
      expect.soft(isBrickAccent(color), `${name} ${rgbText(color)} is brick-accent`).toBe(true)
      expect.soft(rgbText(color), `${name} equals the Create room accent`).toBe(rgbText(reference))
    }
  })

  test('TC-004-07 Errors share one muted red and headings use serif', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const first = await newPlayer()
    await first.home.goto()
    await first.home.createButton.click()
    const reds: [string, Rgba][] = [['field error', (await textColors(first.page.getByRole('alert'))).fg]]
    const homeFonts = await first.page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => getComputedStyle(h).fontFamily))

    let flags!: FrameFlags
    const { host, guest } = await room(newPlayer, async (page) => {
      flags = await controlFrames(page)
    })
    await host.room.reveal()
    await expect(host.room.revealError).toHaveText(REVEAL_ERROR)
    reds.push(['reveal error', (await textColors(host.room.revealError)).fg])
    const roomFonts = await host.page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => getComputedStyle(h).fontFamily))

    flags.dropIntent = true
    await guest.room.card('8').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    reds.push(['vote error', (await textColors(guest.room.voteError)).fg])
    await host.page.close()
    await guest.room.expectHostLeft()
    reds.push(['Host-left alert', (await textColors(guest.room.hostLeftAlert)).fg])

    for (const [name, color] of reds) {
      expect.soft(isMutedRed(color), `${name} ${rgbText(color)} is muted red`).toBe(true)
      expect.soft(rgbText(color), `${name} equals the field error colour`).toBe(rgbText(reds[0][1]))
    }
    for (const family of [...homeFonts, ...roomFonts]) {
      expect(family.split(',').at(-1)!.trim(), `heading font ${family}`).toBe('serif')
    }
  })

  test('TC-004-08 No pre-US-004 colour on Home', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.home.createButton.click()
    await expect(p.page.getByRole('alert')).toBeVisible()
    const colors = await colorSnapshot(p.page)
    for (const old of OLD_PALETTE) expect.soft(colors, `Home uses old colour ${old}`).not.toContain(old)
  })

  test('TC-004-08 No pre-US-004 colour in the Room', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await host.room.reveal()
    await expect(host.room.revealError).toBeVisible()
    for (const old of OLD_PALETTE) expect.soft(await colorSnapshot(host.page), `voting uses ${old}`).not.toContain(old)
    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    for (const player of [host, guest]) {
      const colors = await colorSnapshot(player.page)
      for (const old of OLD_PALETTE) expect.soft(colors, `revealed uses ${old}`).not.toContain(old)
    }
  })
})

// ======================================================================
// 4. Behavior and copy unchanged (AC-004-04)
// ======================================================================
test.describe('US-004 AC-004-04 behavior unchanged', () => {
  test('TC-004-09 Full flow without reload', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    await fullFlow(newPlayer)
  })

  test('TC-004-10 Guest DOM has no Reveal or Revote', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await expect(host.room.revealButton).toHaveCount(1)
    await expect(guest.room.revealButton).toHaveCount(0)
    await expect(guest.room.revoteButton).toHaveCount(0)
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVEAL)

    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    await expect(host.room.revoteButton).toHaveCount(1)
    await expect(guest.room.revealButton).toHaveCount(0)
    await expect(guest.room.revoteButton).toHaveCount(0)
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVOTE)
  })

  test('TC-004-11 Other votes are never visible before reveal', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guests } = await roomOf(newPlayer, ['Noah', 'Linh'])
    const [noah, linh] = guests
    await cast(noah, 'Noah', '13')
    await cast(linh, 'Linh', '?')

    for (const [viewer, own] of [[host, 'Maya'], [noah, 'Noah'], [linh, 'Linh']] as [Player, string][]) {
      for (const other of ['Maya', 'Noah', 'Linh'].filter((n) => n !== own)) {
        await expect(viewer.room.voteCell(other)).toHaveText(/^(Voted|Not voted)$/)
        await expect(viewer.room.row(other)).not.toContainText(/\b13\b|\?/)
      }
    }
    await expect(noah.room.card('13')).toHaveAttribute('aria-pressed', 'true')
    await expect(linh.room.card('?')).toHaveAttribute('aria-pressed', 'true')
  })

  test('TC-004-12 Client validation messages are exact and linked', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()

    await p.home.createButton.click()
    await p.home.expectFieldError(p.home.createName, MSG.nameRequired)
    await expect(p.page.getByRole('alert').filter({ hasText: MSG.nameRequired })).toBeVisible()

    await p.home.fillCreate('A'.repeat(21))
    await p.home.createButton.click()
    await p.home.expectFieldError(p.home.createName, MSG.nameTooLong)
    await expect(p.home.createName).toHaveValue('A'.repeat(21))

    await p.home.fillJoin('', 'Noah')
    await p.home.joinButton.click()
    await p.home.expectFieldError(p.home.joinCode, MSG.codeRequired)
    await expect(p.home.joinName).toHaveValue('Noah')

    await p.home.fillJoin('ab', 'Noah')
    await p.home.joinButton.click()
    await p.home.expectFieldError(p.home.joinCode, MSG.codeFormat)
    await expect(p.home.joinCode).toHaveValue('ab')
  })

  test('TC-004-12 A nonexistent room shows the exact unreachable message and keeps input', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const p = await newPlayer()
    await p.home.goto()
    await p.home.join('ZZZZZZ', 'Noah')

    await expect(p.home.formError('join')).toHaveText(MSG.roomUnavailable, { timeout: 20_000 })
    await expect(p.home.formError('join')).toHaveAttribute('role', 'alert')
    await expect(p.home.joinCode).toHaveValue('ZZZZZZ')
    await expect(p.home.joinName).toHaveValue('Noah')
    const log: string[] = []
    await expectContrast(log, 'form error', p.home.formError('join'))
    recordContrast(log)
  })

  test('TC-004-13 Reveal with no votes is blocked; an all-? round shows ? for everyone', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await host.room.reveal()
    await expect(host.room.revealError).toHaveText(REVEAL_ERROR)
    await host.room.expectPhase('voting')
    await guest.room.expectPhase('voting')

    await cast(host, 'Maya', '?')
    await cast(guest, 'Noah', '?')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await host.room.reveal()
    for (const player of [host, guest]) {
      await player.room.expectPhase('revealed')
      await expect(player.room.voteCell('Maya')).toHaveText('?')
      await expect(player.room.voteCell('Noah')).toHaveText('?')
      await expect(player.room.participation).toHaveText('2 of 2 voted')
    }
  })
})

// ======================================================================
// 5. Layout contract (AC-004-05)
// ======================================================================
test.describe('US-004 AC-004-05 layout', () => {
  test('TC-004-16 Room layout per viewport', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host } = await room(newPlayer)
    for (const viewport of VIEWPORTS) {
      await host.page.setViewportSize({ width: viewport.width, height: viewport.height })
      const where = viewport.name
      expect.soft(await mainPadding(host.page), `${where}: padding`).toBe(viewport.padding)
      expect.soft(Math.round((await box(host.page.locator('main'))).width), `${where}: container width equals the pre-US-004 baseline`).toBe(Math.min(viewport.width, 1024))
      const grid = await host.room.cardGroup.evaluate((el) => {
        const s = getComputedStyle(el)
        return { columns: s.gridTemplateColumns.split(' ').length, gap: parseFloat(s.columnGap) }
      })
      expect.soft(grid.columns, `${where}: columns`).toBe(viewport.columns)
      expect.soft(grid.gap, `${where}: gap`).toBe(viewport.gap)
      await expect(host.room.cardButtons).toHaveCount(9)
      expect.soft((await box(host.room.card('0'))).height, `${where}: card height`).toBeGreaterThanOrEqual(viewport.cardMin)

      const players = await box(host.page.getByRole('region', { name: /^Players/ }))
      const cards = await box(host.room.cardGroup)
      if (viewport.sidebar > 0) {
        expect.soft(Math.round(players.width), `${where}: sidebar`).toBe(viewport.sidebar)
        expect.soft(players.x + players.width, `${where}: Players left of cards`).toBeLessThanOrEqual(cards.x)
      } else {
        const header = await box(host.page.locator('header'))
        expect.soft(header.y + header.height, `${where}: header above Players`).toBeLessThanOrEqual(players.y + 1)
        expect.soft(players.y + players.height, `${where}: Players above the cards`).toBeLessThanOrEqual(cards.y + 1)
      }
    }
  })

  test('TC-004-17 Home layout per viewport', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    for (const viewport of VIEWPORTS) {
      await p.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await p.home.goto()
      const where = viewport.name
      expect.soft(await mainPadding(p.page), `${where}: padding`).toBe(viewport.padding)
      expect.soft(Math.round((await box(p.page.locator('main'))).width), `${where}: container width equals the pre-US-004 baseline`).toBe(Math.min(viewport.width, 768))
      const create = await box(p.home.createRegion)
      const join = await box(p.home.joinRegion)
      const sideBySide = Math.abs(create.y - join.y) < 1 && create.x < join.x
      expect.soft(sideBySide, `${where}: panels ${viewport.width >= 768 ? 'side by side' : 'stacked'}`).toBe(viewport.width >= 768)
    }
  })

  test('TC-004-18 No overflow, clipped action or decoration overlap', async ({ newPlayer }) => {
    test.setTimeout(180_000)
    const { host, guests } = await roomOf(newPlayer, LONG_NAMES)
    const [first, second] = guests
    await cast(host, 'Maya', '5')
    await cast(first, LONG_NAMES[0], '8')
    await expect(second.room.voteCell(LONG_NAMES[0])).toHaveText('Voted')

    const home = await newPlayer()
    for (const viewport of VIEWPORTS) {
      await host.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await home.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await home.home.goto()
      await home.home.createButton.click()
      await expect(home.page.getByRole('alert')).toBeVisible()
      expect.soft(await overflow(home.page), `${viewport.name}: Home overflow`).toBeLessThanOrEqual(0)

      for (const phase of ['voting', 'revealed'] as const) {
        if (phase === 'revealed' && (await host.room.phase.innerText()) !== 'revealed') {
          await host.room.reveal()
          await host.room.expectPhase('revealed')
        }
        const action = phase === 'voting' ? host.room.revealButton : host.room.revoteButton
        await action.scrollIntoViewIfNeeded()
        const actionBox = await box(action)
        expect.soft(await overflow(host.page), `${viewport.name} ${phase}: overflow`).toBeLessThanOrEqual(0)
        expect.soft(actionBox.x >= 0 && actionBox.x + actionBox.width <= viewport.width, `${viewport.name} ${phase}: action inside the viewport`).toBe(true)
        const rowOverflow = await host.room.playersList.evaluate((ul) => [...ul.children].filter((li) => li.scrollWidth > li.clientWidth).length)
        expect.soft(rowOverflow, `${viewport.name} ${phase}: roster rows wrap`).toBe(0)

        const decorations = await decorationBoxes(host.page)
        const content = await contentBoxes(host.page)
        for (const d of decorations) {
          for (const c of content) {
            expect.soft(intersects(d, c), `${viewport.name} ${phase}: decoration overlaps content`).toBe(false)
          }
        }
      }
    }
    await host.page.close()
    await second.room.expectHostLeft()
    for (const viewport of VIEWPORTS) {
      await second.page.setViewportSize({ width: viewport.width, height: viewport.height })
      expect.soft(await overflow(second.page), `${viewport.name}: Host-left overflow`).toBeLessThanOrEqual(0)
    }
  })
})

// ======================================================================
// 6. State distinction (AC-004-06)
// ======================================================================
test.describe('US-004 AC-004-06 states', () => {
  test('TC-004-19 Selected and unselected cards differ by more than colour', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { guest } = await room(newPlayer)
    await guest.room.card('5').click()
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')

    const selected = await styleOf(guest.room.card('5'))
    const plain = await styleOf(guest.room.card('3'))
    expect(selected.background).not.toBe(plain.background)
    expect(nonColorDiffers(selected, plain), 'a fill-colour-only difference fails').toBe(true)
  })

  test('TC-004-20 Pending and failed cards show text and a non-colour cue', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    let flags!: FrameFlags
    const { guest } = await room(newPlayer, async (page) => {
      flags = await controlFrames(page)
    })

    flags.delayAck = true
    await guest.room.card('5').click()
    await expect(guest.room.voteStatus).toHaveText(VOTE_PENDING_MESSAGE)
    await expect(guest.room.card('5')).toHaveAttribute('data-selection', 'pending')
    const pending = await styleOf(guest.room.card('5'))
    const plain = await styleOf(guest.room.card('0'))
    expect(pending.borderStyle).not.toBe(plain.borderStyle)
    await expect(guest.room.card('5')).toHaveAttribute('aria-pressed', 'true')
    flags.delayAck = false

    flags.dropIntent = true
    await guest.room.card('8').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    await expect(guest.room.card('8')).toHaveAttribute('data-selection', 'failed')
    await expect(guest.room.card('8')).toHaveAttribute('aria-pressed', 'false')
    await expect(guest.room.retry).toBeVisible()
  })

  test('TC-004-21 Disabled cards after reveal differ from enabled ones', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    const enabledGuest = await styleOf(guest.room.card('3'))
    const enabledHost = await styleOf(host.room.card('3'))
    await cast(host, 'Maya', '5')
    await host.room.reveal()

    for (const [player, enabled] of [[host, enabledHost], [guest, enabledGuest]] as [Player, Style][]) {
      await player.room.expectPhase('revealed')
      await expect(player.room.card('3')).toBeDisabled()
      const disabled = await styleOf(player.room.card('3'))
      expect(disabled.opacity !== enabled.opacity || disabled.cursor !== enabled.cursor || nonColorDiffers(disabled, enabled)).toBe(true)
      await expect(player.room.voteCell('Maya')).toHaveText('5')
    }
  })

  test('TC-004-23 Errors and roster status are visible text', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const p = await newPlayer()
    await p.home.goto()
    await p.home.createButton.click()
    await expect(p.page.getByText(MSG.nameRequired)).toBeVisible()

    const { host, guest } = await room(newPlayer)
    await expect(host.room.voteCell('Noah')).toHaveText('Not voted')
    await cast(guest, 'Noah', '5')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
  })
})

// ======================================================================
// 7. Accessibility (AC-004-07)
// ======================================================================
async function focusStops(page: Page, max = 40) {
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  const stops: { name: string; visible: boolean; distinct: boolean }[] = []
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body || el.dataset.visited === 'true') return null
      el.dataset.visited = 'true'
      const target = el instanceof HTMLInputElement && el.type === 'radio' ? (el.closest('label') ?? el) : el
      const s = getComputedStyle(target)
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
      return {
        name: (el.getAttribute('aria-label') ?? el.innerText ?? el.id ?? '').trim() || el.tagName,
        visible: outline || s.boxShadow !== 'none',
        distinct: outline ? s.outlineColor !== s.backgroundColor : true,
      }
    })
    if (!info) break
    stops.push(info)
  }
  return stops
}

test.describe('US-004 AC-004-07 accessibility', () => {
  test('TC-004-24 Home text and button contrast is at least 4.5:1', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.home.createButton.click()
    const log: string[] = []
    await expectContrast(log, 'title', p.page.getByRole('heading', { level: 1 }))
    await expectContrast(log, 'subtitle', p.page.getByText('Estimate together, without signing up.'))
    await expectContrast(log, 'panel heading', p.page.getByRole('heading', { name: 'Create room' }))
    await expectContrast(log, 'label', p.page.getByText('Room code', { exact: true }))
    await expectContrast(log, 'input text', p.home.createName)
    await expectContrast(log, 'Create room button', p.home.createButton)
    await expectContrast(log, 'Join room button', p.home.joinButton)
    await expectContrast(log, 'field error', p.page.getByRole('alert'))
    recordContrast(log)
  })

  test('TC-004-25 Room text and button contrast is at least 4.5:1', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    let flags!: FrameFlags
    const { host, guest } = await room(newPlayer, async (page) => {
      flags = await controlFrames(page)
    })
    const log: string[] = []

    await host.room.reveal()
    await expect(host.room.revealError).toHaveText(REVEAL_ERROR)
    await expectContrast(log, 'reveal error', host.room.revealError)

    flags.dropIntent = true
    await guest.room.card('1').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    await expectContrast(log, 'vote error', guest.room.voteError)
    await expectContrast(log, 'Retry', guest.room.retry)
    flags.dropIntent = false
    await guest.room.retry.click()
    await expect(guest.room.card('1')).toHaveAttribute('aria-pressed', 'true')

    await cast(host, 'Maya', '5')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expectContrast(log, 'roster row', host.room.row('Noah'))
    await expectContrast(log, 'roster muted role', host.room.row('Maya').getByText('Host'))
    await expectContrast(log, 'roster Voted', host.room.voteCell('Noah'))
    await expectContrast(log, 'Players heading', host.room.playersHeading)
    await expectContrast(log, 'phase heading', host.room.phaseHeading)
    await expectContrast(log, 'Copy link', host.room.copyLink)
    await expectContrast(log, 'Reveal estimates', host.room.revealButton)
    await expectContrast(log, 'selected card', host.room.card('5'))
    await expectContrast(log, 'unselected card', host.room.card('3'))
    await expectContrast(log, 'Guest waiting text', guest.room.phaseWaiting)

    await host.room.reveal()
    await host.room.expectPhase('revealed')
    await expectContrast(log, 'Revote', host.room.revoteButton)
    await expectContrast(log, 'Results heading', host.room.resultsPanel.getByRole('heading'))
    await expectContrast(log, 'participation', host.room.participation)
    await expectContrast(log, 'revealed value', host.room.voteCell('Maya'))

    await host.page.close()
    await guest.room.expectHostLeft()
    await expectContrast(log, 'Host-left alert', guest.room.hostLeftAlert)
    await expectContrast(log, 'Return to Home', guest.room.returnHome)
    recordContrast(log)
  })

  test('TC-004-26 Every interactive element has a visible focus indicator in DOM order', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const home = await newPlayer()
    await home.home.goto()
    const homeStops = await focusStops(home.page)
    expect(homeStops.length).toBeGreaterThan(0)

    const { host, guest } = await room(newPlayer)
    const hostStops = await focusStops(host.page)
    const guestStops = await focusStops(guest.page)
    const names = hostStops.map((s) => s.name)
    expect(names.indexOf('Copy link'), 'Copy link is first in the header').toBeGreaterThanOrEqual(0)
    expect(names.indexOf('0'), 'cards follow the header').toBeGreaterThan(names.indexOf('Copy link'))
    expect(names.indexOf('Reveal estimates'), 'the action follows the cards').toBeGreaterThan(names.indexOf('?'))
    expect(guestStops.map((s) => s.name)).not.toContain('Reveal estimates')

    await host.page.close()
    await guest.room.expectHostLeft()
    const leftStops = await focusStops(guest.page)
    expect(leftStops.map((s) => s.name)).toContain('Return to Home')

    for (const [where, stops] of [['Home', homeStops], ['Host room', hostStops], ['Guest room', guestStops], ['Host-left', leftStops]] as const) {
      for (const stop of stops) {
        expect.soft(stop.visible, `${where}: "${stop.name}" shows a focus indicator`).toBe(true)
        expect.soft(stop.distinct, `${where}: "${stop.name}" indicator differs from its background`).toBe(true)
      }
    }
  })

  test('TC-004-27 Buttons and cards are at least 44x44 px', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    let flags!: FrameFlags
    const { host, guest } = await room(newPlayer, async (page) => {
      flags = await controlFrames(page)
    })
    const home = await newPlayer()
    flags.dropIntent = true
    await guest.room.card('1').click()
    await expect(guest.room.retry).toBeVisible()

    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
      for (const page of [host.page, guest.page, home.page]) await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await home.home.goto()
      const states: [string, Page][] = [['Home', home.page], ['Host voting', host.page], ['Guest failed vote', guest.page]]
      for (const [name, page] of states) {
        const buttons = await page.getByRole('button').all()
        for (const button of buttons) {
          if (!(await button.isVisible())) continue
          const b = await box(button)
          const label = (await button.innerText()).trim()
          expect.soft(b.width, `${viewport.name} ${name} "${label}" width`).toBeGreaterThanOrEqual(44)
          expect.soft(b.height, `${viewport.name} ${name} "${label}" height`).toBeGreaterThanOrEqual(44)
        }
      }
      if (viewport.name === 'narrow') {
        for (const value of CARD_VALUES) expect.soft((await box(host.room.card(value))).height, `narrow card ${value}`).toBeGreaterThanOrEqual(88)
      }
    }
    flags.dropIntent = false
    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await host.room.expectPhase('revealed')
    const revote = await box(host.room.revoteButton)
    expect(revote.width).toBeGreaterThanOrEqual(44)
    expect(revote.height).toBeGreaterThanOrEqual(44)
  })

  test('TC-004-28 Field errors stay linked to their inputs', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const cases: [Locator, string, () => Promise<void>][] = [
      [p.home.createName, MSG.nameRequired, async () => p.home.createButton.click()],
      [p.home.joinCode, MSG.codeRequired, async () => {
        await p.home.fillJoin('', 'Noah')
        await p.home.joinButton.click()
      }],
      [p.home.joinCode, MSG.codeFormat, async () => {
        await p.home.fillJoin('ab', 'Noah')
        await p.home.joinButton.click()
      }],
      [p.home.joinName, MSG.nameRequired, async () => {
        await p.home.fillJoin('ABC234', '')
        await p.home.joinButton.click()
      }],
      [p.home.joinName, MSG.nameTooLong, async () => {
        await p.home.fillJoin('ABC234', 'A'.repeat(21))
        await p.home.joinButton.click()
      }],
    ]
    for (const [input, message, trigger] of cases) {
      await trigger()
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toHaveAccessibleDescription(message)
      const describedBy = await input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      const error = p.page.locator(`#${describedBy}`)
      await expect(error).toHaveAttribute('role', 'alert')
      await expect(error).toHaveText(message)
    }
  })
})

// ======================================================================
// 8. No new dependency or remote asset (AC-004-08)
// ======================================================================
test.describe('US-004 AC-004-08 no remote assets', () => {
  test('TC-004-29 Theme applies with third-party origins blocked', { tag: '@home' }, async ({ newPlayer, baseURL }) => {
    const appOrigin = new URL(baseURL!).origin
    const p = await newPlayer()
    const foreign: string[] = []
    const failed: string[] = []
    await p.context.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith('data:') || new URL(url).origin === appOrigin) return route.continue()
      foreign.push(url)
      return route.abort()
    })
    p.page.on('requestfailed', (request) => failed.push(request.url()))
    await p.home.goto()

    const { bg } = await textColors(p.page.locator('body'))
    expect(isPaperTone(bg)).toBe(true)
    const family = await p.page.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily)
    expect(family.split(',').at(-1)!.trim()).toBe('serif')
    expect(foreign, 'requests to other origins').toEqual([])
    expect(failed, 'failed font or stylesheet requests').toEqual([])
  })
})

// ======================================================================
// 9. Deployment
// ======================================================================
test.describe('US-004 deployment', () => {
  test('TC-004-32 Happy path on the public URL', async ({ newPlayer, baseURL }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'needs PLAYWRIGHT_BASE_URL pointing at the deployed app')
    test.setTimeout(ROOM_TIMEOUT)
    test.info().annotations.push({ type: 'base-url', description: baseURL ?? '' })
    await fullFlow(newPlayer)
  })
})

// ======================================================================
// 10. Decoration and imagery (AC-004-09, 10, 11 and rev 3 lines)
// ======================================================================
const pseudoContent = (locator: Locator) =>
  locator.first().evaluate((el) => ['::before', '::after'].map((p) => ({ content: getComputedStyle(el, p).content, position: getComputedStyle(el, p).position })))

const hasContent = (items: { content: string; position: string }[]) => items.every((i) => i.content !== 'none' && i.content !== 'normal' && i.position === 'absolute')

/** Worst contrast of text over its own background texture: hide the text, screenshot, decode and take the extremes. */
async function worstContrastOverTexture(page: Page, locator: Locator): Promise<number> {
  const { fg } = await textColors(locator)
  await locator.evaluate((el) => {
    const node = el as HTMLElement
    node.dataset.prevColor = node.style.color
    node.style.color = 'transparent'
  })
  const shot = await locator.screenshot()
  await locator.evaluate((el) => {
    const node = el as HTMLElement
    node.style.color = node.dataset.prevColor ?? ''
  })
  const extremes = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const lin = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    let min = 1
    let max = 0
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2])
      if (l < min) min = l
      if (l > max) max = l
    }
    return { min, max }
  }, shot.toString('base64'))
  const text = luminance(fg)
  return Math.min(contrastOf(text, extremes.min), contrastOf(text, extremes.max))
}

/** Rects of text nodes that come within `band` px of their panel edge. */
const textInsideBand = (panel: Locator, band: number) =>
  panel.evaluate((el, edge) => {
    const outer = el.getBoundingClientRect()
    const hits: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.left < outer.left + edge || r.right > outer.right - edge || r.top < outer.top + edge || r.bottom > outer.bottom - edge) {
        hits.push((node.textContent ?? '').trim().slice(0, 30))
      }
    }
    return hits
  }, band)

test.describe('US-004 AC-004-09/10/11 decoration', () => {
  test('TC-004-34 Home shows one illustration, a divider and panel ornaments, scaled down when narrow', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    const widths: number[] = []
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await p.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await p.home.goto()
      const illustrations = await p.page.evaluate(() =>
        [...document.querySelectorAll('svg')].map((s) => s.getBoundingClientRect().width).filter((w) => w >= 48),
      )
      expect(illustrations.length, `${viewport.name}: one illustration`).toBe(1)
      widths.push(illustrations[0])

      await expect(p.page.locator('.ornament-divider')).toHaveCount(1)
      const divider = await box(p.page.locator('.ornament-divider'))
      const subtitle = await box(p.page.getByText('Estimate together, without signing up.'))
      expect(divider.y, `${viewport.name}: divider is after the title block`).toBeGreaterThanOrEqual(subtitle.y + subtitle.height)
      for (const region of [p.home.createRegion, p.home.joinRegion]) {
        expect(hasContent(await pseudoContent(region)), `${viewport.name}: panel ornaments`).toBe(true)
      }
      expect(await overflow(p.page), `${viewport.name}: horizontal overflow`).toBeLessThanOrEqual(0)
      await p.home.createButton.scrollIntoViewIfNeeded()
      const create = await box(p.home.createButton)
      expect(create.x >= 0 && create.x + create.width <= viewport.width).toBe(true)
    }
    expect(widths[1], 'illustration is smaller at 390 px').toBeLessThan(widths[0])
    await expect(p.page.getByRole('heading', { name: 'Story Pointing', level: 1 })).toBeVisible()
    await expect(p.page.getByText('Estimate together, without signing up.')).toBeVisible()
  })

  test('TC-004-35 Room decoration keeps the structure and leaves card faces plain', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await cast(host, 'Maya', '5')

    for (const phase of ['voting', 'revealed'] as const) {
      if (phase === 'revealed') {
        await host.room.reveal()
        await guest.room.expectPhase('revealed')
        await expect(host.room.resultsPanel).toBeVisible()
        expect(hasContent(await pseudoContent(host.room.resultsPanel)), 'Results panel ornaments').toBe(true)
      }
      for (const player of [host, guest]) {
        const divider = player.page.locator('.ornament-divider').first()
        await expect(divider).toHaveCount(1)
        const header = await box(player.page.locator('header'))
        const players = await box(player.page.getByRole('region', { name: /^Players/ }))
        expect((await box(divider)).y, `${phase}: divider sits under the header`).toBeGreaterThanOrEqual(header.y + header.height - 1)
        expect((await box(divider)).y, `${phase}: divider is above Players`).toBeLessThanOrEqual(players.y)

        const body = await player.page.evaluate(() => {
          const s = getComputedStyle(document.body)
          return { image: s.backgroundImage, color: s.backgroundColor }
        })
        expect(body.image).not.toBe('none')
        expect(isPaperTone((await textColors(player.page.locator('body'))).bg), 'flat paper-tone background').toBe(true)
        expect(hasContent(await pseudoContent(player.page.getByRole('region', { name: /^Players/ }))), 'Players ornaments').toBe(true)

        const grid = await box(player.room.cardGroup)
        expect(players.x + players.width).toBeLessThanOrEqual(grid.x)
        for (const value of CARD_VALUES) {
          const card = player.room.card(value)
          await expect(card.locator('svg, img')).toHaveCount(0)
          await expect(card).toHaveText(value)
          const face = await card.evaluate((el) => ({
            image: getComputedStyle(el).backgroundImage,
            before: getComputedStyle(el, '::before').content,
            after: getComputedStyle(el, '::after').content,
          }))
          expect(face, `card ${value}`).toEqual({ image: 'none', before: 'none', after: 'none' })
        }
      }
    }
    const hostLeftPage = guest.page
    await host.page.close()
    await guest.room.expectHostLeft()
    await expect(hostLeftPage.getByRole('alert').first()).toHaveText(HOST_LEFT_MESSAGE)
    await expect(hostLeftPage.locator('.ornament-divider')).toHaveCount(1)
  })

  test('TC-004-36 Contrast holds over the texture and text stays off the ornament band (Home)', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const log: string[] = []
    for (const [name, locator] of [
      ['title', p.page.getByRole('heading', { level: 1 })],
      ['subtitle', p.page.getByText('Estimate together, without signing up.')],
    ] as [string, Locator][]) {
      const worst = await worstContrastOverTexture(p.page, locator)
      log.push(`${name}=${worst.toFixed(2)}`)
      expect.soft(worst, `${name} over texture`).toBeGreaterThanOrEqual(4.5)
    }
    for (const region of [p.home.createRegion, p.home.joinRegion]) {
      expect(await textInsideBand(region, 8), 'text in the ornament band').toEqual([])
    }
    recordContrast(log)
  })

  test('TC-004-36 Contrast holds over the texture and text stays off the ornament band (Room)', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host } = await room(newPlayer)
    const log: string[] = []
    const worstVoting = await worstContrastOverTexture(host.page, host.room.phaseHeading)
    log.push(`Phase heading=${worstVoting.toFixed(2)}`)
    expect.soft(worstVoting, 'Phase heading over texture').toBeGreaterThanOrEqual(4.5)
    expect(await textInsideBand(host.page.getByRole('region', { name: /^Players/ }), 8), 'Players text in the ornament band').toEqual([])

    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await host.room.expectPhase('revealed')
    expect(await textInsideBand(host.room.resultsPanel, 8), 'Results text in the ornament band').toEqual([])
    recordContrast(log)
  })

  test('TC-004-37 Decoration is hidden from assistive technology and the keyboard', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const home = await newPlayer()
    await home.home.goto()
    const { host } = await room(newPlayer)

    for (const [name, page] of [['Home', home.page], ['Room', host.page]] as [string, Page][]) {
      const report = await page.evaluate(() => {
        const decorative = [...document.querySelectorAll('svg, .ornament-divider')]
        return {
          count: decorative.length,
          notHidden: decorative.filter((el) => el.getAttribute('aria-hidden') !== 'true').length,
          tabindex: decorative.filter((el) => el.hasAttribute('tabindex')).length,
          roles: decorative.filter((el) => el.hasAttribute('role') || el.hasAttribute('aria-label') || el.querySelector('title')).length,
          text: decorative.filter((el) => (el.textContent ?? '').trim() !== '').length,
          images: document.querySelectorAll('img, picture, [role="img"]').length,
        }
      })
      expect(report.count, `${name}: has decoration`).toBeGreaterThan(0)
      expect(report, name).toMatchObject({ notHidden: 0, tabindex: 0, roles: 0, text: 0, images: 0 })
      expect(await page.locator('main').ariaSnapshot(), `${name}: no image or graphic in the accessibility tree`).not.toMatch(/\b(img|graphics-)/)

      await page.locator('body').click({ position: { x: 1, y: 1 } })
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab')
        const tag = await page.evaluate(() => document.activeElement?.tagName ?? '')
        expect(['INPUT', 'BUTTON', 'BODY'], `${name}: tab stop ${tag}`).toContain(tag)
      }
    }
  })

  test('TC-004-38 Decoration never blocks interaction', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const home = await newPlayer()
    await home.home.goto()
    const { host, guest } = await room(newPlayer)

    for (const [name, page] of [['Home', home.page], ['Host room', host.page], ['Guest room', guest.page]] as [string, Page][]) {
      const problems = await page.evaluate(() => {
        const out: string[] = []
        for (const control of document.querySelectorAll('input, button')) {
          const r = control.getBoundingClientRect()
          if (r.width < 8 || r.height < 8) continue
          const points = [
            [r.x + r.width / 2, r.y + r.height / 2],
            [r.x + 4, r.y + 4],
            [r.right - 4, r.y + 4],
            [r.x + 4, r.bottom - 4],
            [r.right - 4, r.bottom - 4],
          ]
          for (const [x, y] of points) {
            const top = document.elementFromPoint(x, y)
            if (top && !control.contains(top) && !top.contains(control)) out.push(`${control.tagName} covered by ${top.tagName}.${top.className}`)
          }
        }
        for (const el of document.querySelectorAll('svg, .ornament-divider, .ornate')) {
          if (!el.classList.contains('ornate') && getComputedStyle(el).pointerEvents !== 'none') out.push(`${el.tagName} accepts pointer events`)
          for (const pseudo of ['::before', '::after']) {
            if ((el.classList.contains('ornate') || el.classList.contains('ornament-divider')) && getComputedStyle(el, pseudo).pointerEvents !== 'none') {
              out.push(`${el.className}${pseudo} accepts pointer events`)
            }
          }
        }
        return out
      })
      expect(problems, name).toEqual([])
    }
    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await guest.room.expectPhase('revealed')
  })

  test('TC-004-39 Decoration is identical for every role, phase and vote state', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guests } = await roomOf(newPlayer, ['Noah', 'Linh'])
    const [noah, linh] = guests
    const players = [host, noah, linh]

    const first = await decorationInventory(host.page)
    for (const player of [noah, linh]) expect(await decorationInventory(player.page), 'before votes').toEqual(first)

    await cast(host, 'Maya', '13')
    await cast(noah, 'Noah', '?')
    await expect(linh.room.voteCell('Noah')).toHaveText('Voted')
    for (const player of players) expect(await decorationInventory(player.page), 'after votes').toEqual(first)

    await host.room.reveal()
    for (const player of players) await player.room.expectPhase('revealed')
    for (const player of players) expect(await decorationInventory(player.page), 'after reveal').toEqual(first)
  })

  test('TC-004-40 The flow works without images, svg or ornaments', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const hide = (page: Page) =>
      page.addStyleTag({ content: 'svg,.ornament-divider{display:none !important}.ornate::before,.ornate::after{content:none !important}' })

    const host = await newPlayer()
    await host.context.route('**/*', (route) => (route.request().resourceType() === 'image' ? route.abort() : route.continue()))
    await host.home.goto()
    await hide(host.page)
    await host.home.create('Maya')
    const code = await host.room.code()

    const guest = await newPlayer()
    await guest.context.route('**/*', (route) => (route.request().resourceType() === 'image' ? route.abort() : route.continue()))
    await guest.home.goto()
    await hide(guest.page)
    await guest.home.join(code, 'Noah')
    await guest.room.expectInRoom(code)
    await Promise.all([host, guest].map((p) => p.room.expectNames(['Maya', 'Noah'])))
    await hide(host.page)
    await hide(guest.page)

    await cast(host, 'Maya', '5')
    await cast(guest, 'Noah', '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await host.room.reveal()
    for (const player of [host, guest]) {
      await player.room.expectPhase('revealed')
      await expect(player.room.voteCell('Maya')).toHaveText('5')
      expect(await overflow(player.page)).toBeLessThanOrEqual(0)
    }
    await host.room.revote()
    await guest.room.expectPhase('voting')
    await expect(host.room.revealButton).toBeVisible()
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVEAL)
    await expect(guest.page.getByRole('heading', { name: 'Story Pointing', level: 1 })).toBeVisible()
  })
})
