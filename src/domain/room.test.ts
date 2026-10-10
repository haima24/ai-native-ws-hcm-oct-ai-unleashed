import { describe, expect, it } from 'vitest'
import {
  ROOM_CODE_ALPHABET,
  applyPublicView,
  createRoom,
  generateRoomCode,
  isWellFormedRoomCode,
  normalizeRoomCode,
  roomReducer,
  validateDisplayName,
} from './room'
import type { PublicView, RoomState } from '../types/room'

const NAME_20 = 'ABCDEFGHIJKLMNOPQRST'
const NAME_21 = 'ABCDEFGHIJKLMNOPQRSTU'

const baseRoom = (): RoomState => createRoom({ roomCode: 'ABC234', hostId: 'h1', displayName: 'Maya' })

const join = (id: string, displayName: string) => ({ type: 'Join' as const, participantId: id, displayName })

const deepFrozen = <T>(value: T): T => {
  const walk = (v: unknown) => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      Object.freeze(v)
      Object.values(v).forEach(walk)
    }
  }
  walk(value)
  return value
}

const roomWithThree = (): RoomState => {
  let state = baseRoom()
  state = roomReducer(state, join('g-noah', 'Noah')).state
  state = roomReducer(state, join('g-linh', 'Linh')).state
  return state
}

describe('US-001 domain: room', () => {
  it('TC-001-02 createRoom builds the initial state', () => {
    const room = createRoom({ roomCode: 'ABC234', hostId: 'h1', displayName: ' Maya ' })
    expect(room.phase).toBe('voting')
    expect(room.status).toBe('active')
    expect(room.revision).toBe(0)
    expect(room.roundId).toBe(1)
    expect(room.participants).toEqual([
      { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: false },
    ])
  })

  it('TC-001-05 generated codes use only the restricted alphabet', () => {
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode(Math.random)
      expect(code).toHaveLength(6)
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
      expect(code).not.toMatch(/[0O1I]/)
    }
  })

  it('TC-001-05 generateRoomCode maps the random source onto the alphabet edges', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA')
    expect(generateRoomCode(() => 0.999999)).toBe('999999')
  })

  it('TC-001-08 normalizeRoomCode trims and upper-cases', () => {
    expect(normalizeRoomCode(' abc234 ')).toBe('ABC234')
  })

  it('TC-001-09 look-alike characters are well-formed on input', () => {
    for (const x of ['O0I1AB', 'o0i1ab', '000000', 'IIIIII', 'ABC1O0']) {
      expect(isWellFormedRoomCode(normalizeRoomCode(x))).toBe(true)
    }
  })

  it('TC-001-13 Join accepts a Guest without mutating the input', () => {
    const before = deepFrozen(baseRoom())
    const { state, outcome } = roomReducer(before, join('g1', 'Noah'))
    expect(outcome).toBe('accepted')
    expect(state.participants.map((p) => [p.displayName, p.role])).toEqual([
      ['Maya', 'host'],
      ['Noah', 'guest'],
    ])
    expect(state.participants[1].hasVoted).toBe(false)
    expect(state.revision).toBe(before.revision + 1)
    expect(state.phase).toBe(before.phase)
    expect(state.roundId).toBe(before.roundId)
    expect(before.participants).toHaveLength(1)
  })

  it('TC-001-19 accepted Join increments revision once', () => {
    let state = baseRoom()
    state = roomReducer(state, join('g1', 'Noah')).state
    expect(state.revision).toBe(1)
    state = roomReducer(state, join('g2', 'Linh')).state
    expect(state.revision).toBe(2)
  })

  it('TC-001-20 applyPublicView ignores stale, same-revision, wrong-room and malformed views', () => {
    const view = (over: Partial<PublicView>): PublicView => ({
      roomCode: 'ABC234',
      revision: 5,
      roundId: 1,
      phase: 'voting',
      ended: false,
      participants: [
        { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: false },
        { participantId: 'g1', displayName: 'Noah', role: 'guest', hasVoted: false },
        { participantId: 'g2', displayName: 'Linh', role: 'guest', hasVoted: false },
      ],
      ...over,
    })
    const current = view({})

    const stale = applyPublicView(current, view({ revision: 4, participants: current.participants.slice(0, 2) }))
    expect(stale.outcome).toBe('ignored')
    expect(stale.view).toBe(current)

    const same = applyPublicView(current, view({ participants: [current.participants[0]] }))
    expect(same.outcome).toBe('ignored')
    expect(same.view).toBe(current)

    const wrongRoom = applyPublicView(current, view({ roomCode: 'ZZZ999', revision: 9 }))
    expect(wrongRoom.outcome).toBe('ignored')
    expect(wrongRoom.view).toBe(current)

    for (const bad of [null, 'x', {}, { ...view({}), revision: '9' }, { ...view({}), participants: 'no' }, { ...view({ revision: 9 }), phase: 'x' }]) {
      const result = applyPublicView(current, bad)
      expect(result.outcome).toBe('malformed')
      expect(result.view).toBe(current)
    }

    const newer = applyPublicView(current, view({ revision: 6 }))
    expect(newer.outcome).toBe('applied')
    expect(newer.view.revision).toBe(6)
  })

  it('TC-001-29 20-character name with surrounding spaces is valid and trimmed', () => {
    expect(validateDisplayName(`  ${NAME_20}  `)).toEqual({ value: NAME_20 })
    const { state, outcome } = roomReducer(baseRoom(), join('g1', `  ${NAME_20}  `))
    expect(outcome).toBe('accepted')
    expect(state.participants[1].displayName).toBe(NAME_20)
  })

  it('TC-001-34 validateDisplayName classes', () => {
    expect(validateDisplayName('')).toEqual({ error: 'required' })
    expect(validateDisplayName('   ')).toEqual({ error: 'required' })
    expect(validateDisplayName('A')).toEqual({ value: 'A' })
    expect(validateDisplayName(NAME_20)).toEqual({ value: NAME_20 })
    expect(validateDisplayName(NAME_21)).toEqual({ error: 'too-long' })
    expect(validateDisplayName(' Maya ')).toEqual({ value: 'Maya' })
  })

  it('TC-001-39 duplicate name (any case, padded) is a no-op', () => {
    const before = deepFrozen(baseRoom())
    for (const name of ['maya', ' MAYA ']) {
      const { state, outcome } = roomReducer(before, join('g1', name))
      expect(outcome).toBe('duplicate-name')
      expect(state).toEqual(before)
      expect(state.revision).toBe(before.revision)
    }
  })

  it('TC-001-43 well-formed code passes the format check', () => {
    expect(isWellFormedRoomCode('ABC234')).toBe(true)
    expect(isWellFormedRoomCode(normalizeRoomCode(' abc234 '))).toBe(true)
  })

  it('TC-001-49 inner space makes a code malformed', () => {
    expect(isWellFormedRoomCode(normalizeRoomCode('AB C23'))).toBe(false)
  })

  it('TC-001-63 Leave removes an accepted Guest and the name can be reused', () => {
    const before = deepFrozen(roomWithThree())
    const left = roomReducer(before, { type: 'Leave', participantId: 'g-noah' })
    expect(left.outcome).toBe('accepted')
    expect(left.state.participants).toHaveLength(2)
    expect(left.state.participants.some((p) => p.displayName === 'Noah')).toBe(false)
    expect(left.state.revision).toBe(before.revision + 1)
    const rejoined = roomReducer(left.state, join('g-new', 'Noah'))
    expect(rejoined.outcome).toBe('accepted')
    expect(rejoined.state.participants).toHaveLength(3)
  })

  it('TC-001-64 Leave of an unknown or already-removed participant is ignored', () => {
    const before = roomWithThree()
    const unknown = roomReducer(before, { type: 'Leave', participantId: 'nobody' })
    expect(unknown.outcome).toBe('ignored')
    expect(unknown.state).toEqual(before)

    const once = roomReducer(before, { type: 'Leave', participantId: 'g-noah' }).state
    const twice = roomReducer(once, { type: 'Leave', participantId: 'g-noah' })
    expect(twice.outcome).toBe('ignored')
    expect(twice.state).toEqual(once)
    expect(twice.state.revision).toBe(once.revision)
  })

  it('TC-001-71 EndByHost ends the room; later Join and repeat end are no-ops', () => {
    const before = deepFrozen(baseRoom())
    const ended = roomReducer(before, { type: 'EndByHost' })
    expect(ended.outcome).toBe('accepted')
    expect(ended.state.status).toBe('ended')
    expect(ended.state.revision).toBe(before.revision + 1)

    const late = roomReducer(ended.state, join('g1', 'Noah'))
    expect(late.outcome).toBe('ignored')
    expect(late.state).toEqual(ended.state)

    const again = roomReducer(ended.state, { type: 'EndByHost' })
    expect(again.outcome).toBe('ignored')
    expect(again.state).toEqual(ended.state)
  })

  it('TC-001-85 Join in phase revealed keeps phase and roundId, with no vote', () => {
    const revealed: RoomState = deepFrozen({ ...baseRoom(), phase: 'revealed', roundId: 3 })
    const { state, outcome } = roomReducer(revealed, join('g1', 'Noah'))
    expect(outcome).toBe('accepted')
    expect(state.phase).toBe('revealed')
    expect(state.roundId).toBe(3)
    expect(state.participants.find((p) => p.displayName === 'Noah')?.hasVoted).toBe(false)
  })

  it('TC-001-87 no participant cap: 25 joins are accepted', () => {
    let state = baseRoom()
    for (let i = 0; i < 25; i++) {
      const result = roomReducer(state, join(`g${i}`, `Guest ${i}`))
      expect(result.outcome).toBe('accepted')
      state = result.state
    }
    expect(state.participants).toHaveLength(26)
  })

  it('TC-001-88 Join does not change roundId or phase', () => {
    const before = baseRoom()
    const { state } = roomReducer(before, join('g1', 'Noah'))
    expect(state.roundId).toBe(before.roundId)
    expect(state.phase).toBe(before.phase)
    expect(state.participants.every((p) => !p.hasVoted)).toBe(true)
  })

  it('TC-001-95 Join with an existing participantId is not accepted', () => {
    const before = deepFrozen(roomWithThree())
    const { state, outcome } = roomReducer(before, join('g-noah', 'Someone Else'))
    expect(outcome).not.toBe('accepted')
    expect(state).toEqual(before)
  })
})
