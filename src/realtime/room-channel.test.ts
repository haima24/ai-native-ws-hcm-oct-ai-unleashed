import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPublicView } from '../domain/room'
import {
  channelName,
  createRoom,
  joinRoom,
  type ChannelLike,
  type ClientLike,
  type SessionEvent,
} from './room-channel'
import type { PublicView } from '../types/room'

class FakeChannel implements ChannelLike {
  broadcastHandlers = new Map<string, ((m: { payload?: unknown }) => void)[]>()
  presenceHandlers = new Map<string, ((p: { key?: string }) => void)[]>()
  statusCb: ((status: string) => void) | null = null
  sent: { event: string; payload: unknown }[] = []
  tracked: Record<string, unknown>[] = []
  untrackCalls = 0
  unsubscribeCalls = 0

  constructor(
    readonly name: string,
    readonly options: unknown,
  ) {}

  on(type: string, filter: { event: string }, cb: (arg: never) => void): ChannelLike {
    const map = type === 'broadcast' ? this.broadcastHandlers : this.presenceHandlers
    map.set(filter.event, [...(map.get(filter.event) ?? []), cb as never])
    return this
  }
  subscribe(cb: (status: string) => void) {
    this.statusCb = cb
  }
  track(payload: Record<string, unknown>) {
    this.tracked.push(payload)
    return Promise.resolve('ok')
  }
  untrack() {
    this.untrackCalls++
    return Promise.resolve('ok')
  }
  send(message: { type: 'broadcast'; event: string; payload: unknown }) {
    this.sent.push({ event: message.event, payload: message.payload })
    return Promise.resolve('ok')
  }
  unsubscribe() {
    this.unsubscribeCalls++
    return Promise.resolve('ok')
  }

  status(s: string) {
    this.statusCb?.(s)
  }
  receive(event: string, payload: unknown) {
    this.broadcastHandlers.get(event)?.forEach((h) => h({ payload }))
  }
  presence(event: 'join' | 'leave' | 'sync', key?: string) {
    this.presenceHandlers.get(event)?.forEach((h) => h({ key }))
  }
  sentOf(event: string) {
    return this.sent.filter((s) => s.event === event)
  }
}

function setup() {
  const channels: FakeChannel[] = []
  const client: ClientLike = {
    channel: (name, options) => {
      const ch = new FakeChannel(name, options)
      channels.push(ch)
      return ch
    },
  }
  let n = 0
  const createId = () => `id-${++n}`
  return { channels, client, createId }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

async function startHost() {
  const env = setup()
  const pending = createRoom({ displayName: 'Maya' }, { client: env.client, createId: env.createId, random: () => 0, pageHideTarget: undefined })
  const channel = env.channels[0]
  channel.status('SUBSCRIBED')
  const result = await pending
  if (result.status !== 'joined') throw new Error('host did not join')
  return { channel, session: result.session, env }
}

describe('US-001 realtime: room channel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-001-58 never SUBSCRIBED by the deadline is connection-timeout and the channel is released', async () => {
    const env = setup()
    const pending = joinRoom({ roomCode: 'abc234', displayName: 'Noah' }, { client: env.client, createId: env.createId })
    const channel = env.channels[0]
    expect(channel.name).toBe(channelName('ABC234'))
    await vi.advanceTimersByTimeAsync(4999)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ status: 'connection-timeout' })
    expect(channel.unsubscribeCalls).toBe(1)
    expect(channel.untrackCalls).toBe(1)
    expect(channel.sentOf('room:join-intent')).toHaveLength(0)
  })

  it('TC-001-60 one wall-clock deadline: subscribed at 4 s, no acknowledgement fails at 5 s', async () => {
    const env = setup()
    let settledAt: number | null = null
    const start = Date.now()
    const pending = joinRoom({ roomCode: 'ABC234', displayName: 'Noah' }, { client: env.client, createId: env.createId }).then((r) => {
      settledAt = Date.now() - start
      return r
    })
    await vi.advanceTimersByTimeAsync(4000)
    env.channels[0].status('SUBSCRIBED')
    await vi.advanceTimersByTimeAsync(999)
    expect(settledAt).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ status: 'room-unavailable' })
    expect(settledAt).toBe(5000)
  })

  it('TC-001-79 subscribed without Host acknowledgement is room-unavailable, unsubscribed and untracked', async () => {
    const env = setup()
    const pending = joinRoom({ roomCode: 'ABC234', displayName: 'Noah' }, { client: env.client, createId: env.createId })
    const channel = env.channels[0]
    channel.status('SUBSCRIBED')
    await flush()
    expect(channel.sentOf('room:join-intent')).toHaveLength(1)
    expect(channel.tracked).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(5000)
    const result = await pending
    expect(result).toEqual({ status: 'room-unavailable' })
    expect(result.status).not.toBe('connection-timeout')
    expect(channel.unsubscribeCalls).toBe(1)
    expect(channel.untrackCalls).toBe(1)
    expect(channel.tracked).toHaveLength(0)
  })

  it('TC-001-66 Presence join/sync for an unaccepted id never changes the roster', async () => {
    const { channel, session } = await startHost()
    const events: SessionEvent[] = []
    session.subscribe((e) => events.push(e))
    channel.presence('join', 'x')
    channel.presence('sync')
    channel.presence('leave', 'x')
    await flush()
    expect(session.getView().participants.map((p) => p.displayName)).toEqual(['Maya'])
    expect(session.getView().revision).toBe(0)
    expect(events).toEqual([])
    expect(channel.sentOf('room:public-view')).toHaveLength(0)
  })

  it('TC-001-73 forged room:host-left with a wrong participant id is ignored', async () => {
    const env = setup()
    const pending = joinRoom({ roomCode: 'ABC234', displayName: 'Noah' }, { client: env.client, createId: env.createId })
    const channel = env.channels[0]
    channel.status('SUBSCRIBED')
    await flush()
    const intent = channel.sentOf('room:join-intent')[0].payload as { requestId: string; participantId: string }
    channel.receive('room:join-accepted', { requestId: intent.requestId, participantId: intent.participantId, roomCode: 'ABC234', revision: 1 })
    const view: PublicView = {
      roomCode: 'ABC234',
      revision: 1,
      roundId: 1,
      phase: 'voting',
      ended: false,
      participants: [
        { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: false },
        { participantId: intent.participantId, displayName: 'Noah', role: 'guest', hasVoted: false },
      ],
    }
    channel.receive('room:public-view', view)
    const result = await pending
    if (result.status !== 'joined') throw new Error('expected joined')
    expect(channel.tracked).toEqual([{ participantId: intent.participantId, displayName: 'Noah', role: 'guest' }])

    const events: SessionEvent[] = []
    result.session.subscribe((e) => events.push(e))
    channel.receive('room:host-left', { roomCode: 'ABC234', participantId: 'zzz', revision: 2 })
    channel.presence('leave', 'zzz')
    expect(events).toEqual([])
    expect(channel.unsubscribeCalls).toBe(0)

    channel.receive('room:host-left', { roomCode: 'ABC234', participantId: 'h1', revision: 2 })
    expect(events).toEqual([{ type: 'host-left' }])
    await flush()
    expect(channel.unsubscribeCalls).toBe(1)
  })

  it('US-001 a failed join removes the channel from the client so a retry gets a fresh channel', async () => {
    const env = setup()
    const removed: ChannelLike[] = []
    const client: ClientLike = {
      channel: env.client.channel,
      removeChannel: (ch) => {
        removed.push(ch)
        return Promise.resolve('ok')
      },
    }
    const pending = joinRoom({ roomCode: 'ABC234', displayName: 'Noah' }, { client, createId: env.createId })
    env.channels[0].status('SUBSCRIBED')
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toEqual({ status: 'room-unavailable' })
    expect(removed).toEqual([env.channels[0]])
  })

  it('US-001 host accepts a join, rejects a duplicate and removes a Guest on Presence leave', async () => {
    const { channel, session } = await startHost()
    expect(channel.options).toEqual({ config: { broadcast: { self: false, ack: true }, presence: { key: session.participantId } } })
    expect(channel.tracked).toEqual([{ participantId: session.participantId, displayName: 'Maya', role: 'host' }])

    channel.receive('room:join-intent', { requestId: 'r1', participantId: 'g1', displayName: 'Noah' })
    await flush()
    expect(channel.sentOf('room:join-accepted')[0].payload).toEqual({ requestId: 'r1', participantId: 'g1', roomCode: session.roomCode, revision: 1 })
    expect((channel.sentOf('room:public-view')[0].payload as PublicView).revision).toBe(1)

    channel.receive('room:join-intent', { requestId: 'r2', participantId: 'g2', displayName: 'noah' })
    await flush()
    expect(channel.sentOf('room:join-rejected')[0].payload).toEqual({ requestId: 'r2', reason: 'duplicate-name' })
    expect(session.getView().revision).toBe(1)

    channel.presence('leave', 'g1')
    await flush()
    expect(session.getView().participants.map((p) => p.displayName)).toEqual(['Maya'])
    expect((channel.sentOf('room:public-view').at(-1)?.payload as PublicView).revision).toBe(2)
  })
})

class FakePageHide {
  listeners = new Set<() => void>()
  addEventListener(_type: 'pagehide', cb: () => void) {
    this.listeners.add(cb)
  }
  removeEventListener(_type: 'pagehide', cb: () => void) {
    this.listeners.delete(cb)
  }
  fire() {
    this.listeners.forEach((cb) => cb())
  }
}

async function startHostWithPageHide() {
  const env = setup()
  const pageHide = new FakePageHide()
  const pending = createRoom(
    { displayName: 'Maya' },
    { client: env.client, createId: env.createId, random: () => 0, pageHideTarget: pageHide },
  )
  const channel = env.channels[0]
  channel.status('SUBSCRIBED')
  const result = await pending
  if (result.status !== 'joined') throw new Error('host did not join')
  channel.receive('room:join-intent', { requestId: 'j1', participantId: 'g1', displayName: 'Noah' })
  await flush()
  channel.sent.length = 0
  return { channel, session: result.session }
}

describe('US-001 realtime: Guest room:guest-left', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-001-72 Host removes an accepted Guest on room:guest-left and publishes once', async () => {
    const { channel, session } = await startHostWithPageHide()
    channel.receive('room:guest-left', { roomCode: session.roomCode, participantId: 'g1' })
    await flush()
    expect(session.getView().participants.map((p) => p.displayName)).toEqual(['Maya'])
    expect(session.getView().revision).toBe(2)
    expect(views(channel)).toHaveLength(1)
    expect(views(channel)[0].revision).toBe(2)
  })

  it('TC-001-72 unknown, Host and malformed room:guest-left are ignored', async () => {
    const { channel, session } = await startHostWithPageHide()
    channel.receive('room:guest-left', { roomCode: session.roomCode, participantId: 'zzz' })
    channel.receive('room:guest-left', { roomCode: session.roomCode, participantId: session.participantId })
    channel.receive('room:guest-left', { roomCode: session.roomCode })
    channel.receive('room:guest-left', { roomCode: 'OTHER1', participantId: 'g1' })
    channel.receive('room:guest-left', null)
    await flush()
    expect(session.getView().participants.map((p) => p.displayName)).toEqual(['Maya', 'Noah'])
    expect(session.getView().revision).toBe(1)
    expect(channel.sent).toEqual([])
  })

  it('TC-001-72 a later duplicate Leave (Presence or Broadcast) is a no-op', async () => {
    const { channel, session } = await startHostWithPageHide()
    channel.receive('room:guest-left', { roomCode: session.roomCode, participantId: 'g1' })
    channel.presence('leave', 'g1')
    channel.receive('room:guest-left', { roomCode: session.roomCode, participantId: 'g1' })
    await flush()
    expect(session.getView().revision).toBe(2)
    expect(views(channel)).toHaveLength(1)
  })

  it('TC-001-72 an accepted Guest sends room:guest-left on pagehide with ids only; no listener after close()', async () => {
    const env = setup()
    const pageHide = new FakePageHide()
    const pending = joinRoom(
      { roomCode: 'ABC234', displayName: 'Noah' },
      { client: env.client, createId: env.createId, pageHideTarget: pageHide },
    )
    const channel = env.channels[0]
    channel.status('SUBSCRIBED')
    await flush()
    // Not accepted yet: no listener.
    expect(pageHide.listeners.size).toBe(0)
    const intent = channel.sentOf('room:join-intent')[0].payload as { requestId: string; participantId: string }
    channel.receive('room:join-accepted', { requestId: intent.requestId, participantId: intent.participantId, roomCode: 'ABC234', revision: 1 })
    channel.receive('room:public-view', {
      roomCode: 'ABC234',
      revision: 1,
      roundId: 1,
      phase: 'voting',
      ended: false,
      participants: [
        { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: false },
        { participantId: intent.participantId, displayName: 'Noah', role: 'guest', hasVoted: false },
      ],
    })
    const result = await pending
    if (result.status !== 'joined') throw new Error('expected joined')
    expect(pageHide.listeners.size).toBe(1)

    pageHide.fire()
    expect(channel.sentOf('room:guest-left')).toEqual([
      { event: 'room:guest-left', payload: { roomCode: 'ABC234', participantId: intent.participantId } },
    ])

    result.session.close()
    expect(pageHide.listeners.size).toBe(0)
    pageHide.fire()
    expect(channel.sentOf('room:guest-left')).toHaveLength(1)
  })
})

function fakeTimers() {
  let now = 0
  let nextId = 0
  const pending = new Map<number, { at: number; cb: () => void }>()
  return {
    setTimeout(cb: () => void, ms: number) {
      const id = ++nextId
      pending.set(id, { at: now + ms, cb })
      return id
    },
    clearTimeout(handle: unknown) {
      pending.delete(handle as number)
    },
    advance(ms: number) {
      const target = now + ms
      for (;;) {
        const due = [...pending.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        pending.delete(due[0])
        now = due[1].at
        due[1].cb()
      }
      now = target
    },
    get size() {
      return pending.size
    },
  }
}

async function startGuest() {
  const env = setup()
  const timers = fakeTimers()
  const pending = joinRoom({ roomCode: 'ABC234', displayName: 'Noah' }, { client: env.client, createId: env.createId, timers })
  const channel = env.channels[0]
  channel.status('SUBSCRIBED')
  await flush()
  const intent = channel.sentOf('room:join-intent')[0].payload as { requestId: string; participantId: string }
  channel.receive('room:join-accepted', { requestId: intent.requestId, participantId: intent.participantId, roomCode: 'ABC234', revision: 1 })
  const view: PublicView = {
    roomCode: 'ABC234',
    revision: 1,
    roundId: 1,
    phase: 'voting',
    ended: false,
    participants: [
      { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: false },
      { participantId: intent.participantId, displayName: 'Noah', role: 'guest', hasVoted: false },
    ],
  }
  channel.receive('room:public-view', view)
  const result = await pending
  if (result.status !== 'joined') throw new Error('guest did not join')
  const events: SessionEvent[] = []
  result.session.subscribe((e) => events.push(e))
  const results = () => events.filter((e) => e.type === 'vote-result')
  return { channel, session: result.session, timers, events, results, participantId: intent.participantId }
}

async function startHostWithGuest() {
  const host = await startHost()
  host.channel.receive('room:join-intent', { requestId: 'j1', participantId: 'g1', displayName: 'Noah' })
  await flush()
  host.channel.sent.length = 0
  return host
}

describe('US-002 realtime: Host vote handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-002-12 Host acknowledges by requestId, publishing the view before the ack', async () => {
    const { channel, session } = await startHostWithGuest()

    channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: 1, card: '5' })
    expect(channel.sent.map((s) => s.event)).toEqual(['room:public-view', 'room:vote-accepted'])
    const view = channel.sentOf('room:public-view')[0].payload as PublicView
    expect(view.participants.find((p) => p.participantId === 'g1')?.hasVoted).toBe(true)
    expect(channel.sentOf('room:vote-accepted')[0].payload).toEqual({ requestId: 'rq1', participantId: 'g1', roundId: 1 })

    channel.sent.length = 0
    channel.receive('room:vote-intent', { requestId: 'rq2', participantId: 'g1', roundId: 1, card: '8' })
    expect(channel.sent.map((s) => s.event)).toEqual(['room:vote-accepted'])
    expect(channel.sentOf('room:vote-accepted')[0].payload).toMatchObject({ requestId: 'rq2' })

    channel.sent.length = 0
    channel.receive('room:vote-intent', { requestId: 'rq3', participantId: 'zzz', roundId: 1, card: '5' })
    expect(channel.sent).toEqual([])

    channel.receive('room:vote-intent', { requestId: 'rq4', participantId: 'g1', roundId: 1, card: '9' })
    channel.receive('room:vote-intent', { requestId: 'rq5', participantId: 'g1', roundId: 2, card: '5' })
    expect(channel.sent).toEqual([
      { event: 'room:vote-rejected', payload: { requestId: 'rq4', participantId: 'g1', reason: 'invalid-card' } },
      { event: 'room:vote-rejected', payload: { requestId: 'rq5', participantId: 'g1', reason: 'round-mismatch' } },
    ])
    expect(session.getView().revision).toBe(3)
  })

  it('US-002 Host silently drops malformed vote intents', async () => {
    const { channel } = await startHostWithGuest()
    channel.receive('room:vote-intent', null)
    channel.receive('room:vote-intent', { requestId: 1, participantId: 'g1', roundId: 1, card: '5' })
    channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: '1', card: '5' })
    channel.receive('room:vote-intent', { requestId: 'rq2', participantId: 'g1', roundId: 1 })
    expect(channel.sent).toEqual([])
  })

  it('US-002 same-card resend is acknowledged without a new revision or view', async () => {
    const { channel, session } = await startHostWithGuest()
    channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: 1, card: '5' })
    const revision = session.getView().revision
    channel.sent.length = 0
    channel.receive('room:vote-intent', { requestId: 'rq2', participantId: 'g1', roundId: 1, card: '5' })
    expect(channel.sent.map((s) => s.event)).toEqual(['room:vote-accepted'])
    expect(session.getView().revision).toBe(revision)
  })

  it('US-002 Host vote() confirms its own vote without Broadcast intent and publishes the view', async () => {
    const { channel, session } = await startHostWithGuest()
    const events: SessionEvent[] = []
    session.subscribe((e) => events.push(e))
    const requestId = session.vote('8')
    await flush()
    expect(events).toContainEqual({ type: 'vote-result', requestId, result: 'confirmed' })
    expect(session.getView().participants[0].hasVoted).toBe(true)
    expect(channel.sent.map((s) => s.event)).toEqual(['room:public-view'])
    expect(channel.sentOf('room:vote-intent')).toEqual([])
  })

  it('TC-002-15 no card value or votes map in any Host outbound payload', async () => {
    const { channel, session } = await startHostWithGuest()
    channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: 1, card: '5' })
    session.vote('8')
    channel.receive('room:vote-intent', { requestId: 'rq2', participantId: 'g1', roundId: 1, card: '9' })
    channel.receive('room:vote-intent', { requestId: 'rq3', participantId: 'g1', roundId: 7, card: '13' })
    await flush()

    expect(channel.sent.length).toBeGreaterThan(0)
    for (const { payload } of channel.sent) {
      const text = JSON.stringify(payload)
      expect(text).not.toMatch(/"votes"|"card"/)
      expect(text).not.toMatch(/"(0|1|2|3|5|8|13|21|\?)"/)
    }
    expect(JSON.stringify(session.getView())).not.toMatch(/"votes"|"card"|"(5|8)"/)
  })
})

describe('US-002 realtime: Guest vote()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('US-002 Guest sends an intent with requestId, participantId, roundId and card, and confirms on the matching ack', async () => {
    const { channel, session, results, participantId } = await startGuest()
    const requestId = session.vote('5')
    await flush()
    expect(channel.sentOf('room:vote-intent')[0].payload).toEqual({ requestId, participantId, roundId: 1, card: '5' })
    channel.receive('room:vote-accepted', { requestId: 'other', participantId, roundId: 1 })
    channel.receive('room:vote-accepted', { requestId, participantId: 'someone-else', roundId: 1 })
    expect(results()).toEqual([])
    channel.receive('room:vote-accepted', { requestId, participantId, roundId: 1 })
    expect(results()).toEqual([{ type: 'vote-result', requestId, result: 'confirmed' }])
  })

  it('TC-002-20 confirmation timer fails at exactly 5000 ms and is cleared by an ack', async () => {
    const { channel, session, timers, results, participantId } = await startGuest()
    const first = session.vote('5')
    timers.advance(4999)
    expect(results()).toEqual([])
    timers.advance(1)
    expect(results()).toEqual([{ type: 'vote-result', requestId: first, result: 'failed' }])

    const second = session.vote('5')
    timers.advance(4999)
    channel.receive('room:vote-accepted', { requestId: second, participantId, roundId: 1 })
    timers.advance(10_000)
    expect(results().slice(1)).toEqual([{ type: 'vote-result', requestId: second, result: 'confirmed' }])
  })

  it('TC-002-21 send rejection, non-ok status and matching rejection fail immediately; others are ignored', async () => {
    const { channel, session, results, participantId } = await startGuest()

    vi.spyOn(channel, 'send').mockRejectedValueOnce(new Error('boom'))
    const thrown = session.vote('5')
    await flush()
    expect(results()).toEqual([{ type: 'vote-result', requestId: thrown, result: 'failed' }])

    vi.spyOn(channel, 'send').mockResolvedValueOnce('error')
    const bad = session.vote('5')
    await flush()
    expect(results().at(-1)).toEqual({ type: 'vote-result', requestId: bad, result: 'failed' })

    const rejected = session.vote('5')
    await flush()
    const count = results().length
    channel.receive('room:vote-rejected', { requestId: 'other', participantId, reason: 'invalid-card' })
    channel.receive('room:vote-rejected', { requestId: rejected, participantId: 'someone-else', reason: 'invalid-card' })
    expect(results()).toHaveLength(count)
    channel.receive('room:vote-rejected', { requestId: rejected, participantId, reason: 'invalid-card' })
    expect(results().at(-1)).toEqual({ type: 'vote-result', requestId: rejected, result: 'failed' })
  })

  it('TC-002-21 no event after close() and the timer is cleared', async () => {
    const { session, timers, results } = await startGuest()
    session.vote('5')
    session.close()
    timers.advance(10_000)
    expect(results()).toEqual([])
    expect(timers.size).toBe(0)
  })

  it('US-002 a late ack for the failed request confirms; a late ack for a replaced request is ignored', async () => {
    const { channel, session, timers, results, participantId } = await startGuest()
    const first = session.vote('5')
    timers.advance(5000)
    channel.receive('room:vote-accepted', { requestId: first, participantId, roundId: 1 })
    expect(results().map((r) => (r as { result: string }).result)).toEqual(['failed', 'confirmed'])

    const second = session.vote('8')
    timers.advance(5000)
    const retry = session.vote('8')
    const before = results().length
    channel.receive('room:vote-accepted', { requestId: second, participantId, roundId: 1 })
    expect(results()).toHaveLength(before)
    channel.receive('room:vote-accepted', { requestId: retry, participantId, roundId: 1 })
    expect(results().at(-1)).toEqual({ type: 'vote-result', requestId: retry, result: 'confirmed' })
  })
})

const views = (channel: FakeChannel) => channel.sentOf('room:public-view').map((s) => s.payload as PublicView)

// Host `5`, Guest g1 `8`, still in voting; sent log cleared.
async function startVotedRoom() {
  const env = await startHostWithGuest()
  env.channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: 1, card: '8' })
  env.session.vote('5')
  await flush()
  env.channel.sent.length = 0
  return env
}

describe('US-003 realtime: Host reveal and revote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-003-04 no results while voting; one revealed view with results after reveal()', async () => {
    const { channel, session } = await startHostWithGuest()
    channel.receive('room:vote-intent', { requestId: 'rq1', participantId: 'g1', roundId: 1, card: '8' })
    session.vote('5')
    await flush()

    const voting = views(channel)
    expect(voting.length).toBeGreaterThan(0)
    for (const view of voting) {
      expect(view.phase).toBe('voting')
      expect(view.results).toBeNull()
    }
    expect(JSON.stringify(voting)).not.toMatch(/"(0|1|2|3|5|8|13|21|\?)"/)
    expect(JSON.stringify(session.getView())).not.toMatch(/"(5|8)"/)

    channel.sent.length = 0
    expect(session.reveal?.()).toBe('accepted')
    await flush()
    const published = views(channel)
    expect(published).toHaveLength(1)
    expect(published[0].phase).toBe('revealed')
    expect(published[0].results).toEqual({
      entries: [
        { participantId: session.participantId, value: '5' },
        { participantId: 'g1', value: '8' },
      ],
      groups: [
        { card: '5', count: 1 },
        { card: '8', count: 1 },
      ],
      voted: 2,
      participants: 2,
    })
    // `groups[].card` is a published aggregate; the raw vote map must never appear.
    expect(JSON.stringify(published[0])).not.toMatch(/"votes"/)
    expect(session.getView()).toEqual(published[0])
  })

  it('US-003 reveal() emits the revealed view to the Host UI', async () => {
    const { session } = await startVotedRoom()
    const events: SessionEvent[] = []
    session.subscribe((e) => events.push(e))
    session.reveal?.()
    expect(events).toEqual([{ type: 'view', view: session.getView() }])
    expect(session.getView().phase).toBe('revealed')
  })

  it('TC-003-06 reveal() without votes returns no-votes and publishes nothing', async () => {
    const { channel, session } = await startHostWithGuest()
    const revision = session.getView().revision
    const events: SessionEvent[] = []
    session.subscribe((e) => events.push(e))
    expect(session.reveal?.()).toBe('no-votes')
    await flush()
    expect(channel.sent).toEqual([])
    expect(events).toEqual([])
    expect(session.getView().phase).toBe('voting')
    expect(session.getView().revision).toBe(revision)
  })

  it('TC-003-34 TC-003-35 reveal() in revealed and revote() in voting are ignored without publishing', async () => {
    const { channel, session } = await startVotedRoom()
    expect(session.revote?.()).toBe('ignored')
    expect(channel.sent).toEqual([])
    session.reveal?.()
    channel.sent.length = 0
    const revision = session.getView().revision
    expect(session.reveal?.()).toBe('ignored')
    expect(channel.sent).toEqual([])
    expect(session.getView().revision).toBe(revision)
  })

  it('TC-003-09 a Guest-sent room:reveal-intent has no handler and changes nothing', async () => {
    const { channel, session } = await startVotedRoom()
    const before = session.getView()
    expect(channel.broadcastHandlers.has('room:reveal-intent')).toBe(false)
    channel.receive('room:reveal-intent', { requestId: 'x1', participantId: 'g1' })
    await flush()
    expect(channel.sent).toEqual([])
    expect(session.getView()).toEqual(before)
    expect(session.getView().phase).toBe('voting')
  })

  it('TC-003-09 TC-003-33 a Guest session exposes no reveal() or revote()', async () => {
    const { session } = await startGuest()
    expect('reveal' in session).toBe(false)
    expect('revote' in session).toBe(false)
  })

  it('TC-003-30 revote() publishes a voting view without results for the next round', async () => {
    const { channel, session } = await startVotedRoom()
    session.reveal?.()
    const revealed = views(channel).at(-1) as PublicView
    channel.sent.length = 0

    expect(session.revote?.()).toBe('accepted')
    const published = views(channel)
    expect(published).toHaveLength(1)
    const view = published[0]
    expect(view.phase).toBe('voting')
    expect(view.results).toBeNull()
    expect(view.roundId).toBe(revealed.roundId + 1)
    expect(view.revision).toBeGreaterThan(revealed.revision)
    expect(view.participants.every((p) => !p.hasVoted)).toBe(true)
    expect(JSON.stringify(view)).not.toMatch(/"(0|1|2|3|5|8|13|21|\?)"/)

    const applied = applyPublicView(revealed, view)
    expect(applied.outcome).toBe('applied')
    expect(applied.view.results).toBeNull()
  })

  it('TC-003-33 a Guest-sent room:revote-intent has no handler and changes nothing', async () => {
    const { channel, session } = await startVotedRoom()
    session.reveal?.()
    channel.sent.length = 0
    const before = session.getView()
    expect(channel.broadcastHandlers.has('room:revote-intent')).toBe(false)
    channel.receive('room:revote-intent', { requestId: 'x1', participantId: 'g1' })
    await flush()
    expect(channel.sent).toEqual([])
    expect(session.getView()).toEqual(before)
    expect(session.getView().results).not.toBeNull()
  })

  it('TC-003-37 a stale vote intent after Revote is rejected and not published', async () => {
    const { channel, session } = await startVotedRoom()
    session.reveal?.()
    session.revote?.()
    channel.sent.length = 0
    const before = session.getView()

    channel.receive('room:vote-intent', { requestId: 'rq-old', participantId: 'g1', roundId: 1, card: '5' })
    expect(channel.sent).toEqual([
      { event: 'room:vote-rejected', payload: { requestId: 'rq-old', participantId: 'g1', reason: 'round-mismatch' } },
    ])
    expect(session.getView()).toEqual(before)
    expect(session.getView().participants.every((p) => !p.hasVoted)).toBe(true)
  })

  it('US-003 Join and Leave in revealed republish recomputed results', async () => {
    const { channel, session } = await startVotedRoom()
    session.reveal?.()
    channel.sent.length = 0

    channel.receive('room:join-intent', { requestId: 'j2', participantId: 'g2', displayName: 'Linh' })
    await flush()
    const afterJoin = views(channel).at(-1) as PublicView
    expect(afterJoin.phase).toBe('revealed')
    expect(afterJoin.results).toMatchObject({ voted: 2, participants: 3, groups: [{ card: '5', count: 1 }, { card: '8', count: 1 }] })
    expect(afterJoin.results?.entries.find((e) => e.participantId === 'g2')?.value).toBeNull()

    channel.presence('leave', 'g1')
    await flush()
    const afterLeave = views(channel).at(-1) as PublicView
    expect(afterLeave.results).toMatchObject({ voted: 1, participants: 2, groups: [{ card: '5', count: 1 }] })
    expect(afterLeave.results?.entries.map((e) => e.participantId)).not.toContain('g1')
  })

  it('US-003 a Guest vote intent in revealed is rejected as not-voting', async () => {
    const { channel, session } = await startVotedRoom()
    session.reveal?.()
    channel.sent.length = 0
    channel.receive('room:vote-intent', { requestId: 'late', participantId: 'g1', roundId: 1, card: '3' })
    expect(channel.sent).toEqual([
      { event: 'room:vote-rejected', payload: { requestId: 'late', participantId: 'g1', reason: 'not-voting' } },
    ])
  })
})
