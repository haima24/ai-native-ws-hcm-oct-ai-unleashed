import type { Card } from '../types/room'

export type VoteUiState =
  | { status: 'idle'; confirmed: null }
  | { status: 'pending'; card: Card; requestId: string; confirmed: Card | null }
  | { status: 'confirmed'; card: Card; confirmed: Card }
  | { status: 'failed'; card: Card; requestId: string; confirmed: Card | null }

export type VoteUiEvent =
  | { type: 'select'; card: Card; requestId: string }
  | { type: 'select-confirmed'; card: Card; requestId: string }
  | { type: 'confirmed'; requestId: string }
  | { type: 'failed'; requestId: string }
  | { type: 'round-changed' }

export const INITIAL_VOTE_STATE: VoteUiState = { status: 'idle', confirmed: null }

export function voteReducer(state: VoteUiState, event: VoteUiEvent): VoteUiState {
  switch (event.type) {
    case 'select':
      if (state.status === 'pending') return state
      return { status: 'pending', card: event.card, requestId: event.requestId, confirmed: state.confirmed }
    case 'select-confirmed':
      // Host path: the vote is applied locally, so there is no pending phase to render.
      return { status: 'confirmed', card: event.card, confirmed: event.card }
    case 'confirmed':
      if ((state.status === 'pending' || state.status === 'failed') && state.requestId === event.requestId) {
        return { status: 'confirmed', card: state.card, confirmed: state.card }
      }
      return state
    case 'failed':
      if (state.status === 'pending' && state.requestId === event.requestId) {
        return { status: 'failed', card: state.card, requestId: state.requestId, confirmed: state.confirmed }
      }
      return state
    case 'round-changed':
      return INITIAL_VOTE_STATE
  }
}
