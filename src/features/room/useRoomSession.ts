import { useEffect, useState } from 'react'
import type { RoomSession } from '../../realtime/room-channel'
import type { PublicView } from '../../types/room'

export interface UseRoomSession {
  view: PublicView
  hostLeft: boolean
  error: string | null
}

const pendingClose = new WeakMap<RoomSession, ReturnType<typeof setTimeout>>()

export function useRoomSession(session: RoomSession): UseRoomSession {
  const [view, setView] = useState<PublicView>(() => session.getView())
  const [hostLeft, setHostLeft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // StrictMode runs setup, cleanup, setup on mount: a re-attach cancels the deferred close.
    clearTimeout(pendingClose.get(session))
    setView(session.getView())
    const unsubscribe = session.subscribe((event) => {
      if (event.type === 'view') setView(event.view)
      else if (event.type === 'host-left') setHostLeft(true)
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

  return { view, hostLeft, error }
}
