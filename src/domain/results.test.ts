import { describe, expect, it } from 'vitest'
import { computeResults } from './results'
import type { Card } from '../types/room'

const DASH = '\u2014'

// `null` = Participant without an accepted vote; ids are p0, p1, ...
const compute = (cards: (Card | null)[], extraVotes: Record<string, Card> = {}) => {
  const roster = cards.map((_, i) => ({ participantId: `p${i}` }))
  const votes: Record<string, Card> = { ...extraVotes }
  cards.forEach((card, i) => {
    if (card !== null) votes[`p${i}`] = card
  })
  return computeResults(votes, roster)
}

const seven0one1: (Card | null)[] = ['0', '0', '0', '0', '0', '0', '0', '1']

const examples: [string, string, (Card | null)[], string, string, string, Record<string, Card>?][] = [
  ['TC-003-13', 'R-01 no votes', [null, null], DASH, DASH, '0 of 2 voted'],
  ['TC-003-14', 'R-02 all ?', ['?', '?'], DASH, DASH, '2 of 2 voted'],
  ['TC-003-15', 'R-03 only zeros', ['0', '0'], '0', 'Yes', '2 of 2 voted'],
  ['TC-003-16', 'R-04 zero with ?', ['0', '?'], '0', 'Yes', '2 of 2 voted'],
  ['TC-003-17', 'R-05 exact midpoint rounds up', seven0one1, '0.13', 'No', '8 of 8 voted'],
  ['TC-003-18', 'R-06 trailing zero dropped', ['5', '5', '8', '8'], '6.5', 'No', '4 of 4 voted'],
  ['TC-003-19', 'R-07 round down, ? and none excluded', ['3', '5', '8', '?', null], '5.33', 'No', '4 of 5 voted'],
  ['TC-003-20', 'R-08 equal numerics with ? and none', ['5', '5', '?', null], '5', 'Yes', '3 of 4 voted'],
  ['TC-003-21', 'R-09 round up non-midpoint', ['1', '2', '2'], '1.67', 'No', '3 of 3 voted'],
  ['TC-003-22', 'R-10 whole-number mean', ['13', '21'], '17', 'No', '2 of 2 voted'],
  ['TC-003-23', 'R-11 vote of a non-roster id ignored', ['3'], '3', 'Yes', '1 of 1 voted', { gone: '5' }],
  ['TC-003-24', 'R-12 one vote in a roster of three', ['1', null, null], '1', 'Yes', '1 of 3 voted'],
]

describe('US-003 domain: computeResults', () => {
  it.each(examples)('%s %s', (_id, _title, cards, average, consensus, participation, extra) => {
    const results = compute(cards, extra)
    expect(results.average).toBe(average)
    expect(results.consensus).toBe(consensus)
    expect(`${results.voted} of ${results.participants} voted`).toBe(participation)
  })

  it('TC-003-11 entries follow roster order with value, ? and null (No vote)', () => {
    const results = computeResults({ a: '0', b: '?' }, [{ participantId: 'a' }, { participantId: 'b' }, { participantId: 'c' }])
    expect(results.entries).toEqual([
      { participantId: 'a', value: '0' },
      { participantId: 'b', value: '?' },
      { participantId: 'c', value: null },
    ])
  })

  it('TC-003-23 a non-roster vote produces no entry', () => {
    const results = compute(['3'], { gone: '5' })
    expect(results.entries.map((e) => e.participantId)).toEqual(['p0'])
  })

  it('US-003 an inherited property name is not a vote', () => {
    const results = computeResults({}, [{ participantId: 'constructor' }, { participantId: '__proto__' }])
    expect(results.entries.map((e) => e.value)).toEqual([null, null])
    expect(results.voted).toBe(0)
  })

  it('US-003 an empty roster has no numeric votes', () => {
    expect(computeResults({}, [])).toEqual({ entries: [], average: DASH, consensus: DASH, voted: 0, participants: 0 })
  })

  it('US-003 average rounds half up at a 0.005 midpoint and down below it', () => {
    const zerosThenOne = (zeros: number): (Card | null)[] => [...Array<Card>(zeros).fill('0'), '1']
    expect(compute(zerosThenOne(199)).average).toBe('0.01') // 1/200 = 0.005
    expect(compute(zerosThenOne(2)).average).toBe('0.33') // 1/3
  })
})
