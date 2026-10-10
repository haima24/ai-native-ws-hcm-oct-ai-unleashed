import { useRef, useState } from 'react'
import type { RoomSession } from '../../realtime/room-channel'
import ResultsPanel from './ResultsPanel'
import { useRoomSession } from './useRoomSession'
import VotingCards from './VotingCards'

const HOST_LEFT_MESSAGE = 'The Host closed the room. Return to Home to start or join another room.'
export const REVEAL_ERROR_MESSAGE = 'At least one vote is required to reveal'
const WAIT_FOR_REVEAL = 'Waiting for Host to reveal.'
const WAIT_FOR_REVOTE = 'Waiting for Host to start a revote.'

const primaryButton =
  'min-h-11 rounded bg-accent px-4 py-2 text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

type CopyState = 'idle' | 'copied' | 'failed'

export default function RoomShell({ session, onReturnHome }: { session: RoomSession; onReturnHome: () => void }) {
  const { view, hostLeft, error, voteState, vote, reveal, revote } = useRoomSession(session)
  const [copy, setCopy] = useState<CopyState>('idle')
  // Revision at which Reveal was refused; the error disappears once the view moves on.
  const [revealErrorRevision, setRevealErrorRevision] = useState<number | null>(null)
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null)
  const link = `${location.origin}${location.pathname}?room=${view.roomCode}`
  const revealed = view.phase === 'revealed'
  const showRevealError = revealErrorRevision === view.revision && !revealed
  const valueById = new Map(view.results?.entries.map((e) => [e.participantId, e.value] as const))
  const voteText = (id: string, hasVoted: boolean) =>
    revealed ? (valueById.get(id) ?? 'No vote') : hasVoted ? 'Voted' : 'Not voted'

  const onReveal = () => {
    const outcome = reveal?.()
    if (outcome === 'accepted') {
      setRevealErrorRevision(null)
      phaseHeadingRef.current?.focus()
    } else if (outcome === 'no-votes') {
      setRevealErrorRevision(session.getView().revision)
    }
  }

  const onRevote = () => {
    if (revote?.() === 'accepted') phaseHeadingRef.current?.focus()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  if (hostLeft) {
    return (
      <main className="mx-auto max-w-3xl p-3 text-ink sm:p-4 lg:p-6">
        <h1 className="text-3xl font-semibold">Story Pointing</h1>
        <div aria-hidden="true" className="ornament-divider mt-3" />
        <p role="alert" className="mt-4 text-danger">
          {HOST_LEFT_MESSAGE}
        </p>
        <button
          type="button"
          onClick={onReturnHome}
          className="mt-4 min-h-11 rounded bg-accent px-4 py-2 text-paper focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        >
          Return to Home
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl p-3 text-ink sm:p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold">Story Pointing</h1>
        <p>
          Room <span data-testid="room-code" className="font-mono font-semibold">{view.roomCode}</span>
        </p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="min-h-11 rounded bg-accent px-4 py-2 text-paper focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        >
          Copy link
        </button>
        {copy === 'copied' && <p role="status">Link copied</p>}
      </header>
      <div aria-hidden="true" className="ornament-divider mt-3" />
      {copy === 'failed' && (
        <div className="mt-2">
          <p role="alert" className="text-danger">
            Could not copy link. Select and copy the link.
          </p>
          <input
            readOnly
            aria-label="Room link"
            value={link}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded border border-rule bg-paper px-3 py-2 text-ink focus:outline-2 focus:outline-offset-2 focus:outline-focus"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <section aria-labelledby="players-heading" className="ornate rounded border border-rule bg-panel p-3">
          <h2 id="players-heading" className="text-lg font-semibold">
            Players ({view.participants.length})
          </h2>
          <ul data-testid="players-list" className="mt-2 space-y-1">
            {view.participants.map((p) => (
              <li key={p.participantId} className="break-words">
                {p.displayName}
                {p.role === 'host' && <span className="text-ink-muted"> · Host</span>}
                {p.participantId === session.participantId && <span className="text-ink-muted"> · You</span>}
                <span className="text-ink-muted">
                  {' · '}
                  <span data-testid="player-vote">{voteText(p.participantId, p.hasVoted)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Round">
          <h2
            ref={phaseHeadingRef}
            tabIndex={-1}
            data-testid="phase-heading"
            className="w-fit text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Phase: <span data-testid="room-phase">{view.phase}</span>
          </h2>
          <VotingCards state={voteState} phase={view.phase} onVote={vote} />
          {session.role === 'host' ? (
            <div className="mt-4">
              {revealed ? (
                <button type="button" onClick={onRevote} className={primaryButton}>
                  Revote
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReveal}
                  aria-describedby={showRevealError ? 'reveal-error' : undefined}
                  className={primaryButton}
                >
                  Reveal estimates
                </button>
              )}
              {showRevealError && (
                <p id="reveal-error" role="alert" data-testid="reveal-error" className="mt-2 text-danger">
                  {REVEAL_ERROR_MESSAGE}
                </p>
              )}
            </div>
          ) : (
            <p data-testid="phase-waiting" className="mt-4 text-ink-muted">
              {revealed ? WAIT_FOR_REVOTE : WAIT_FOR_REVEAL}
            </p>
          )}
          {revealed && view.results && <ResultsPanel results={view.results} />}
        </section>
      </div>
    </main>
  )
}
