import {
  expect,
  test as base,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test'
import { HomePage } from '../page-objects/HomePage'
import {
  CARD_VALUES,
  REVEAL_ERROR,
  RoomPage,
  VOTE_FAILED_MESSAGE,
  VOTE_PENDING_MESSAGE,
  WAIT_FOR_REVEAL,
  WAIT_FOR_REVOTE,
  type CardValue,
} from '../page-objects/RoomPage'
import { THEME_NAMES, ThemePicker, themeStatusText, type ThemeName } from '../page-objects/ThemePicker'

interface Player {
  context: BrowserContext
  page: Page
  home: HomePage
  room: RoomPage
  picker: ThemePicker
}

type NewPlayer = (options?: BrowserContextOptions) => Promise<Player>

// Every player gets its own browser context, so localStorage and sessionStorage are never shared.
const test = base.extend<{ newPlayer: NewPlayer }>({
  newPlayer: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (options) => {
      const context = await browser.newContext(options)
      contexts.push(context)
      const page = await context.newPage()
      return { context, page, home: new HomePage(page), room: new RoomPage(page), picker: new ThemePicker(page) }
    })
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)))
  },
})

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720, padding: 24, columns: 5, sidebar: 220 },
  { name: 'tablet', width: 768, height: 1024, padding: 16, columns: 3, sidebar: 180 },
  { name: 'narrow', width: 390, height: 844, padding: 12, columns: 3, sidebar: 0 },
] as const

const THEME_KEY = 'story-pointing:theme'
const OLD_PALETTE = ['rgb(69, 90, 100)', 'rgb(241, 243, 244)', 'rgb(38, 50, 56)', 'rgb(84, 110, 122)', 'rgb(179, 38, 30)', 'rgb(0, 95, 204)']
const ROOM_TIMEOUT = 120_000

// ---------- probes ----------

type Rgba = [number, number, number, number]
type Box = { x: number; y: number; width: number; height: number }

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

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
const ratio = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Soft-asserts 4.5:1 so one run reports every failing theme and element. */
async function expectContrast(log: string[], theme: ThemeName, label: string, locator: Locator) {
  const { fg, bg } = await textColors(locator)
  const value = ratio(fg, bg)
  log.push(`${theme} ${label}=${value.toFixed(2)}`)
  expect.soft(value, `${theme}: ${label} contrast`).toBeGreaterThanOrEqual(4.5)
}

const recordContrast = (log: string[]) => test.info().annotations.push({ type: 'contrast', description: log.join('; ') })

/** Every colour used by text, backgrounds, borders and SVG paint on the page. */
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
    }
  })

type Style = Awaited<ReturnType<typeof styleOf>>
const nonColorDiffers = (a: Style, b: Style) =>
  a.fontWeight !== b.fontWeight || a.boxShadow !== b.boxShadow || a.borderStyle !== b.borderStyle || a.borderWidth !== b.borderWidth

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function box(locator: Locator): Promise<Box> {
  const b = await locator.first().boundingBox()
  if (!b) throw new Error('element has no box')
  return b
}

const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** The Home illustration is the only SVG at least 48 px wide; icons are 24 px or smaller. */
const illustrationOf = (page: Page) =>
  page.evaluate(() => {
    for (const svg of document.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect()
      if (r.width >= 48) {
        const clone = svg.cloneNode(true) as SVGElement
        return { box: { x: r.x, y: r.y, width: r.width, height: r.height }, markup: clone.innerHTML }
      }
    }
    return null
  })

const markPage = (page: Page) => page.evaluate(() => ((window as unknown as Record<string, unknown>).__noReload = true))
const expectNoReload = async (page: Page) =>
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__noReload)).toBe(true)

/** Decorative inventory outside the Results panel: icon and illustration markup plus ornament counts. */
const decorationInventory = (page: Page) =>
  page.evaluate(() => {
    const results = document.querySelector('[data-testid="results-panel"]')
    const outside = (el: Element) => !results || !results.contains(el)
    return {
      svgs: [...document.querySelectorAll('svg')].filter(outside).map((svg) => svg.innerHTML),
      dividers: [...document.querySelectorAll('.ornament-divider')].filter(outside).length,
      panels: [...document.querySelectorAll('.ornate')].filter(outside).length,
    }
  })

// ---------- room helpers ----------

async function room(newPlayer: NewPlayer, guestSetup?: (page: Page) => Promise<void>) {
  const host = await newPlayer()
  await host.home.goto()
  await host.home.create('Maya')
  const code = await host.room.code()

  const guest = await newPlayer()
  await guestSetup?.(guest.page)
  await guest.home.goto()
  await guest.home.join(code, 'Noah')
  await guest.room.expectInRoom(code)
  await Promise.all([host, guest].map((player) => player.room.expectNames(['Maya', 'Noah'])))
  return { host, guest, code }
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

// ======================================================================
// AC-005-01 Theme picker
// ======================================================================
test.describe('US-005 AC-005-01 theme picker', () => {
  test('TC-005-01 Picker offers the six themes in order, each with an icon', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()

    await expect(p.picker.group).toBeVisible()
    await expect(p.picker.radios).toHaveCount(6)
    expect(await p.picker.names()).toEqual([...THEME_NAMES])
    for (const name of THEME_NAMES) {
      await expect(p.picker.radio(name)).toHaveCount(1) // named by its own text, not by the icon
      await expect(p.picker.label(name).locator('svg')).toHaveCount(1)
    }
  })

  test('TC-005-02 Default is Vintage, ignoring the OS preference; selection is not colour only', { tag: '@home' }, async ({ newPlayer }) => {
    const reference = await newPlayer()
    await reference.home.goto()
    await reference.picker.expectSelected('Vintage')
    const vintageBg = await bodyBg(reference.page)

    const darkOs = await newPlayer({ colorScheme: 'dark' })
    await darkOs.home.goto()
    await darkOs.picker.expectSelected('Vintage')
    expect(await bodyBg(darkOs.page)).toBe(vintageBg)

    const selected = await styleOf(reference.picker.label('Vintage'))
    const other = await styleOf(reference.picker.label('Light'))
    expect(nonColorDiffers(selected, other), 'selected choice differs by more than colour').toBe(true)
  })

  test('TC-005-03 Keyboard: first Tab reaches the picker, arrows switch, focus is visible', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()

    await p.page.keyboard.press('Tab')
    await expect(p.picker.radio('Vintage')).toBeFocused()
    const outline = await p.picker.label('Vintage').evaluate((el) => {
      const s = getComputedStyle(el)
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThan(0)

    await p.page.keyboard.press('ArrowRight')
    await expect(p.picker.radio('Light')).toBeChecked()
    await expect(p.picker.status).toHaveText(themeStatusText('Light'))
    await p.page.keyboard.press('ArrowRight')
    await expect(p.picker.radio('Dark')).toBeChecked()
    await p.page.keyboard.press('ArrowLeft')
    await p.page.keyboard.press('ArrowLeft')
    await expect(p.picker.radio('Vintage')).toBeChecked()
  })

  test('TC-005-04 Each choice is at least 44x44 px', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await p.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await p.home.goto()
      for (const name of THEME_NAMES) {
        const b = await box(p.picker.label(name))
        expect.soft(b.width, `${viewport.name} ${name} width`).toBeGreaterThanOrEqual(44)
        expect.soft(b.height, `${viewport.name} ${name} height`).toBeGreaterThanOrEqual(44)
      }
    }
  })

  test('TC-005-05 Room: picker sits on its own row after Copy link and moves nothing', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host } = await room(newPlayer)

    const codeBox = await box(host.room.roomCode)
    const copyBox = await box(host.room.copyLink)
    const pickerBox = await box(host.picker.group)
    expect(pickerBox.y).toBeGreaterThanOrEqual(copyBox.y + copyBox.height - 1)
    expect(intersects(pickerBox, codeBox)).toBe(false)
    expect(intersects(pickerBox, copyBox)).toBe(false)

    await host.room.copyLink.focus()
    await host.page.keyboard.press('Tab')
    await expect(host.picker.radio('Vintage')).toBeFocused()

    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      const nextCode = await box(host.room.roomCode)
      const nextCopy = await box(host.room.copyLink)
      expect.soft(Math.abs(nextCode.x - codeBox.x) + Math.abs(nextCode.y - codeBox.y), `${theme} room code moved`).toBeLessThan(1)
      expect.soft(Math.abs(nextCopy.x - copyBox.x) + Math.abs(nextCopy.y - copyBox.y), `${theme} Copy link moved`).toBeLessThan(1)
    }
  })
})

// ======================================================================
// AC-005-02 Switch applies immediately and changes nothing else
// ======================================================================
test.describe('US-005 AC-005-02 switch', () => {
  test('TC-005-06 Switching applies at once, without reload, and announces the change', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await markPage(p.page)
    const before = await bodyBg(p.page)

    await p.picker.choose('Ocean')

    await expect.poll(() => bodyBg(p.page)).not.toBe(before)
    await expect(p.picker.status).toHaveText(themeStatusText('Ocean'))
    await expect(p.page.getByRole('status').filter({ hasText: themeStatusText('Ocean') })).toHaveCount(1)
    await expect(p.picker.radio('Ocean')).toBeFocused()
    await expectNoReload(p.page)
  })

  test('TC-005-07 Typed form input survives a switch', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.home.fillCreate('Maya')
    await p.home.fillJoin('ABC234', 'Noah')

    await p.picker.choose('Dark')
    await p.picker.choose('Sunny')

    await expect(p.home.createName).toHaveValue('Maya')
    await expect(p.home.joinCode).toHaveValue('ABC234')
    await expect(p.home.joinName).toHaveValue('Noah')
    await expect(p.picker.radio('Sunny')).toBeFocused()
  })

  test('TC-005-08 Room state is unchanged by a switch and no realtime message is sent', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const host = await newPlayer()
    const sent: string[] = []
    host.page.on('websocket', (ws) => ws.on('framesent', (frame) => sent.push(String(frame.payload))))
    await host.home.goto()
    await host.home.create('Maya')
    const code = await host.room.code()
    const guest = await newPlayer()
    await guest.home.goto()
    await guest.home.join(code, 'Noah')
    await host.room.expectNames(['Maya', 'Noah'])

    await cast(guest, 'Noah', '5')
    await cast(host, 'Maya', '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted') // the Host has finished publishing
    const countBefore = sent.filter((s) => !s.includes('heartbeat')).length

    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await host.room.expectPhase('voting')
      await host.room.expectPlayerCount(2)
      await host.room.expectPressed('8')
      await expect(host.room.voteCell('Maya')).toHaveText('Voted')
      await expect(host.room.voteCell('Noah')).toHaveText('Voted')
      await expect(host.picker.radio(theme)).toBeFocused()
    }
    const countAfter = sent.filter((s) => !s.includes('heartbeat')).length
    expect(countAfter, 'frames sent by the theme switches').toBe(countBefore)

    await host.room.reveal() // proves frame capture works: a real action does send frames
    await guest.room.expectPhase('revealed')
    expect(sent.filter((s) => !s.includes('heartbeat')).length).toBeGreaterThan(countAfter)
    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await host.room.expectPhase('revealed')
      await expect(host.room.voteCell('Maya')).toHaveText('8')
      await expect(host.room.voteCell('Noah')).toHaveText('5')
      await expect(host.room.participation).toHaveText('2 of 2 voted')
    }
    await guest.room.expectPhase('revealed')
    await expect(guest.room.voteCell('Maya')).toHaveText('8')
    expect(sent.some((s) => /theme/i.test(s))).toBe(false)
  })
})

// ======================================================================
// AC-005-03 Choice is remembered and local
// ======================================================================
test.describe('US-005 AC-005-03 persistence', () => {
  test('TC-005-09 Choice survives a reload', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.picker.choose('Dark')
    const darkBg = await bodyBg(p.page)

    await p.page.reload()

    await p.picker.expectSelected('Dark')
    expect(await bodyBg(p.page)).toBe(darkBg)
  })

  test('TC-005-10 Choice applies to other rooms and later visits on the same browser', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const first = await newPlayer()
    await first.home.goto()
    await first.picker.choose('Sunny')
    const sunnyBg = await bodyBg(first.page)
    await first.home.create('Maya')
    await first.room.code()
    await first.picker.expectSelected('Sunny')
    expect(await bodyBg(first.page)).toBe(sunnyBg)

    const secondPage = await first.context.newPage()
    const second = { home: new HomePage(secondPage), room: new RoomPage(secondPage), picker: new ThemePicker(secondPage) }
    await second.home.goto()
    await second.picker.expectSelected('Sunny')
    await second.home.create('Maya2')
    await second.room.code()
    await second.picker.expectSelected('Sunny')
    expect(await bodyBg(secondPage)).toBe(sunnyBg)
  })

  test('TC-005-11 The saved theme is applied before the first visible frame', { tag: '@home' }, async ({ newPlayer }) => {
    const reference = await newPlayer()
    await reference.home.goto()
    const vintageBg = await bodyBg(reference.page)

    const p = await newPlayer()
    await p.home.goto()
    await p.picker.choose('Dark')
    const darkBg = await bodyBg(p.page)
    await p.page.addInitScript(() => {
      const w = window as unknown as { __seen: string[]; __stop?: boolean }
      w.__seen = []
      const tick = () => {
        if (document.body) w.__seen.push(getComputedStyle(document.body).backgroundColor)
        if (!w.__stop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    await p.page.reload()
    await expect(p.picker.group).toBeVisible()
    await p.page.evaluate(() => ((window as unknown as { __stop?: boolean }).__stop = true))

    const seen = await p.page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen, 'no frame showed the default theme').not.toContain(vintageBg)
    expect(seen).toContain(darkBg)
  })

  test('TC-005-12 Missing, invalid or unavailable storage falls back silently', { tag: '@home' }, async ({ newPlayer }) => {
    test.setTimeout(90_000)
    const reference = await newPlayer()
    await reference.home.goto()
    const vintageBg = await bodyBg(reference.page)

    for (const invalid of ['neon', 'DARK', ' dark', 'dark ', '']) {
      const p = await newPlayer()
      await p.context.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, invalid])
      await p.home.goto()
      await p.picker.expectSelected('Vintage')
      expect(await bodyBg(p.page), `stored "${invalid}"`).toBe(vintageBg)
      await expect(p.page.getByRole('alert')).toHaveCount(0)
    }

    const blocked = await newPlayer()
    await blocked.context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    })
    await blocked.home.goto()
    await blocked.picker.expectSelected('Vintage')
    await blocked.picker.choose('Ocean')
    await expect.poll(() => bodyBg(blocked.page)).not.toBe(vintageBg)
    await expect(blocked.page.getByRole('alert')).toHaveCount(0)
    await blocked.page.reload()
    await blocked.picker.expectSelected('Vintage')
  })

  test('TC-005-13 One Participant\'s theme never reaches another, nor the share link', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const host = await newPlayer()
    await host.context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await host.home.goto()
    await host.picker.choose('Dark')
    await host.home.create('Maya')
    const code = await host.room.code()
    const hostBg = await bodyBg(host.page)

    const guest = await newPlayer()
    await guest.home.goto()
    const guestBg = await bodyBg(guest.page)
    await guest.home.join(code, 'Noah')
    await host.room.expectNames(['Maya', 'Noah'])

    await guest.picker.expectSelected('Vintage')
    expect(await bodyBg(guest.page)).toBe(guestBg)
    expect(guestBg).not.toBe(hostBg)
    expect(guest.page.url()).not.toMatch(/theme/i)

    await host.room.copyLink.click()
    const link = await host.page.evaluate(() => navigator.clipboard.readText())
    expect(link).toMatch(new RegExp(`\\?room=${code}$`))
    expect(link).not.toMatch(/theme|dark/i)

    await guest.picker.choose('Sunny')
    await host.picker.expectSelected('Dark')
    expect(await bodyBg(host.page)).toBe(hostBg)
  })
})

// ======================================================================
// AC-005-04 Every theme is complete and readable
// ======================================================================
test.describe('US-005 AC-005-04 complete and readable', () => {
  test('TC-005-14 Switching leaves no colour from the previous theme', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const switched = new Map<ThemeName, string[]>()
    for (const theme of [...THEME_NAMES, 'Vintage', 'Dark'] as ThemeName[]) {
      await p.picker.choose(theme)
      switched.set(theme, await colorSnapshot(p.page))
    }
    const distinctBackgrounds = new Set<string>()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      distinctBackgrounds.add(await bodyBg(p.page))
      await p.page.reload()
      await p.picker.expectSelected(theme)
      expect.soft(await colorSnapshot(p.page), `${theme} after switching equals ${theme} on a fresh load`).toEqual(switched.get(theme))
    }
    expect(distinctBackgrounds.size, 'six distinct page backgrounds').toBe(6)
  })

  test('TC-005-15 No pre-US-004 colour appears in any theme', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.home.createButton.click() // shows a field error, the colour most likely to collide
    await expect(p.page.getByRole('alert')).toBeVisible()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const colors = await colorSnapshot(p.page)
      for (const old of OLD_PALETTE) expect.soft(colors, `${theme} uses old colour ${old}`).not.toContain(old)
    }
  })

  test('TC-005-16 Home text contrast is at least 4.5:1 in every theme', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    await p.home.createButton.click()
    const error = p.page.getByRole('alert')
    await expect(error).toBeVisible()
    const log: string[] = []
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const other = THEME_NAMES.find((n) => n !== theme)!
      await expectContrast(log, theme, 'title', p.page.getByRole('heading', { level: 1 }))
      await expectContrast(log, theme, 'subtitle', p.page.getByText('Estimate together, without signing up.'))
      await expectContrast(log, theme, 'picker legend', p.picker.group.locator('legend'))
      await expectContrast(log, theme, 'selected choice', p.picker.label(theme))
      await expectContrast(log, theme, 'unselected choice', p.picker.label(other))
      await expectContrast(log, theme, 'panel heading', p.page.getByRole('heading', { name: 'Create room' }))
      await expectContrast(log, theme, 'label', p.page.getByText('Room code', { exact: true }))
      await expectContrast(log, theme, 'input text', p.home.createName)
      await expectContrast(log, theme, 'Create room button', p.home.createButton)
      await expectContrast(log, theme, 'Join room button', p.home.joinButton)
      await expectContrast(log, theme, 'field error', error)
    }
    recordContrast(log)
  })

  test('TC-005-17 Room text contrast is at least 4.5:1 in every theme and phase', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    const log: string[] = []

    await host.room.reveal()
    await expect(host.room.revealError).toHaveText(REVEAL_ERROR)
    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await expectContrast(log, theme, 'reveal error', host.room.revealError)
    }

    await cast(host, 'Maya', '5')
    await cast(guest, 'Noah', '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await guest.picker.choose(theme)
      await expectContrast(log, theme, 'roster row', host.room.row('Noah'))
      await expectContrast(log, theme, 'roster muted role', host.room.row('Maya').getByText('Host'))
      await expectContrast(log, theme, 'roster Voted', host.room.voteCell('Noah'))
      await expectContrast(log, theme, 'Players heading', host.room.playersHeading)
      await expectContrast(log, theme, 'phase heading', host.room.phaseHeading)
      await expectContrast(log, theme, 'Copy link', host.room.copyLink)
      await expectContrast(log, theme, 'Reveal estimates', host.room.revealButton)
      await expectContrast(log, theme, 'selected card', host.room.card('5'))
      await expectContrast(log, theme, 'unselected card', host.room.card('3'))
      await expectContrast(log, theme, 'Guest waiting text', guest.room.phaseWaiting)
    }

    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await expectContrast(log, theme, 'Revote', host.room.revoteButton)
      await expectContrast(log, theme, 'Results heading', host.room.resultsPanel.getByRole('heading'))
      await expectContrast(log, theme, 'participation', host.room.participation)
      await expectContrast(log, theme, 'revealed value', host.room.voteCell('Maya'))
    }
    recordContrast(log)
  })

  test('TC-005-18 Card and feedback states stay distinguishable beyond colour in every theme', async ({ newPlayer }) => {
    test.setTimeout(180_000)
    let flags!: FrameFlags
    const { host, guest } = await room(newPlayer, async (page) => {
      flags = await controlFrames(page)
    })
    await cast(host, 'Maya', '5')
    await cast(guest, 'Noah', '8')

    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      const selected = await styleOf(guest.room.card('8'))
      const unselected = await styleOf(guest.room.card('3'))
      await expect(guest.room.card('8')).toHaveAttribute('aria-pressed', 'true')
      expect(nonColorDiffers(selected, unselected), `${theme}: selected card differs by more than colour`).toBe(true)
    }

    flags.delayAck = true
    const pendingValues: CardValue[] = ['13', '21', '2', '3', '13', '21']
    for (const [i, theme] of THEME_NAMES.entries()) {
      await guest.picker.choose(theme)
      const card = guest.room.card(pendingValues[i])
      await card.click()
      await expect(guest.room.voteStatus).toHaveText(VOTE_PENDING_MESSAGE)
      const pending = await styleOf(card)
      const plain = await styleOf(guest.room.card('0'))
      expect.soft(nonColorDiffers(pending, plain), `${theme}: pending card differs by more than colour`).toBe(true)
      await expect(card).toHaveAttribute('aria-pressed', 'true')
    }
    flags.delayAck = false

    flags.dropIntent = true
    await guest.room.card('1').click()
    await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      await expect(guest.room.voteError).toHaveText(VOTE_FAILED_MESSAGE)
      await expect(guest.room.retry).toBeVisible()
      await expect(guest.room.card('1')).toHaveAttribute('aria-pressed', 'false')
    }
    flags.dropIntent = false
    await guest.room.retry.click()
    await expect(guest.room.card('1')).toHaveAttribute('aria-pressed', 'true')

    const enabled = new Map<ThemeName, Style>()
    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      enabled.set(theme, await styleOf(guest.room.card('3')))
    }
    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      await expect(guest.room.card('3')).toBeDisabled()
      const disabled = await styleOf(guest.room.card('3'))
      const before = enabled.get(theme)!
      expect(
        disabled.opacity !== before.opacity || disabled.cursor !== before.cursor || nonColorDiffers(disabled, before),
        `${theme}: disabled card looks like an enabled card`,
      ).toBe(true)
    }
  })
})

// ======================================================================
// AC-005-05 Themed images and icons
// ======================================================================
test.describe('US-005 AC-005-05 themed images and icons', () => {
  test('TC-005-19 One distinct illustration per theme near the title', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const markups = new Set<string>()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const art = await illustrationOf(p.page)
      expect(art, `${theme} has an illustration`).not.toBeNull()
      const title = await box(p.page.getByRole('heading', { level: 1 }))
      expect(art!.box.y < title.y + title.height && title.y < art!.box.y + art!.box.height, `${theme}: illustration is level with the title`).toBe(true)
      markups.add(art!.markup)
      expect(await p.page.evaluate(() => [...document.querySelectorAll('svg')].filter((s) => s.getBoundingClientRect().width >= 48).length)).toBe(1)
    }
    expect(markups.size, 'six different illustrations').toBe(6)
  })

  test('TC-005-20 Heading and picker icons belong to the theme and keep heading text', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const pickerIcons = new Map<ThemeName, string>()
    for (const name of THEME_NAMES) pickerIcons.set(name, await p.picker.label(name).locator('svg').innerHTML())
    expect(new Set(pickerIcons.values()).size, 'six different picker icons').toBe(6)

    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      for (const text of ['Create room', 'Join room']) {
        const heading = p.page.getByRole('heading', { name: text, exact: true })
        await expect(heading).toHaveText(text)
        await expect(heading.locator('svg')).toHaveCount(1)
        expect(await heading.locator('svg').innerHTML(), `${theme}: ${text} icon`).toBe(pickerIcons.get(theme))
      }
    }
  })

  test('TC-005-21 Room: Players and Results icons belong to the theme and cards show only their value', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    const pickerIcons = new Map<ThemeName, string>()
    for (const name of THEME_NAMES) pickerIcons.set(name, await host.picker.label(name).locator('svg').innerHTML())

    await cast(host, 'Maya', '5')
    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    for (const theme of THEME_NAMES) {
      await host.picker.choose(theme)
      await expect(host.room.playersHeading.locator('svg')).toHaveCount(1)
      expect.soft(await host.room.playersHeading.locator('svg').innerHTML(), `${theme}: Players icon`).toBe(pickerIcons.get(theme))
      const resultsHeading = host.room.resultsPanel.getByRole('heading')
      await expect(resultsHeading).toHaveText('Results')
      expect.soft(await resultsHeading.locator('svg').innerHTML(), `${theme}: Results icon`).toBe(pickerIcons.get(theme))
      for (const value of CARD_VALUES) {
        await expect(host.room.card(value).locator('svg, img')).toHaveCount(0)
        await expect(host.room.card(value)).toHaveText(value)
      }
    }
  })

  test('TC-005-22 Every theme has ornaments (style is recorded, not asserted)', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    const signatures: string[] = []
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const sig = await p.page.evaluate(() => {
        const divider = document.querySelector('.ornament-divider')
        const panel = document.querySelector('.ornate')
        if (!divider || !panel) return null
        const line = getComputedStyle(divider, '::before')
        const mark = getComputedStyle(divider, '::after')
        const frame = getComputedStyle(panel, '::before')
        return {
          line: `${line.borderTopStyle} ${line.borderTopWidth}`,
          mark: mark.borderTopLeftRadius + '/' + mark.borderTopRightRadius,
          frame: frame.borderTopStyle,
          content: [line.content, frame.content],
        }
      })
      expect(sig, `${theme}: divider and panel ornaments exist`).not.toBeNull()
      expect(sig!.content.every((c) => c !== 'none' && c !== 'normal')).toBe(true)
      signatures.push(`${theme}: ${sig!.line}, mark ${sig!.mark}, frame ${sig!.frame}`)
    }
    test.info().annotations.push({ type: 'ornament-style', description: signatures.join(' | ') })
  })
})

// ======================================================================
// AC-005-06 Decoration is non-informational
// ======================================================================
test.describe('US-005 AC-005-06 decoration', () => {
  test('TC-005-23 Decoration is hidden from assistive technology and the keyboard', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const report = await p.page.evaluate(() => {
        const svgs = [...document.querySelectorAll('svg')]
        return {
          svgCount: svgs.length,
          notHidden: svgs.filter((s) => s.getAttribute('aria-hidden') !== 'true').length,
          named: svgs.filter((s) => s.hasAttribute('aria-label') || s.hasAttribute('role') || s.querySelector('title')).length,
          focusable: svgs.filter((s) => s.hasAttribute('tabindex') || s.getAttribute('focusable') === 'true').length,
          withText: svgs.filter((s) => (s.textContent ?? '').trim() !== '').length,
          images: document.querySelectorAll('img, picture, [role="img"]').length,
        }
      })
      expect(report.svgCount).toBeGreaterThan(0)
      expect(report, theme).toMatchObject({ notHidden: 0, named: 0, focusable: 0, withText: 0, images: 0 })
      const snapshot = await p.page.locator('main').ariaSnapshot()
      expect(snapshot, `${theme}: accessibility tree has no image or graphic`).not.toMatch(/\b(img|graphics-)/)
      for (const name of THEME_NAMES) await expect(p.picker.radio(name)).toHaveAccessibleName(name)
    }

    const stops: string[] = []
    await p.page.locator('body').click({ position: { x: 1, y: 1 } })
    for (let i = 0; i < 16; i++) {
      await p.page.keyboard.press('Tab')
      stops.push(await p.page.evaluate(() => document.activeElement?.tagName ?? ''))
    }
    expect(stops.filter((tag) => !['INPUT', 'BUTTON', 'BODY'].includes(tag)), 'tab stops are real controls').toEqual([])
  })

  test('TC-005-24 Decoration never blocks pointer input', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.home.goto()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      const blocked = await p.page.evaluate(() => {
        const problems: string[] = []
        const controls = [...document.querySelectorAll('input, button, label')]
        for (const control of controls) {
          const r = control.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const points = [
            [r.x + r.width / 2, r.y + r.height / 2],
            [r.x + 4, r.y + 4],
            [r.right - 4, r.y + 4],
            [r.x + 4, r.bottom - 4],
            [r.right - 4, r.bottom - 4],
          ]
          for (const [x, y] of points) {
            const top = document.elementFromPoint(x, y)
            if (top && !control.contains(top) && !top.contains(control)) problems.push(`${control.tagName}@${Math.round(x)},${Math.round(y)} covered by ${top.tagName}.${top.className}`)
          }
        }
        for (const el of document.querySelectorAll('svg, .ornament-divider')) {
          if (getComputedStyle(el).pointerEvents !== 'none') problems.push(`${el.tagName} accepts pointer events`)
        }
        for (const el of document.querySelectorAll('.ornate, .ornament-divider')) {
          for (const pseudo of ['::before', '::after']) {
            if (getComputedStyle(el, pseudo).pointerEvents !== 'none') problems.push(`${el.className}${pseudo} accepts pointer events`)
          }
        }
        return problems
      })
      expect(blocked, theme).toEqual([])
    }
  })

  test('TC-005-25 Decoration is identical for every role, phase and vote state', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await host.picker.choose('Ocean')
    await guest.picker.choose('Ocean')

    const first = await decorationInventory(host.page)
    expect(await decorationInventory(guest.page), 'Host and Guest').toEqual(first)

    await cast(host, 'Maya', '13')
    await cast(guest, 'Noah', '?')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    expect(await decorationInventory(host.page), 'after votes (Host)').toEqual(first)
    expect(await decorationInventory(guest.page), 'after votes (Guest)').toEqual(first)

    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    expect(await decorationInventory(host.page), 'after reveal (Host)').toEqual(first)
    expect(await decorationInventory(guest.page), 'after reveal (Guest)').toEqual(first)
  })

  test('TC-005-26 Everything stays usable without images, icons or ornaments', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    await p.context.route('**/*', (route) => (route.request().resourceType() === 'image' ? route.abort() : route.continue()))
    await p.home.goto()
    await p.page.addStyleTag({
      content: 'svg,.ornament-divider{display:none !important}.ornate::before,.ornate::after{content:none !important}',
    })

    expect(await p.picker.names()).toEqual([...THEME_NAMES])
    for (const name of THEME_NAMES) await expect(p.picker.radio(name)).toHaveAccessibleName(name)
    await p.home.fillCreate('Maya')
    await p.home.fillJoin('ABC234', 'Noah')
    await expect(p.home.createButton).toBeEnabled()
    await expect(p.home.joinButton).toBeEnabled()
    await expect(p.page.getByRole('heading', { name: 'Story Pointing', level: 1 })).toBeVisible()
    await p.picker.choose('Forest')
    expect(await overflow(p.page)).toBeLessThanOrEqual(0)
  })
})

// ======================================================================
// AC-005-07 Behavior, copy and selectors unchanged
// ======================================================================
test.describe('US-005 AC-005-07 behavior unchanged', () => {
  test('TC-005-27 Full flow works without reload while the theme changes at every step', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await markPage(host.page)
    await markPage(guest.page)

    await host.picker.choose('Light')
    await guest.picker.choose('Dark')
    await cast(host, 'Maya', '5')
    await cast(guest, 'Noah', '8')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')

    await host.picker.choose('Ocean')
    await host.room.reveal()
    for (const player of [host, guest]) {
      await player.room.expectPhase('revealed')
      await player.room.expectAllCardsDisabled()
      await expect(player.room.voteCell('Maya')).toHaveText('5')
      await expect(player.room.voteCell('Noah')).toHaveText('8')
      await expect(player.room.participation).toHaveText('2 of 2 voted')
    }
    await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVOTE)

    await host.picker.choose('Sunny')
    await host.room.revote()
    for (const player of [host, guest]) {
      await player.room.expectPhase('voting')
      await expect(player.room.resultsPanel).toHaveCount(0)
      await player.room.expectAllCardsEnabledAndUnselected()
    }
    await cast(host, 'Maya', '3')
    await cast(guest, 'Noah', '3')
    await expect(host.room.voteCell('Noah')).toHaveText('Voted')

    await host.picker.choose('Forest')
    await host.room.reveal()
    for (const player of [host, guest]) {
      await player.room.expectPhase('revealed')
      await expect(player.room.voteCell('Maya')).toHaveText('3')
      await expect(player.room.voteCell('Noah')).toHaveText('3')
    }
    await expectNoReload(host.page)
    await expectNoReload(guest.page)
  })

  test('TC-005-28 Guest never sees Reveal or Revote and no vote value before reveal, in any theme', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const { host, guest } = await room(newPlayer)
    await cast(host, 'Maya', '13')
    await expect(guest.room.voteCell('Maya')).toHaveText('Voted')

    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      await expect(guest.room.revealButton).toHaveCount(0)
      await expect(guest.room.revoteButton).toHaveCount(0)
      await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVEAL)
      await expect(guest.room.voteCell('Maya')).toHaveText('Voted')
      await expect(guest.room.row('Maya')).not.toContainText('13')
    }

    await host.room.reveal()
    await guest.room.expectPhase('revealed')
    for (const theme of THEME_NAMES) {
      await guest.picker.choose(theme)
      await expect(guest.room.revealButton).toHaveCount(0)
      await expect(guest.room.revoteButton).toHaveCount(0)
      await expect(guest.room.phaseWaiting).toHaveText(WAIT_FOR_REVOTE)
    }
  })

  test('TC-005-29 Host-left screen keeps the chosen theme and its exact message', async ({ newPlayer }) => {
    test.setTimeout(ROOM_TIMEOUT)
    const reference = await newPlayer()
    await reference.home.goto()
    const vintageBg = await bodyBg(reference.page)

    const { host, guest } = await room(newPlayer)
    await guest.picker.choose('Dark')
    const darkBg = await bodyBg(guest.page)
    await host.page.close()

    await guest.room.expectHostLeft()
    expect(await bodyBg(guest.page)).toBe(darkBg)
    expect(darkBg).not.toBe(vintageBg)
    await guest.room.returnHome.click()
    await guest.home.expectOnHome()
    await guest.picker.expectSelected('Dark')
  })
})

// ======================================================================
// AC-005-08 Layout preserved in every theme
// ======================================================================
test.describe('US-005 AC-005-08 layout', () => {
  test('TC-005-30 Home layout and picker overlap per theme and viewport', { tag: '@home' }, async ({ newPlayer }) => {
    const p = await newPlayer()
    for (const viewport of VIEWPORTS) {
      await p.page.setViewportSize({ width: viewport.width, height: viewport.height })
      await p.home.goto()
      for (const theme of THEME_NAMES) {
        await p.picker.choose(theme)
        const where = `${viewport.name} ${theme}`
        expect.soft(await overflow(p.page), `${where}: horizontal overflow`).toBeLessThanOrEqual(0)
        expect
          .soft(await p.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')!).paddingLeft)), `${where}: padding`)
          .toBe(viewport.padding)

        const pickerBox = await box(p.picker.group)
        expect.soft(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= viewport.width, `${where}: picker inside viewport`).toBe(true)
        const art = await illustrationOf(p.page)
        const others: [string, Box][] = [
          ['title', await box(p.page.getByRole('heading', { level: 1 }))],
          ['subtitle', await box(p.page.getByText('Estimate together, without signing up.'))],
          ['Create panel', await box(p.home.createRegion)],
          ['Join panel', await box(p.home.joinRegion)],
        ]
        if (art) others.push(['illustration', art.box])
        for (const [name, other] of others) expect.soft(intersects(pickerBox, other), `${where}: picker overlaps ${name}`).toBe(false)

        const create = await box(p.home.createRegion)
        const join = await box(p.home.joinRegion)
        const sideBySide = Math.abs(create.y - join.y) < 1 && create.x < join.x
        expect.soft(sideBySide, `${where}: panels ${viewport.width >= 768 ? 'side by side' : 'stacked'}`).toBe(viewport.width >= 768)
      }
    }
  })

  test('TC-005-31 Room layout and picker overlap per theme and viewport', async ({ newPlayer }) => {
    test.setTimeout(180_000)
    const { host } = await room(newPlayer)
    for (const viewport of VIEWPORTS) {
      await host.page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const theme of THEME_NAMES) {
        await host.picker.choose(theme)
        const where = `${viewport.name} ${theme}`
        expect.soft(await overflow(host.page), `${where}: horizontal overflow`).toBeLessThanOrEqual(0)
        expect
          .soft(await host.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')!).paddingLeft)), `${where}: padding`)
          .toBe(viewport.padding)
        const columns = await host.room.cardGroup.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
        expect.soft(columns, `${where}: card columns`).toBe(viewport.columns)

        const players = await box(host.page.getByRole('region', { name: /^Players/ }))
        if (viewport.sidebar > 0) expect.soft(Math.round(players.width), `${where}: sidebar width`).toBe(viewport.sidebar)
        else expect.soft(players.width, `${where}: Players full width when narrow`).toBeGreaterThan(viewport.width - 2 * viewport.padding - 2)

        const pickerBox = await box(host.picker.group)
        for (const [name, locator] of [
          ['room code', host.room.roomCode],
          ['Copy link', host.room.copyLink],
          ['Players', host.page.getByRole('region', { name: /^Players/ })],
          ['cards', host.room.cardGroup],
          ['Reveal estimates', host.room.revealButton],
        ] as [string, Locator][]) {
          expect.soft(intersects(pickerBox, await box(locator)), `${where}: picker overlaps ${name}`).toBe(false)
        }
        await host.room.revealButton.scrollIntoViewIfNeeded()
        const reveal = await box(host.room.revealButton)
        expect.soft(reveal.x >= 0 && reveal.x + reveal.width <= viewport.width, `${where}: Reveal inside the viewport width`).toBe(true)
      }
    }
  })
})

// ======================================================================
// AC-005-09 No new dependency or remote asset
// ======================================================================
test.describe('US-005 AC-005-09 no remote assets', () => {
  test('TC-005-32 Every theme renders with all third-party origins blocked', { tag: '@home' }, async ({ newPlayer, baseURL }) => {
    const appOrigin = new URL(baseURL!).origin
    const p = await newPlayer()
    const foreign: string[] = []
    await p.context.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith('data:') || new URL(url).origin === appOrigin) return route.continue()
      foreign.push(url)
      return route.abort()
    })
    await p.home.goto()

    const backgrounds = new Set<string>()
    for (const theme of THEME_NAMES) {
      await p.picker.choose(theme)
      backgrounds.add(await bodyBg(p.page))
      expect((await illustrationOf(p.page))?.markup.length, `${theme}: illustration renders`).toBeGreaterThan(0)
      await expect(p.picker.label(theme).locator('svg')).toHaveCount(1)
    }
    expect(backgrounds.size, 'six distinct themes').toBe(6)
    expect(foreign, 'requests to other origins').toEqual([])
  })
})
