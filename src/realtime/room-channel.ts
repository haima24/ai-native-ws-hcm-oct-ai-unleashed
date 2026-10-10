import {
  applyPublicView,
  createRoom as createRoomState,
  generateRoomCode,
  isWellFormedRoomCode,
  normalizeRoomCode,
  roomReducer,
} from '../domain/room'
import type { PublicView, Role, RoomAction, RoomState } from '../types/room'

export const CREATE_DEADLINE_MS = 10_000
export const JOIN_DEADLINE_MS = 5_000

export const channelName = (roomCode: string) => `story-pointing:${roomCode}`

// Minimal surface of the Supabase RealtimeChannel / client used here, so tests can inject fakes.
export interface ChannelLike {
  on(type: 'broadcast', filter: { event: string }, cb: (message: { payload?: unknown }) => void): ChannelLike
  on(type: 'presence', filter: { event: 'join' | 'leave' | 'sync' }, cb: (payload: { key?: string }) => void): ChannelLike
  subscribe(cb: (status: string) => void): unknown
  track(payload: Record<string, unknown>): Promise<unknown>
  untrack(): Promise<unknown>
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>
  unsubscribe(): Promise<unknown>
}

export interface ClientLike {
  channel(
    name: string,
    options: { config: { broadcast: { self: boolean; ack: boolean }; presence: { key: string } } },
  ): ChannelLike
  // Removes the channel from the client; a same-topic channel() call would otherwise reuse the stale one.
  removeChannel?(channel: ChannelLike): Promise<unknown>
}

export interface Timers {
  setTimeout(cb: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface PageHideTarget {
  addEventListener(type: 'pagehide', cb: () => void): void
  removeEventListener(type: 'pagehide', cb: () => void): void
}

export interface RoomChannelDeps {
  client: ClientLike
  random?: () => number
  createId?: () => string
  timers?: Timers
  pageHideTarget?: PageHideTarget
}

export type SessionEvent =
  | { type: 'view'; view: PublicView }
  | { type: 'host-left' }
  | { type: 'error'; message: string }

export interface RoomSession {
  readonly role: Role
  readonly participantId: string
  readonly roomCode: string
  getView(): PublicView
  subscribe(listener: (event: SessionEvent) => void): () => void
  close(): void
}

export type RoomResult =
  | { status: 'joined'; session: RoomSession }
  | { status: 'duplicate-name' }
  | { status: 'connection-timeout' }
  | { status: 'room-unavailable' }

const defaultTimers: Timers = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const defaultId = () => crypto.randomUUID()

const channelConfig = (participantId: string) => ({
  config: { broadcast: { self: false, ack: true }, presence: { key: participantId } },
})

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isString = (v: unknown): v is string => typeof v === 'string'

export function toPublicView(state: RoomState): PublicView {
  return {
    roomCode: state.roomCode,
    revision: state.revision,
    roundId: state.roundId,
    phase: state.phase,
    participants: state.participants,
    ended: state.status === 'ended',
  }
}

function createEmitter() {
  const listeners = new Set<(event: SessionEvent) => void>()
  return {
    subscribe(listener: (event: SessionEvent) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(event: SessionEvent) {
      listeners.forEach((l) => l(event))
    },
    clear() {
      listeners.clear()
    },
  }
}

async function teardown(client: ClientLike, channel: ChannelLike) {
  await channel.untrack().catch(() => undefined)
  if (client.removeChannel) await client.removeChannel(channel).catch(() => undefined)
  else await channel.unsubscribe().catch(() => undefined)
}

async function sendChecked(channel: ChannelLike, event: string, payload: unknown, onError: (message: string) => void) {
  try {
    const status = await channel.send({ type: 'broadcast', event, payload })
    if (status !== 'ok') onError(`Sending ${event} failed (${String(status)}).`)
  } catch {
    onError(`Sending ${event} failed.`)
  }
}

export function createRoom(input: { displayName: string }, deps: RoomChannelDeps): Promise<RoomResult> {
  const timers = deps.timers ?? defaultTimers
  const random = deps.random ?? Math.random
  const createId = deps.createId ?? defaultId
  const hostId = createId()
  const roomCode = generateRoomCode(random)
  let state = createRoomState({ roomCode, hostId, displayName: input.displayName })
  const channel = deps.client.channel(channelName(roomCode), channelConfig(hostId))
  const emitter = createEmitter()
  const pageHide = deps.pageHideTarget ?? (typeof window !== 'undefined' ? window : undefined)
  let closed = false
  let subscribed = false

  const reportError = (message: string) => emitter.emit({ type: 'error', message })

  const publish = () => {
    const view = toPublicView(state)
    emitter.emit({ type: 'view', view })
    void sendChecked(channel, 'room:public-view', view, reportError)
  }

  const dispatch = (action: RoomAction) => {
    const result = roomReducer(state, action)
    if (result.outcome === 'accepted') state = result.state
    return result.outcome
  }

  const onPageHide = () => {
    void channel.send({
      type: 'broadcast',
      event: 'room:host-left',
      payload: { roomCode, participantId: hostId, revision: state.revision },
    })
  }

  const close = () => {
    if (closed) return
    closed = true
    pageHide?.removeEventListener('pagehide', onPageHide)
    emitter.clear()
    void teardown(deps.client, channel)
  }

  const session: RoomSession = {
    role: 'host',
    participantId: hostId,
    roomCode,
    getView: () => toPublicView(state),
    subscribe: emitter.subscribe,
    close,
  }

  channel.on('broadcast', { event: 'room:join-intent' }, ({ payload }) => {
    if (closed || !isRecord(payload)) return
    const { requestId, participantId, displayName } = payload
    if (!isString(requestId) || !isString(participantId) || !isString(displayName)) return
    const outcome = dispatch({ type: 'Join', participantId, displayName })
    if (outcome === 'accepted') {
      void sendChecked(
        channel,
        'room:join-accepted',
        { requestId, participantId, roomCode, revision: state.revision },
        reportError,
      ).then(publish)
    } else if (outcome === 'duplicate-name') {
      void sendChecked(channel, 'room:join-rejected', { requestId, reason: 'duplicate-name' }, reportError)
    }
  })

  // Presence join/sync never change the roster; only a leave of an accepted Guest does.
  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (closed || !key || key === hostId) return
    if (dispatch({ type: 'Leave', participantId: key }) === 'accepted') publish()
  })

  return new Promise<RoomResult>((resolve) => {
    let settled = false
    const timer = timers.setTimeout(() => {
      if (settled) return
      settled = true
      close()
      resolve({ status: 'connection-timeout' })
    }, CREATE_DEADLINE_MS)

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || subscribed || closed) return
      subscribed = true
      void channel
        .track({ participantId: hostId, displayName: state.participants[0].displayName, role: 'host' })
        .then(() => {
          if (settled || closed) return
          settled = true
          timers.clearTimeout(timer)
          pageHide?.addEventListener('pagehide', onPageHide)
          resolve({ status: 'joined', session })
        })
    })
  })
}

export function joinRoom(input: { roomCode: string; displayName: string }, deps: RoomChannelDeps): Promise<RoomResult> {
  const timers = deps.timers ?? defaultTimers
  const createId = deps.createId ?? defaultId
  const roomCode = normalizeRoomCode(input.roomCode)
  if (!isWellFormedRoomCode(roomCode)) return Promise.resolve({ status: 'room-unavailable' })

  const participantId = createId()
  const requestId = createId()
  const channel = deps.client.channel(channelName(roomCode), channelConfig(participantId))
  const emitter = createEmitter()
  let view: PublicView | null = null
  let hostId: string | null = null
  let closed = false
  let subscribed = false
  let accepted = false
  let settled = false
  let resolveResult: (result: RoomResult) => void = () => undefined

  const close = () => {
    if (closed) return
    closed = true
    emitter.clear()
    void teardown(deps.client, channel)
  }

  const hostLeft = () => {
    if (closed) return
    emitter.emit({ type: 'host-left' })
    close()
  }

  const session: RoomSession = {
    role: 'guest',
    participantId,
    roomCode,
    getView: () => view as PublicView,
    subscribe: emitter.subscribe,
    close,
  }

  const fail = (result: RoomResult) => {
    if (settled) return
    settled = true
    timers.clearTimeout(timer)
    close()
    resolveResult(result)
  }

  const tryFinish = () => {
    if (settled || !accepted || !view) return
    settled = true
    timers.clearTimeout(timer)
    resolveResult({ status: 'joined', session })
  }

  const timer = timers.setTimeout(
    () => fail({ status: subscribed ? 'room-unavailable' : 'connection-timeout' }),
    JOIN_DEADLINE_MS,
  )

  channel.on('broadcast', { event: 'room:join-accepted' }, ({ payload }) => {
    if (closed || settled || !isRecord(payload)) return
    if (payload.requestId !== requestId || payload.participantId !== participantId || payload.roomCode !== roomCode) return
    accepted = true
    void channel.track({ participantId, displayName: input.displayName.trim(), role: 'guest' })
    tryFinish()
  })

  channel.on('broadcast', { event: 'room:join-rejected' }, ({ payload }) => {
    if (closed || settled || !isRecord(payload) || payload.requestId !== requestId) return
    if (payload.reason === 'duplicate-name') fail({ status: 'duplicate-name' })
  })

  channel.on('broadcast', { event: 'room:public-view' }, ({ payload }) => {
    if (closed) return
    if (!view) {
      // Before acceptance only a view that already contains this Guest is usable.
      if (!accepted) return
      const probe = applyPublicView({ roomCode, revision: -1, roundId: 0, phase: 'voting', participants: [], ended: false }, payload)
      if (probe.outcome !== 'applied' || !probe.view.participants.some((p) => p.participantId === participantId)) return
      view = probe.view
      hostId = view.participants.find((p) => p.role === 'host')?.participantId ?? null
      tryFinish()
      return
    }
    const result = applyPublicView(view, payload)
    if (result.outcome === 'malformed') {
      emitter.emit({ type: 'error', message: 'Received a malformed room view.' })
    } else if (result.outcome === 'applied') {
      view = result.view
      if (view.ended) return hostLeft()
      emitter.emit({ type: 'view', view })
    }
  })

  channel.on('broadcast', { event: 'room:host-left' }, ({ payload }) => {
    if (!isRecord(payload) || !hostId || payload.participantId !== hostId) return
    hostLeft()
  })

  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (hostId && key === hostId) hostLeft()
  })

  return new Promise<RoomResult>((resolve) => {
    resolveResult = resolve
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' || subscribed || closed) return
      subscribed = true
      void sendChecked(
        channel,
        'room:join-intent',
        { requestId, participantId, displayName: input.displayName },
        (message) => {
          if (!settled) emitter.emit({ type: 'error', message })
        },
      )
    })
  })
}
