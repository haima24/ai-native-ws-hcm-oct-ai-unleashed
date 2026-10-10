// Throwaway D-020 Presence spike runner. Usage: node spikes/presence/run.mjs
// Starts the probe page with Vite (envDir = repo root), drives Chromium via Playwright,
// and writes spikes/presence/results.json and spikes/presence/RESULTS.md.
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const TRIALS = 5
const LEAVE_TIMEOUT_MS = 60_000
const SETTLE_MS = 3_000
const OFFLINE_MS = 10_000
const TARGET_MS = 2_000

if (!existsSync(`${repoRoot}.env.local`)) {
  console.error('NOT RUN: .env.local is missing at the repo root (needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

const server = await createServer({ configFile: `${here}vite.config.ts`, logLevel: 'error' })
await server.listen()
const base = 'http://localhost:5174/'
const browser = await chromium.launch()

async function openClient(role, name, extraQuery = '') {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${base}?role=${role}&name=${name}${extraQuery}`)
  await openedReady(page)
  return { context, page, role }
}

async function openedReady(page) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await page.evaluate(() => window.__ready)) return
    const err = await page.evaluate(() => window.__log.find((e) => e.type === 'error'))
    if (err) throw new Error(`probe error: ${err.message}`)
    await sleep(100)
  }
  const statuses = await page.evaluate(() => window.__log.map((e) => e.status ?? e.type))
  throw new Error(`probe not ready in 20 s; log: ${statuses.join(',')}`)
}

const idOf = (c) => c.page.evaluate(() => window.__me.participantId)
const logOf = (c) => c.page.evaluate(() => window.__log)

async function waitForRoster(clients, ids) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const ok = await Promise.all(
      clients.map(async (c) => {
        const syncs = (await logOf(c)).filter((e) => e.type === 'sync')
        const last = syncs.at(-1)
        return last && ids.every((id) => last.keys.includes(id))
      }),
    )
    if (ok.every(Boolean)) return
    await sleep(100)
  }
  throw new Error('roster did not converge on all clients within 20 s')
}

async function newTrial() {
  const host = await openClient('host', 'Host')
  const g1 = await openClient('guest', 'Guest1')
  const g2 = await openClient('guest', 'Guest2')
  const ids = await Promise.all([host, g1, g2].map(idOf))
  await waitForRoster([host, g1, g2], ids)
  return { host, g1, g2, ids }
}

const closeAll = (clients) => Promise.all(clients.map((c) => c.context.close().catch(() => {})))

// Wait for the first leave for `id` logged at or after `since`; returns latency from the log timestamp.
async function firstLeave(observer, id, since) {
  const deadline = Date.now() + LEAVE_TIMEOUT_MS
  while (Date.now() < deadline) {
    const hit = (await logOf(observer)).find((e) => e.type === 'leave' && e.key === id && e.t >= since)
    if (hit) return hit.t - since
    await sleep(25)
  }
  return null
}

async function countLeaves(observer, id, since) {
  return (await logOf(observer)).filter((e) => e.type === 'leave' && e.key === id && e.t >= since).length
}

const scenarios = {
  'a. guest page.close()': { target: 'g1', act: async (t) => t.g1.page.close() },
  'b. guest context.close()': { target: 'g1', act: async (t) => t.g1.context.close() },
  'c. guest page.reload()': { target: 'g1', act: async (t) => t.g1.page.reload() },
  'd. host page.close()': { target: 'host', act: async (t) => t.host.page.close() },
  'e. host page.reload()': { target: 'host', act: async (t) => t.host.page.reload() },
  'f. guest offline 10 s, then back': {
    target: 'g1',
    act: async (t) => {
      await t.g1.context.setOffline(true)
      setTimeout(() => t.g1.context.setOffline(false).catch(() => {}), OFFLINE_MS)
    },
  },
}

const results = {}

for (const [name, sc] of Object.entries(scenarios)) {
  const samples = []
  const rows = []
  let missed = 0
  let duplicated = 0
  const reloadNotes = []
  for (let i = 1; i <= TRIALS; i++) {
    const trial = await newTrial()
    const targetId = trial.ids[['host', 'g1', 'g2'].indexOf(sc.target)]
    const observers = ['host', 'g1', 'g2'].filter((k) => k !== sc.target).map((k) => ({ key: k, c: trial[k] }))
    const since = Date.now()
    const waits = observers.map((o) => firstLeave(o.c, targetId, since))
    await sc.act(trial)
    const lat = await Promise.all(waits)
    await sleep(SETTLE_MS)
    for (const [idx, o] of observers.entries()) {
      const n = await countLeaves(o.c, targetId, since)
      if (lat[idx] === null) missed++
      else samples.push(lat[idx])
      if (n > 1) duplicated += n - 1
      rows.push(`${o.key}:${lat[idx] ?? 'MISSED'}ms x${n}`)
    }
    if (name.includes('reload')) {
      const reloaded = trial[sc.target]
      await openedReady(reloaded.page).catch(() => {})
      const newId = await idOf(reloaded)
      const seenNew = await Promise.all(
        observers.map(async (o) => (await logOf(o.c)).some((e) => e.type === 'join' && e.key === newId)),
      )
      reloadNotes.push({ trial: i, newIdDiffers: newId !== targetId, observersSawNewJoin: seenNew })
    }
    if (name.startsWith('f.')) {
      await sleep(OFFLINE_MS + 15_000 - SETTLE_MS)
      const rejoined = await Promise.all(
        observers.map(async (o) =>
          (await logOf(o.c)).some((e) => e.type === 'join' && e.key === targetId && e.t > since + 1000),
        ),
      )
      reloadNotes.push({ trial: i, observersSawRejoinAfterOnline: rejoined })
    }
    await closeAll([trial.host, trial.g1, trial.g2])
    console.log(`${name} trial ${i}: ${rows.slice(-observers.length).join(' | ')}`)
  }
  results[name] = {
    samples,
    missed,
    duplicated,
    min: samples.length ? Math.min(...samples) : null,
    median: samples.length ? median(samples) : null,
    max: samples.length ? Math.max(...samples) : null,
    notes: reloadNotes,
  }
}

// Broadcast round trip: join-intent (Guest) -> join-accepted (Host reply), ack:true.
const rtt = { roundTrip: [], ack: [], selfEcho: false, ackStatuses: [] }
{
  const host = await openClient('host', 'Host')
  const g1 = await openClient('guest', 'Guest1')
  await waitForRoster([host, g1], [await idOf(host), await idOf(g1)])
  for (let seq = 1; seq <= TRIALS; seq++) {
    const tSend = await g1.page.evaluate((s) => {
      const t = Date.now()
      void window.__sendJoinIntent(s)
      return t
    }, seq)
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const log = await logOf(g1)
      const back = log.find((e) => e.type === 'broadcast-in' && e.event === 'room:join-accepted' && e.payload.seq === seq)
      const ack = log.find((e) => e.type === 'broadcast-ack' && e.event === 'room:join-intent' && e.seq === seq)
      if (back && ack) {
        rtt.roundTrip.push(back.t - tSend)
        rtt.ack.push(ack.t - tSend)
        rtt.ackStatuses.push(ack.status)
        break
      }
      await sleep(25)
    }
    await sleep(500)
  }
  rtt.selfEcho = (await logOf(host)).some((e) => e.type === 'broadcast-in' && e.event === 'room:join-accepted')
  await closeAll([host, g1])
}

await browser.close()
await server.close()

const stat = (xs) => (xs.length ? `${Math.min(...xs)} / ${median(xs)} / ${Math.max(...xs)}` : 'n/a')
const lines = []
lines.push('# D-020 Presence spike results', '')
lines.push(`Generated by \`node spikes/presence/run.mjs\` on ${new Date().toISOString()} (Chromium via Playwright, local machine, ${TRIALS} trials per scenario, 1 Host + 2 Guest contexts, leave timeout ${LEAVE_TIMEOUT_MS / 1000} s).`, '')
lines.push('## Verified channel config', '')
lines.push('- Channel `story-pointing:SPIKE01`; `config: { broadcast: { self: false, ack: true }, presence: { key: <participantId> } }`.')
lines.push(`- Broadcast ack statuses observed: ${[...new Set(rtt.ackStatuses)].join(', ') || 'none'}; Host received its own broadcast (self echo): ${rtt.selfEcho ? 'YES (self:false not honoured)' : 'no (self:false honoured)'}.`)
lines.push('- Presence tracked `{ participantId, displayName, role }` after `SUBSCRIBED`; roster convergence on all 3 clients was required before every trial (keys = participant IDs).', '')
lines.push('## Leave latency (ms from action to the observer\'s `leave` log entry)', '')
lines.push('Samples = one per observer per trial (2 observers x 5 trials = 10 expected).', '')
lines.push('| Scenario | Samples | Min / median / max ms | Missed leaves | Duplicated leaves |', '|---|---|---|---|---|')
for (const [name, r] of Object.entries(results)) {
  lines.push(`| ${name} | ${r.samples.length} | ${stat(r.samples)} | ${r.missed} | ${r.duplicated} |`)
}
lines.push('', '## Reload and offline notes', '')
for (const [name, r] of Object.entries(results)) {
  if (r.notes.length) lines.push(`- ${name}: \`${JSON.stringify(r.notes)}\``)
}
lines.push('', '## Broadcast round trip (join-intent -> join-accepted, Guest -> Host -> Guest)', '')
lines.push('| Measure | Samples | Min / median / max ms |', '|---|---|---|')
lines.push(`| Round trip | ${rtt.roundTrip.length} | ${stat(rtt.roundTrip)} |`)
lines.push(`| Send ack | ${rtt.ack.length} | ${stat(rtt.ack)} |`, '')

const core = ['a.', 'b.', 'c.', 'd.', 'e.'].map((p) => Object.entries(results).find(([n]) => n.startsWith(p))[1])
const anyMissed = core.some((r) => r.missed > 0)
const anyDup = core.some((r) => r.duplicated > 0)
const worst = Math.max(...core.map((r) => r.max ?? Infinity))
const verdict = anyMissed ? 'no' : anyDup || worst > TARGET_MS ? 'partly' : 'yes'
lines.push('## Verdict', '')
lines.push(`Presence OK for AC-001-09/10: **${verdict}** (scenarios a-e: missed leaves ${anyMissed ? 'present' : 'none'}, duplicates ${anyDup ? 'present' : 'none'}, worst observed ${Number.isFinite(worst) ? worst + ' ms' : 'n/a'} vs ${TARGET_MS} ms roster target). Scenario f is informational (transient network loss). The mob decides D-020.`, '')
writeFileSync(`${here}RESULTS.md`, lines.join('\n'))
writeFileSync(`${here}results.json`, JSON.stringify({ results, rtt, verdict }, null, 2))
console.log(`verdict: ${verdict}; wrote RESULTS.md`)
