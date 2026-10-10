import type { Card, Participant, RoundResults } from '../types/room'

export const NO_RESULT = '—'

// Integer half-up rounding to hundredths; trailing zeroes are omitted.
function formatAverage(sum: number, count: number): string {
  const hundredths = Math.floor((200 * sum + count) / (2 * count))
  const whole = Math.floor(hundredths / 100)
  const fraction = hundredths % 100
  if (fraction === 0) return String(whole)
  if (fraction % 10 === 0) return `${whole}.${fraction / 10}`
  return `${whole}.${String(fraction).padStart(2, '0')}`
}

// Population is the current roster; votes of ids outside it are ignored. `?` and No vote are not numeric.
export function computeResults(
  votes: Readonly<Record<string, Card>>,
  roster: readonly Pick<Participant, 'participantId'>[],
): RoundResults {
  const entries = roster.map(({ participantId }) => ({
    participantId,
    value: Object.hasOwn(votes, participantId) ? votes[participantId] : null,
  }))
  const numeric = entries.flatMap((e) => (e.value === null || e.value === '?' ? [] : [Number(e.value)]))
  const sum = numeric.reduce((total, n) => total + n, 0)
  const hasNumeric = numeric.length > 0

  return {
    entries,
    average: hasNumeric ? formatAverage(sum, numeric.length) : NO_RESULT,
    consensus: !hasNumeric ? NO_RESULT : numeric.every((n) => n === numeric[0]) ? 'Yes' : 'No',
    voted: entries.filter((e) => e.value !== null).length,
    participants: roster.length,
  }
}
