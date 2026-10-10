import { CARDS } from '../../domain/room'
import type { VoteUiState } from '../../domain/vote'
import type { Card, Phase } from '../../types/room'

export const VOTE_PENDING_MESSAGE = 'Sending vote…'
export const VOTE_FAILED_MESSAGE = 'Vote was not confirmed. Try again.'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export default function VotingCards({
  state,
  phase,
  onVote,
}: {
  state: VoteUiState
  phase: Phase
  onVote: (card: Card) => void
}) {
  const disabled = phase !== 'voting' || state.status === 'pending'
  const selection = (card: Card) =>
    (state.status === 'pending' || state.status === 'failed') && state.card === card ? state.status : undefined

  return (
    <div className="mt-4">
      <div
        role="group"
        aria-label="Voting cards"
        data-testid="vote-cards"
        className="grid max-w-[760px] grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5"
      >
        {CARDS.map((card) => (
          <button
            key={card}
            type="button"
            disabled={disabled}
            aria-pressed={state.confirmed === card}
            data-selection={selection(card)}
            onClick={() => onVote(card)}
            className={`min-h-[88px] rounded border-2 border-rule bg-panel font-display text-[32px] font-semibold text-ink sm:min-h-24 lg:min-h-28 aria-pressed:bg-accent aria-pressed:text-paper aria-pressed:ring-2 aria-pressed:ring-inset aria-pressed:ring-paper data-[selection=failed]:border-danger data-[selection=pending]:border-dashed data-[selection=pending]:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {card}
          </button>
        ))}
      </div>
      {state.status === 'pending' && (
        <p role="status" data-testid="vote-status" className="mt-3 text-ink-muted">
          {VOTE_PENDING_MESSAGE}
        </p>
      )}
      {state.status === 'failed' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" data-testid="vote-error" className="text-danger">
            {VOTE_FAILED_MESSAGE}
          </p>
          <button
            type="button"
            disabled={phase !== 'voting'}
            onClick={() => onVote(state.card)}
            className={`min-h-11 rounded bg-accent px-4 py-2 text-paper disabled:opacity-60 ${focusRing}`}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
