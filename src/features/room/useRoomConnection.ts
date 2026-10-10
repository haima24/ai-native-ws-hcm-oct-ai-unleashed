import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoom, joinRoom, type ClientLike, type RoomSession } from '../../realtime/room-channel'
import { createSupabaseClient } from '../../realtime/supabase'

export type FormKind = 'create' | 'join'
export type FailureKind = 'connection-timeout' | 'room-unavailable'

export interface UseRoomConnection {
  pending: FormKind | null
  failure: { form: FormKind; kind: FailureKind } | null
  duplicateName: boolean
  create(displayName: string): Promise<void>
  join(roomCode: string, displayName: string): Promise<void>
}

let sharedClient: ClientLike | null = null
function getClient(): ClientLike {
  sharedClient ??= createSupabaseClient() as unknown as ClientLike
  return sharedClient
}

export function useRoomConnection(onSession: (session: RoomSession) => void): UseRoomConnection {
  const [pending, setPending] = useState<FormKind | null>(null)
  const [failure, setFailure] = useState<UseRoomConnection['failure']>(null)
  const [duplicateName, setDuplicateName] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  const onSessionRef = useRef(onSession)

  useEffect(() => {
    onSessionRef.current = onSession
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async (form: FormKind, start: () => ReturnType<typeof createRoom>) => {
    if (busy.current) return
    busy.current = true
    setPending(form)
    setFailure(null)
    setDuplicateName(false)
    try {
      const result = await start()
      if (!mounted.current) {
        if (result.status === 'joined') result.session.close()
        return
      }
      if (result.status === 'joined') onSessionRef.current(result.session)
      else if (result.status === 'duplicate-name') setDuplicateName(true)
      else setFailure({ form, kind: result.status })
    } catch {
      // A missing or invalid Supabase configuration cannot establish a connection.
      if (mounted.current) setFailure({ form, kind: 'connection-timeout' })
    } finally {
      busy.current = false
      if (mounted.current) setPending(null)
    }
  }, [])

  const create = useCallback(
    (displayName: string) => run('create', () => createRoom({ displayName }, { client: getClient() })),
    [run],
  )
  const join = useCallback(
    (roomCode: string, displayName: string) =>
      run('join', () => joinRoom({ roomCode, displayName }, { client: getClient() })),
    [run],
  )

  return { pending, failure, duplicateName, create, join }
}
