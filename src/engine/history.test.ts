import { describe, expect, it } from 'vitest'
import { diff, makeUndoGroup, undoable, type HistoryGroup } from './history'
import { valdric } from './fixtures'

const g = (id: string, extra: Partial<HistoryGroup> = {}): HistoryGroup => ({
  id, at: 0, kind: 'game', groupType: 'damage', items: [{ type: 'damage', before: 44, after: 40 }], revert: { hp: { current: 44, temp: 0 } }, ...extra,
})

describe('history', () => {
  it('diff records new and previous values of changed fields only', () => {
    const before = valdric()
    const after = { ...before, hp: { current: 40, temp: 0 } }
    expect(diff(before, after)).toEqual({ patch: { hp: { current: 40, temp: 0 } }, revert: { hp: { current: 44, temp: 0 } } })
  })

  it('undo works like a stack, newest first, skipping what was undone', () => {
    const history = [g('c'), g('b'), g('a')]
    expect(undoable(history)?.id).toBe('c')
    const afterUndo = [{ ...makeUndoGroup(history[0]), id: 'u1', at: 1 }, ...history]
    expect(undoable(afterUndo)?.id).toBe('b')
  })

  it('session markers and notes are skipped; groups without revert stop the stack', () => {
    expect(undoable([g('s', { groupType: 'session', revert: undefined }), g('a')])?.id).toBe('a')
    expect(undoable([g('x', { revert: undefined }), g('a')])).toBeUndefined()
  })

  it('an undo group shows the reverse change', () => {
    expect(makeUndoGroup(g('a')).items).toEqual([
      { type: 'undo', params: { what: 'damage' } },
      { type: 'damage', before: 40, after: 44 },
    ])
  })
})
