import type {
  ApplyPublicViewResult,
  DisplayNameResult,
  Participant,
  PublicView,
  RoomAction,
  RoomReducerResult,
  RoomState,
} from '../types/room'

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6
export const DISPLAY_NAME_MAX = 20

export const normalizeRoomCode = (input: string): string => input.trim().toUpperCase()

export const isWellFormedRoomCode = (code: string): boolean => /^[A-Z0-9]{6}$/.test(code)

export function validateDisplayName(input: string): DisplayNameResult {
  const value = input.trim()
  if (value.length === 0) return { error: 'required' }
  if (value.length > DISPLAY_NAME_MAX) return { error: 'too-long' }
  return { value }
}

// `random` returns a number in [0, 1), such as Math.random.
export function generateRoomCode(random: () => number): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

export function createRoom(input: { roomCode: string; hostId: string; displayName: string }): RoomState {
  return {
    roomCode: normalizeRoomCode(input.roomCode),
    revision: 0,
    roundId: 1,
    phase: 'voting',
    status: 'active',
    hostId: input.hostId,
    participants: [
      { participantId: input.hostId, displayName: input.displayName.trim(), role: 'host', hasVoted: false },
    ],
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function roomReducer(state: RoomState, action: RoomAction): RoomReducerResult {
  const ignored: RoomReducerResult = { state, outcome: 'ignored' }
  if (state.status === 'ended') return ignored

  switch (action.type) {
    case 'Join': {
      if (state.participants.some((p) => p.participantId === action.participantId)) return ignored
      const name = validateDisplayName(action.displayName)
      if ('error' in name) return { state, outcome: 'invalid-name' }
      if (state.participants.some((p) => sameName(p.displayName, name.value))) {
        return { state, outcome: 'duplicate-name' }
      }
      const guest: Participant = {
        participantId: action.participantId,
        displayName: name.value,
        role: 'guest',
        hasVoted: false,
      }
      return {
        state: { ...state, revision: state.revision + 1, participants: [...state.participants, guest] },
        outcome: 'accepted',
      }
    }
    case 'Leave': {
      // The Host leaving is EndByHost, never Leave.
      if (action.participantId === state.hostId) return ignored
      if (!state.participants.some((p) => p.participantId === action.participantId)) return ignored
      return {
        state: {
          ...state,
          revision: state.revision + 1,
          participants: state.participants.filter((p) => p.participantId !== action.participantId),
        },
        outcome: 'accepted',
      }
    }
    case 'EndByHost':
      return { state: { ...state, status: 'ended', revision: state.revision + 1 }, outcome: 'accepted' }
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isParticipant = (v: unknown): v is Participant =>
  isRecord(v) &&
  typeof v.participantId === 'string' &&
  typeof v.displayName === 'string' &&
  (v.role === 'host' || v.role === 'guest') &&
  typeof v.hasVoted === 'boolean'

function isPublicView(v: unknown): v is PublicView {
  return (
    isRecord(v) &&
    typeof v.roomCode === 'string' &&
    Number.isInteger(v.revision) &&
    Number.isInteger(v.roundId) &&
    (v.phase === 'voting' || v.phase === 'revealed') &&
    typeof v.ended === 'boolean' &&
    Array.isArray(v.participants) &&
    v.participants.every(isParticipant)
  )
}

export function applyPublicView(current: PublicView, incoming: unknown): ApplyPublicViewResult {
  if (!isPublicView(incoming)) return { view: current, outcome: 'malformed' }
  if (incoming.roomCode !== current.roomCode) return { view: current, outcome: 'ignored' }
  if (incoming.revision <= current.revision) return { view: current, outcome: 'ignored' }
  return { view: incoming, outcome: 'applied' }
}
