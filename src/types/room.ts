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

export type RoomState = Room

export type RoomAction =
  | { type: 'Join'; participantId: string; displayName: string }
  | { type: 'Leave'; participantId: string }
  | { type: 'EndByHost' }

export type RoomOutcome = 'accepted' | 'duplicate-name' | 'invalid-name' | 'ignored'

export type RoomReducerResult = { state: RoomState; outcome: RoomOutcome }

// Payload of the `room:public-view` Broadcast event; never carries vote values.
export type PublicView = {
  roomCode: string
  revision: number
  roundId: number
  phase: Phase
  participants: Participant[]
  ended: boolean
}

export type ApplyPublicViewResult = {
  view: PublicView
  outcome: 'applied' | 'ignored' | 'malformed'
}

export type DisplayNameResult = { value: string } | { error: 'required' | 'too-long' }
