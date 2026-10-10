import { CARDS } from '../../domain/room'
import type { VoteUiState } from '../../domain/vote'
import type { Card, Phase } from '../../types/room'

export const VOTE_PENDING_MESSAGE = 'Sending vote…'
export const VOTE_FAILED_MESSAGE = 'Vote was not confirmed. Try again.'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FCC]'

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
            className={`min-h-[88px] rounded border-2 border-transparent bg-[#F1F3F4] text-[32px] font-semibold text-[#263238] sm:min-h-24 lg:min-h-28 aria-pressed:bg-[#455A64] aria-pressed:text-white data-[selection=failed]:border-[#B3261E] data-[selection=pending]:border-dashed data-[selection=pending]:border-[#455A64] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {card}
          </button>
        ))}
      </div>
      {state.status === 'pending' && (
        <p role="status" data-testid="vote-status" className="mt-3 text-[#546E7A]">
          {VOTE_PENDING_MESSAGE}
        </p>
      )}
      {state.status === 'failed' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" data-testid="vote-error" className="text-[#B3261E]">
            {VOTE_FAILED_MESSAGE}
          </p>
          <button
            type="button"
            disabled={phase !== 'voting'}
            onClick={() => onVote(state.card)}
            className={`min-h-11 rounded bg-[#455A64] px-4 py-2 text-white disabled:opacity-60 ${focusRing}`}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
