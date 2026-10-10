import { useCallback, useEffect, useReducer, useState } from 'react'
import { INITIAL_VOTE_STATE, voteReducer, type VoteUiState } from '../../domain/vote'
import type { RoomSession } from '../../realtime/room-channel'
import type { Card, PublicView, RoomOutcome } from '../../types/room'

export interface UseRoomSession {
  view: PublicView
  hostLeft: boolean
  error: string | null
  voteState: VoteUiState
  vote: (card: Card) => void
  // Defined for the Host only.
  reveal?: () => RoomOutcome
  revote?: () => RoomOutcome
}

const pendingClose = new WeakMap<RoomSession, ReturnType<typeof setTimeout>>()

export function useRoomSession(session: RoomSession): UseRoomSession {
  const [view, setView] = useState<PublicView>(() => session.getView())
  const [hostLeft, setHostLeft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voteState, dispatchVote] = useReducer(voteReducer, INITIAL_VOTE_STATE)

  useEffect(() => {
    // StrictMode runs setup, cleanup, setup on mount: a re-attach cancels the deferred close.
    clearTimeout(pendingClose.get(session))
    setView(session.getView())
    let roundId = session.getView().roundId
    const unsubscribe = session.subscribe((event) => {
      if (event.type === 'view') {
        setView(event.view)
        if (event.view.roundId !== roundId) {
          roundId = event.view.roundId
          dispatchVote({ type: 'round-changed' })
        }
      } else if (event.type === 'host-left') setHostLeft(true)
      else if (event.type === 'vote-result') dispatchVote({ type: event.result, requestId: event.requestId })
      else setError(event.message)
    })
    return () => {
      unsubscribe()
      pendingClose.set(
        session,
        setTimeout(() => session.close(), 0),
      )
    }
  }, [session])

  const vote = useCallback(
    (card: Card) => {
      const requestId = session.vote(card)
      dispatchVote({ type: session.role === 'host' ? 'select-confirmed' : 'select', card, requestId })
    },
    [session],
  )

  return {
    view,
    hostLeft,
    error,
    voteState,
    vote,
    reveal: session.reveal,
    revote: session.revote,
  }
}
