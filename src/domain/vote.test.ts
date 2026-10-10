import { describe, expect, it } from 'vitest'
import { voteReducer, type VoteUiEvent, type VoteUiState } from './vote'

const IDLE: VoteUiState = { status: 'idle', confirmed: null }

const run = (start: VoteUiState, ...events: VoteUiEvent[]) => events.reduce(voteReducer, start)

describe('US-002 domain: voteReducer', () => {
  it('TC-002-11 select then matching confirmation; replacement keeps the confirmed card while pending', () => {
    const pending = voteReducer(IDLE, { type: 'select', card: '5', requestId: 'r1' })
    expect(pending).toEqual({ status: 'pending', card: '5', requestId: 'r1', confirmed: null })
    const confirmed = voteReducer(pending, { type: 'confirmed', requestId: 'r1' })
    expect(confirmed).toEqual({ status: 'confirmed', card: '5', confirmed: '5' })

    const replacing = voteReducer(confirmed, { type: 'select', card: '8', requestId: 'r2' })
    expect(replacing).toEqual({ status: 'pending', card: '8', requestId: 'r2', confirmed: '5' })
    expect(voteReducer(replacing, { type: 'confirmed', requestId: 'r2' })).toEqual({
      status: 'confirmed',
      card: '8',
      confirmed: '8',
    })
  })

  it('TC-002-11 a stale requestId and a select while pending leave the state unchanged', () => {
    const pending = run(IDLE, { type: 'select', card: '5', requestId: 'r1' })
    expect(voteReducer(pending, { type: 'confirmed', requestId: 'r-other' })).toBe(pending)
    expect(voteReducer(pending, { type: 'select', card: '3', requestId: 'r3' })).toBe(pending)
  })

  it('TC-002-19 failure keeps the previous confirmed card; late ack of the same request confirms', () => {
    const replacing = run(
      IDLE,
      { type: 'select', card: '5', requestId: 'r1' },
      { type: 'confirmed', requestId: 'r1' },
      { type: 'select', card: '8', requestId: 'r2' },
    )
    const failed = voteReducer(replacing, { type: 'failed', requestId: 'r2' })
    expect(failed).toEqual({ status: 'failed', card: '8', requestId: 'r2', confirmed: '5' })
    expect(voteReducer(failed, { type: 'failed', requestId: 'r-other' })).toBe(failed)
    expect(voteReducer(failed, { type: 'confirmed', requestId: 'r-other' })).toBe(failed)
    expect(voteReducer(failed, { type: 'confirmed', requestId: 'r2' })).toEqual({
      status: 'confirmed',
      card: '8',
      confirmed: '8',
    })
    expect(voteReducer(failed, { type: 'select', card: '8', requestId: 'r3' })).toEqual({
      status: 'pending',
      card: '8',
      requestId: 'r3',
      confirmed: '5',
    })
  })

  it('TC-002-19 a stale failure does not change a pending retry', () => {
    const retrying = run(
      IDLE,
      { type: 'select', card: '8', requestId: 'r1' },
      { type: 'failed', requestId: 'r1' },
      { type: 'select', card: '8', requestId: 'r2' },
    )
    expect(voteReducer(retrying, { type: 'failed', requestId: 'r1' })).toBe(retrying)
  })

  it('US-002 round-changed returns to idle from any state', () => {
    const confirmed = run(IDLE, { type: 'select', card: '5', requestId: 'r1' }, { type: 'confirmed', requestId: 'r1' })
    expect(voteReducer(confirmed, { type: 'round-changed' })).toEqual(IDLE)
    const pending = run(confirmed, { type: 'select', card: '8', requestId: 'r2' })
    expect(voteReducer(pending, { type: 'round-changed' })).toEqual(IDLE)
  })

  it('TC-003-31 round-changed clears confirmed, pending and failed selections', () => {
    const confirmed = run(IDLE, { type: 'select', card: '5', requestId: 'r1' }, { type: 'confirmed', requestId: 'r1' })
    const pending = run(confirmed, { type: 'select', card: '8', requestId: 'r2' })
    const failed = run(pending, { type: 'failed', requestId: 'r2' })
    expect(confirmed.status).toBe('confirmed')
    expect(pending.status).toBe('pending')
    expect(failed.status).toBe('failed')
    for (const state of [confirmed, pending, failed]) {
      const next = voteReducer(state, { type: 'round-changed' })
      expect(next).toEqual({ status: 'idle', confirmed: null })
    }
    // A late ack for the previous round cannot restore the selection.
    expect(voteReducer(voteReducer(pending, { type: 'round-changed' }), { type: 'confirmed', requestId: 'r2' })).toEqual(IDLE)
  })
})
