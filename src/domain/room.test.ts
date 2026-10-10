import { describe, expect, it } from 'vitest'
import {
  CARDS,
  ROOM_CODE_ALPHABET,
  applyPublicView,
  createRoom,
  generateRoomCode,
  isCard,
  isPublicViewChange,
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

const vote = (participantId: string, card: string, roundId = 1) => ({ type: 'Vote' as const, participantId, roundId, card })

const votingRoom = (): RoomState => roomReducer(baseRoom(), join('g1', 'Noah')).state

describe('US-002 domain: voting', () => {
  it('TC-002-02 CARDS and isCard accept exactly the nine cards', () => {
    expect([...CARDS]).toEqual(['0', '1', '2', '3', '5', '8', '13', '21', '?'])
    for (const card of CARDS) expect(isCard(card)).toBe(true)
    for (const bad of ['4', '', ' 5', '5 ', '1.5', 'x', 5, null, undefined]) expect(isCard(bad)).toBe(false)
  })

  it('TC-002-08 Vote stores and replaces; one entry per Participant, no card on Participant', () => {
    const start = deepFrozen(votingRoom())
    const first = roomReducer(start, vote('g1', '5'))
    expect(first.outcome).toBe('accepted')
    expect(first.state.votes).toEqual({ g1: '5' })
    expect(first.state.participants.find((p) => p.participantId === 'g1')?.hasVoted).toBe(true)
    expect(first.state.revision).toBe(start.revision + 1)

    const second = roomReducer(deepFrozen(first.state), vote('g1', '8'))
    expect(second.outcome).toBe('accepted')
    expect(second.state.votes).toEqual({ g1: '8' })
    expect(second.state.participants.find((p) => p.participantId === 'g1')?.hasVoted).toBe(true)
    expect(second.state.revision).toBe(first.state.revision + 1)

    const host = roomReducer(deepFrozen(second.state), vote('h1', '0'))
    expect(host.outcome).toBe('accepted')
    expect(host.state.votes).toEqual({ g1: '8', h1: '0' })
    expect(host.state.participants.find((p) => p.role === 'host')?.hasVoted).toBe(true)
    expect(JSON.stringify(host.state.participants)).not.toMatch(/"(0|8)"/)
    expect(Object.keys(host.state.participants[0]).sort()).toEqual(['displayName', 'hasVoted', 'participantId', 'role'])
  })

  it('TC-002-09 same-card resend is accepted without changing state or revision', () => {
    const voted = deepFrozen(roomReducer(votingRoom(), vote('g1', '5')).state)
    const again = roomReducer(voted, vote('g1', '5'))
    expect(again.outcome).toBe('accepted')
    expect(again.state).toEqual(voted)
    expect(again.state.revision).toBe(voted.revision)
  })

  it('TC-002-10 invalid votes are ignored with a reason and change nothing', () => {
    const before = deepFrozen(votingRoom())
    const cases: [ReturnType<typeof vote>, string][] = [
      [vote('zzz', '5'), 'unknown-participant'],
      [vote('g1', '4'), 'invalid-card'],
      [vote('g1', '5', 2), 'round-mismatch'],
    ]
    for (const [action, reason] of cases) {
      const result = roomReducer(before, action)
      expect(result.outcome).toBe('ignored')
      expect(result.reason).toBe(reason)
      expect(result.state).toEqual(before)
      expect(result.state.revision).toBe(before.revision)
    }
  })

  it('US-002 Vote check order: roster, then card, then round, then phase; revealed and ended are ignored', () => {
    const revealed: RoomState = deepFrozen({ ...votingRoom(), phase: 'revealed' })
    expect(roomReducer(revealed, vote('g1', '5'))).toMatchObject({ outcome: 'ignored', reason: 'not-voting' })
    expect(roomReducer(revealed, vote('zzz', '4', 9))).toMatchObject({ reason: 'unknown-participant' })
    expect(roomReducer(revealed, vote('g1', '4', 9))).toMatchObject({ reason: 'invalid-card' })
    expect(roomReducer(revealed, vote('g1', '5', 9))).toMatchObject({ reason: 'round-mismatch' })

    const ended = roomReducer(votingRoom(), { type: 'EndByHost' }).state
    const result = roomReducer(ended, vote('g1', '5'))
    expect(result.outcome).toBe('ignored')
    expect(result.reason).toBeUndefined()
  })

  it('US-002 D-023 Leave removes the leaving Participant vote', () => {
    const voted = roomReducer(roomReducer(votingRoom(), vote('g1', '5')).state, vote('h1', '3')).state
    const left = roomReducer(deepFrozen(voted), { type: 'Leave', participantId: 'g1' })
    expect(left.outcome).toBe('accepted')
    expect(left.state.votes).toEqual({ h1: '3' })
    expect(left.state.revision).toBe(voted.revision + 1)
  })

  it('US-002 isPublicViewChange is true only when public fields change', () => {
    const start = votingRoom()
    const first = roomReducer(start, vote('g1', '5')).state
    expect(isPublicViewChange(start, first)).toBe(true)
    const replaced = roomReducer(first, vote('g1', '8')).state
    expect(replaced.revision).toBeGreaterThan(first.revision)
    expect(isPublicViewChange(first, replaced)).toBe(false)
    expect(isPublicViewChange(first, first)).toBe(false)
    expect(isPublicViewChange(first, roomReducer(first, join('g2', 'Linh')).state)).toBe(true)
  })
})

const votedRoom = (): RoomState => {
  let state = votingRoom()
  state = roomReducer(state, vote('h1', '5')).state
  return roomReducer(state, vote('g1', '8')).state
}

const revealedRoom = (): RoomState => roomReducer(votedRoom(), { type: 'Reveal' }).state

describe('US-003 domain: reveal and revote', () => {
  it('TC-003-03 Reveal with a vote moves to revealed, keeps roundId and votes', () => {
    const before = deepFrozen(votedRoom())
    const { state, outcome } = roomReducer(before, { type: 'Reveal' })
    expect(outcome).toBe('accepted')
    expect(state.phase).toBe('revealed')
    expect(state.revision).toBe(before.revision + 1)
    expect(state.roundId).toBe(before.roundId)
    expect(state.votes).toEqual({ h1: '5', g1: '8' })
    expect(before.phase).toBe('voting')
  })

  it('TC-003-06 Reveal with zero votes is no-votes and changes nothing', () => {
    const before = deepFrozen(votingRoom())
    const result = roomReducer(before, { type: 'Reveal' })
    expect(result.outcome).toBe('no-votes')
    expect(result.state).toEqual(before)
    expect(result.state.revision).toBe(before.revision)
  })

  it('TC-003-07 a ? vote counts; the vote of a Participant who left does not', () => {
    const questioned = roomReducer(votingRoom(), vote('g1', '?')).state
    const ok = roomReducer(questioned, { type: 'Reveal' })
    expect(ok.outcome).toBe('accepted')
    expect(ok.state.phase).toBe('revealed')

    const voted = roomReducer(votingRoom(), vote('g1', '5')).state
    const left = roomReducer(voted, { type: 'Leave', participantId: 'g1' }).state
    const blocked = roomReducer(left, { type: 'Reveal' })
    expect(blocked.outcome).toBe('no-votes')
    expect(blocked.state.phase).toBe('voting')
  })

  it('TC-003-29 Revote clears the round and starts the next one', () => {
    const before = deepFrozen(revealedRoom())
    const { state, outcome } = roomReducer(before, { type: 'Revote' })
    expect(outcome).toBe('accepted')
    expect(state.phase).toBe('voting')
    expect(state.votes).toEqual({})
    expect(state.participants.every((p) => !p.hasVoted)).toBe(true)
    expect(state.roundId).toBe(before.roundId + 1)
    expect(state.revision).toBe(before.revision + 1)
    expect(state.status).toBe('active')
    expect(state.participants.map((p) => p.participantId)).toEqual(['h1', 'g1'])
    expect(before.votes).toEqual({ h1: '5', g1: '8' })
  })

  it('TC-003-34 Reveal while revealed is ignored', () => {
    const before = deepFrozen(revealedRoom())
    const result = roomReducer(before, { type: 'Reveal' })
    expect(result.outcome).toBe('ignored')
    expect(result.state).toEqual(before)
    expect(result.state.revision).toBe(before.revision)
  })

  it('TC-003-35 Revote while voting is ignored and keeps the votes', () => {
    const before = deepFrozen(votedRoom())
    const result = roomReducer(before, { type: 'Revote' })
    expect(result.outcome).toBe('ignored')
    expect(result.state).toEqual(before)
    expect(result.state.votes).toEqual({ h1: '5', g1: '8' })
    expect(result.state.roundId).toBe(before.roundId)
    expect(result.state.revision).toBe(before.revision)
  })

  it('TC-003-36 a vote for the previous round is rejected after Revote', () => {
    const next = roomReducer(revealedRoom(), { type: 'Revote' }).state
    expect(next.roundId).toBe(2)
    const result = roomReducer(deepFrozen(next), vote('g1', '5', 1))
    expect(result.outcome).toBe('ignored')
    expect(result.reason).toBe('round-mismatch')
    expect(result.state.votes).toEqual({})
    expect(result.state.participants.every((p) => !p.hasVoted)).toBe(true)
    expect(result.state.revision).toBe(next.revision)
    expect(roomReducer(next, vote('g1', '5', 2)).outcome).toBe('accepted')
  })

  it('US-003 Reveal and Revote are ignored once the room has ended', () => {
    const ended = roomReducer(votedRoom(), { type: 'EndByHost' }).state
    expect(roomReducer(ended, { type: 'Reveal' })).toEqual({ state: ended, outcome: 'ignored' })
    const endedRevealed = roomReducer(revealedRoom(), { type: 'EndByHost' }).state
    expect(roomReducer(endedRevealed, { type: 'Revote' })).toEqual({ state: endedRevealed, outcome: 'ignored' })
  })

  it('US-003 Join and Leave in revealed keep the phase and drop a leaver vote', () => {
    const joined = roomReducer(revealedRoom(), join('g2', 'Linh'))
    expect(joined.outcome).toBe('accepted')
    expect(joined.state.phase).toBe('revealed')
    expect(joined.state.votes).toEqual({ h1: '5', g1: '8' })
    const left = roomReducer(joined.state, { type: 'Leave', participantId: 'g1' })
    expect(left.state.phase).toBe('revealed')
    expect(left.state.votes).toEqual({ h1: '5' })
  })
})

describe('US-003 domain: public view results validation', () => {
  const results = {
    entries: [
      { participantId: 'h1', value: '5' },
      { participantId: 'g1', value: null },
    ],
    average: '5',
    consensus: 'Yes',
    voted: 1,
    participants: 2,
  }
  const view = (over: Record<string, unknown>) => ({
    roomCode: 'ABC234',
    revision: 4,
    roundId: 1,
    phase: 'voting',
    ended: false,
    participants: [
      { participantId: 'h1', displayName: 'Maya', role: 'host', hasVoted: true },
      { participantId: 'g1', displayName: 'Noah', role: 'guest', hasVoted: false },
    ],
    results: null,
    ...over,
  })
  const current = view({ revision: 3 }) as unknown as PublicView

  it('TC-003-12 malformed results views are rejected and the Guest keeps its view', () => {
    const { entries: _entries, ...withoutEntries } = results
    const bad = [
      view({ phase: 'voting', results }),
      view({ phase: 'revealed', results: null }),
      view({ phase: 'revealed', results: undefined }),
      view({ phase: 'revealed', results: withoutEntries }),
      view({ phase: 'revealed', results: { ...results, entries: [{ participantId: 'h1', value: '4' }] } }),
      view({ phase: 'revealed', results: { ...results, consensus: 'Maybe' } }),
      view({ phase: 'revealed', results: { ...results, voted: '1' } }),
      view({ phase: 'revealed', results: 'x' }),
    ]
    for (const incoming of bad) {
      const result = applyPublicView(current, incoming)
      expect(result.outcome).toBe('malformed')
      expect(result.view).toBe(current)
    }
  })

  it('US-003 a well-formed revealed view and a voting view without results are applied', () => {
    const revealed = applyPublicView(current, view({ phase: 'revealed', results }))
    expect(revealed.outcome).toBe('applied')
    const { results: _results, ...legacy } = view({})
    expect(applyPublicView(current, legacy).outcome).toBe('applied')
  })
})

