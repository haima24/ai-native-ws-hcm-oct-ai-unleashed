import type { Card, Participant, RoundResults } from '../types/room'
import { CARDS } from './room'

// Population is the current roster; votes of ids outside it are ignored. No vote is in no group.
export function computeResults(
  votes: Readonly<Record<string, Card>>,
  roster: readonly Pick<Participant, 'participantId'>[],
): RoundResults {
  const entries = roster.map(({ participantId }) => ({
    participantId,
    value: Object.hasOwn(votes, participantId) ? votes[participantId] : null,
  }))
  // CARDS is already numeric ascending with `?` last.
  const groups = CARDS.map((card) => ({ card, count: entries.filter((e) => e.value === card).length })).filter(
    (group) => group.count > 0,
  )

  return {
    entries,
    groups,
    voted: entries.filter((e) => e.value !== null).length,
    participants: roster.length,
  }
}
