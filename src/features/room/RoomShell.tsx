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
  'min-h-11 rounded bg-[#455A64] px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FCC]'

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
      <main className="mx-auto max-w-3xl p-3 text-[#263238] sm:p-4 lg:p-6">
        <h1 className="text-3xl font-semibold">Story Pointing</h1>
        <p role="alert" className="mt-4 text-[#B3261E]">
          {HOST_LEFT_MESSAGE}
        </p>
        <button
          type="button"
          onClick={onReturnHome}
          className="mt-4 min-h-11 rounded bg-[#455A64] px-4 py-2 text-white focus:outline-2 focus:outline-offset-2 focus:outline-[#005FCC]"
        >
          Return to Home
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl p-3 text-[#263238] sm:p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold">Story Pointing</h1>
        <p>
          Room <span data-testid="room-code" className="font-mono font-semibold">{view.roomCode}</span>
        </p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="min-h-11 rounded bg-[#455A64] px-4 py-2 text-white focus:outline-2 focus:outline-offset-2 focus:outline-[#005FCC]"
        >
          Copy link
        </button>
        {copy === 'copied' && <p role="status">Link copied</p>}
      </header>
      {copy === 'failed' && (
        <div className="mt-2">
          <p role="alert" className="text-[#B3261E]">
            Could not copy link. Select and copy the link.
          </p>
          <input
            readOnly
            aria-label="Room link"
            value={link}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[#B3261E]">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <section aria-labelledby="players-heading" className="rounded bg-[#F1F3F4] p-3">
          <h2 id="players-heading" className="text-lg font-semibold">
            Players ({view.participants.length})
          </h2>
          <ul data-testid="players-list" className="mt-2 space-y-1">
            {view.participants.map((p) => (
              <li key={p.participantId} className="break-words">
                {p.displayName}
                {p.role === 'host' && <span className="text-[#546E7A]"> · Host</span>}
                {p.participantId === session.participantId && <span className="text-[#546E7A]"> · You</span>}
                <span className="text-[#546E7A]">
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
            className="w-fit text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FCC]"
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
                <p id="reveal-error" role="alert" data-testid="reveal-error" className="mt-2 text-[#B3261E]">
                  {REVEAL_ERROR_MESSAGE}
                </p>
              )}
            </div>
          ) : (
            <p data-testid="phase-waiting" className="mt-4 text-[#546E7A]">
              {revealed ? WAIT_FOR_REVOTE : WAIT_FOR_REVEAL}
            </p>
          )}
          {revealed && view.results && <ResultsPanel results={view.results} />}
        </section>
      </div>
    </main>
  )
}
