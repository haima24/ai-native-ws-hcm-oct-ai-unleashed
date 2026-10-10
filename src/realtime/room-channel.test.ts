import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
