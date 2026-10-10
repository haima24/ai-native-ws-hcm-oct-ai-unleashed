import { useState, type FormEvent } from 'react'
import { isWellFormedRoomCode, normalizeRoomCode, validateDisplayName } from '../../domain/room'
import type { UseRoomConnection } from './useRoomConnection'

const NAME_STORAGE_KEY = 'story-pointing:display-name'

export const readStoredName = (): string => {
  try {
    return sessionStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export const storeName = (name: string) => {
  try {
    sessionStorage.setItem(NAME_STORAGE_KEY, name)
  } catch {
    // Storage is a convenience only.
  }
}

const NAME_ERRORS = {
  required: 'Enter a display name.',
  'too-long': 'Display name must be 20 characters or fewer.',
} as const

const input =
  'w-full rounded border border-slate-400 bg-white px-3 py-2 text-base text-[#263238] focus:outline-2 focus:outline-offset-2 focus:outline-[#005FCC]'
const button =
  'min-h-11 rounded bg-[#455A64] px-4 py-2 text-base text-white focus:outline-2 focus:outline-offset-2 focus:outline-[#005FCC] disabled:opacity-50'
const errorText = 'mt-1 text-sm text-[#B3261E]'

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className={errorText}>
      {message}
    </p>
  )
}

export default function HomePage({ connection }: { connection: UseRoomConnection }) {
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '')
  const [joinName, setJoinName] = useState(readStoredName)
  const [createNameError, setCreateNameError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [joinNameError, setJoinNameError] = useState<string | null>(null)

  const { pending, failure, duplicateName } = connection
  const connecting = pending !== null

  const onCreate = (event: FormEvent) => {
    event.preventDefault()
    if (connecting) return
    const name = validateDisplayName(createName)
    if ('error' in name) {
      setCreateNameError(NAME_ERRORS[name.error])
      return
    }
    setCreateNameError(null)
    void connection.create(name.value)
  }

  const onJoin = (event: FormEvent) => {
    event.preventDefault()
    if (connecting) return
    const code = normalizeRoomCode(joinCode)
    const name = validateDisplayName(joinName)
    const nextCodeError =
      code.length === 0 ? 'Enter the room code.' : isWellFormedRoomCode(code) ? null : 'Room code must be 6 letters or digits.'
    const nextNameError = 'error' in name ? NAME_ERRORS[name.error] : null
    setCodeError(nextCodeError)
    setJoinNameError(nextNameError)
    if (nextCodeError || 'error' in name) return
    void connection.join(code, name.value)
  }

  const joinNameMessage = joinNameError ?? (duplicateName ? 'That name is already taken in this room.' : null)
  const createFailure = failure?.form === 'create' ? failure.kind : null
  const joinFailure = failure?.form === 'join' ? failure.kind : null

  return (
    <main className="mx-auto max-w-3xl p-3 text-[#263238] sm:p-4 lg:p-6">
      <h1 className="text-3xl font-semibold">Story Pointing</h1>
      <p className="mt-1 text-[#546E7A]">Estimate together, without signing up.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="create-heading" className="rounded bg-[#F1F3F4] p-4">
          <h2 id="create-heading" className="text-xl font-semibold">
            Create room
          </h2>
          <form onSubmit={onCreate} noValidate className="mt-3 space-y-3">
            <div>
              <label htmlFor="create-name">Display name</label>
              <input
                id="create-name"
                className={input}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                aria-invalid={createNameError ? true : undefined}
                aria-describedby={createNameError ? 'create-name-error' : undefined}
                autoComplete="off"
              />
              <FieldError id="create-name-error" message={createNameError} />
            </div>
            {pending === 'create' && (
              <p role="status" data-testid="connection-status">
                Connecting…
              </p>
            )}
            {createFailure && (
              <p role="alert" data-testid="form-error" className={errorText}>
                Could not connect in time. Try again.
              </p>
            )}
            <button type="submit" className={button} disabled={connecting}>
              Create room
            </button>
          </form>
        </section>

        <section aria-labelledby="join-heading" className="rounded bg-[#F1F3F4] p-4">
          <h2 id="join-heading" className="text-xl font-semibold">
            Join room
          </h2>
          <form onSubmit={onJoin} noValidate className="mt-3 space-y-3">
            <div>
              <label htmlFor="join-code">Room code</label>
              <input
                id="join-code"
                className={input}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? 'join-code-error' : undefined}
                autoComplete="off"
              />
              <FieldError id="join-code-error" message={codeError} />
            </div>
            <div>
              <label htmlFor="join-name">Display name</label>
              <input
                id="join-name"
                className={input}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                aria-invalid={joinNameMessage ? true : undefined}
                aria-describedby={joinNameMessage ? 'join-name-error' : undefined}
                autoComplete="off"
              />
              <FieldError id="join-name-error" message={joinNameMessage} />
            </div>
            {pending === 'join' && (
              <p role="status" data-testid="connection-status">
                Connecting…
              </p>
            )}
            {joinFailure && (
              <p role="alert" data-testid="form-error" className={errorText}>
                {joinFailure === 'room-unavailable'
                  ? 'Room not found or unreachable. Check the code and try again.'
                  : 'Could not connect in time. Try again.'}
              </p>
            )}
            <button type="submit" className={button} disabled={connecting}>
              Join room
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
