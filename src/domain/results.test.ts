import { describe, expect, it } from 'vitest'
import { computeResults } from './results'
import type { Card } from '../types/room'

// `null` = Participant without an accepted vote; ids are p0, p1, ...
const compute = (cards: (Card | null)[], extraVotes: Record<string, Card> = {}) => {
  const roster = cards.map((_, i) => ({ participantId: `p${i}` }))
  const votes: Record<string, Card> = { ...extraVotes }
  cards.forEach((card, i) => {
    if (card !== null) votes[`p${i}`] = card
  })
  return computeResults(votes, roster)
}

const g = (card: Card, count: number) => ({ card, count })

const sevenZerosOneOne: (Card | null)[] = ['0', '0', '0', '0', '0', '0', '0', '1']

const examples: [string, string, (Card | null)[], { card: Card; count: number }[], string, Record<string, Card>?][] = [
  ['TC-003-13', 'G-01 no votes', [null, null], [], '0 of 2 voted'],
  ['TC-003-14', 'G-02 all ?', ['?', '?'], [g('?', 2)], '2 of 2 voted'],
  ['TC-003-15', 'G-03 only zeros', ['0', '0'], [g('0', 2)], '2 of 2 voted'],
  ['TC-003-16', 'G-04 zero then ?', ['0', '?'], [g('0', 1), g('?', 1)], '2 of 2 voted'],
  ['TC-003-17', 'G-05 seven zeros and one 1', sevenZerosOneOne, [g('0', 7), g('1', 1)], '8 of 8 voted'],
  ['TC-003-18', 'G-06 two pairs', ['5', '5', '8', '8'], [g('5', 2), g('8', 2)], '4 of 4 voted'],
  [
    'TC-003-19',
    'G-07 ? last, No vote excluded',
    ['3', '5', '8', '?', null],
    [g('3', 1), g('5', 1), g('8', 1), g('?', 1)],
    '4 of 5 voted',
  ],
  ['TC-003-20', 'G-08 pair, ? and No vote', ['5', '5', '?', null], [g('5', 2), g('?', 1)], '3 of 4 voted'],
  [
    'TC-003-21',
    'G-09 every card, numeric order with ? last',
    ['?', '21', '1', '13', '0', '8', '3', '2', '5'],
    [g('0', 1), g('1', 1), g('2', 1), g('3', 1), g('5', 1), g('8', 1), g('13', 1), g('21', 1), g('?', 1)],
    '9 of 9 voted',
  ],
  ['TC-003-22', 'G-10 13 before 21 (numeric, not lexical)', ['13', '21'], [g('13', 1), g('21', 1)], '2 of 2 voted'],
  ['TC-003-23', 'G-11 vote of a non-roster id ignored', ['3'], [g('3', 1)], '1 of 1 voted', { gone: '5' }],
  ['TC-003-24', 'G-12 one vote in a roster of three', ['1', null, null], [g('1', 1)], '1 of 3 voted'],
]

describe('US-003 domain: computeResults', () => {
  it.each(examples)('%s %s', (_id, _title, cards, groups, participation, extra) => {
    const results = compute(cards, extra)
    expect(results.groups).toEqual(groups)
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
    expect(results.groups).toEqual([])
    expect(results.voted).toBe(0)
  })

  it('US-003 an empty roster has no groups', () => {
    expect(computeResults({}, [])).toEqual({ entries: [], groups: [], voted: 0, participants: 0 })
  })

  it('D-025 results carry no average or consensus', () => {
    expect(Object.keys(compute(['5', '8']))).toEqual(['entries', 'groups', 'voted', 'participants'])
  })
})
