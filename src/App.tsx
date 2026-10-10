import { useCallback, useState } from 'react'
import HomePage, { storeName } from './features/room/HomePage'
import RoomShell from './features/room/RoomShell'
import { useRoomConnection } from './features/room/useRoomConnection'
import type { RoomSession } from './realtime/room-channel'

export default function App() {
  const [session, setSession] = useState<RoomSession | null>(null)

  const onSession = useCallback((next: RoomSession) => {
    if (next.role === 'guest') {
      const name = next.getView().participants.find((p) => p.participantId === next.participantId)?.displayName
      if (name) storeName(name)
      history.replaceState(null, '', `?room=${next.roomCode}`)
    }
    setSession(next)
  }, [])

  const connection = useRoomConnection(onSession)

  if (session) {
    return (
      <RoomShell
        key={session.participantId}
        session={session}
        onReturnHome={() => {
          session.close()
          setSession(null)
        }}
      />
    )
  }
  return <HomePage connection={connection} />
}
