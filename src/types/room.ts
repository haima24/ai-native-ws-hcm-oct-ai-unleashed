export type Role = 'host' | 'guest'
export type Phase = 'voting' | 'revealed'
export type RoomStatus = 'active' | 'ended'

export type Participant = {
  participantId: string
  displayName: string
  role: Role
  hasVoted: boolean
}

export type Room = {
  roomCode: string
  revision: number
  roundId: number
  phase: Phase
  status: RoomStatus
  hostId: string
  participants: Participant[]
}

export type Card = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?'

// Host-only vote map; never part of Participant, PublicView or any outbound payload before reveal.
export type RoomState = Room & { votes: Record<string, Card> }

export type RoomAction =
  | { type: 'Join'; participantId: string; displayName: string }
  | { type: 'Leave'; participantId: string }
  | { type: 'Vote'; participantId: string; roundId: number; card: string }
  | { type: 'EndByHost' }
  | { type: 'Reveal' }
  | { type: 'Revote' }

export type RoomOutcome = 'accepted' | 'duplicate-name' | 'invalid-name' | 'ignored' | 'no-votes'

export type VoteIgnoreReason = 'unknown-participant' | 'invalid-card' | 'round-mismatch' | 'not-voting'

export type RoomReducerResult = { state: RoomState; outcome: RoomOutcome; reason?: VoteIgnoreReason }

// `value` is null when the Participant has no accepted vote (shown as `No vote`).
export type ResultEntry = { participantId: string; value: Card | null }

export type RoundResults = {
  entries: ResultEntry[]
  average: string
  consensus: 'Yes' | 'No' | '—'
  voted: number
  participants: number
}

// Payload of the `room:public-view` Broadcast event; vote values appear only in `results` of a revealed view.
export type PublicView = {
  roomCode: string
  revision: number
  roundId: number
  phase: Phase
  participants: Participant[]
  ended: boolean
  // Non-null exactly when `phase` is `revealed`; absent is read as null so earlier views stay valid.
  results?: RoundResults | null
}

export type ApplyPublicViewResult = {
  view: PublicView
  outcome: 'applied' | 'ignored' | 'malformed'
}

export type DisplayNameResult = { value: string } | { error: 'required' | 'too-long' }
