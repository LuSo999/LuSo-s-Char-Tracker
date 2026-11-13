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

describe('Undo an older rest or level up', () => {
  it('takes back the rest but keeps damage taken after it', async () => {
    const { makeCharacter, srd } = await import('./fixtures')
    const { longRest } = await import('./rest')
    const { takeDamage } = await import('./actions')
    const { computeSheet } = await import('./derive')
    const { diff, undoPast, pastUndoable } = await import('./history')
    const content = srd('2024')
    const c0 = makeCharacter({ edition: '2024', classes: [{ classId: 'fighter', level: 5 }], speciesId: 'human', backgroundId: 'soldier', baseScores: { str: 16, dex: 14, con: 14, int: 8, wis: 10, cha: 10 }, hp: { current: 10 }, resourcesUsed: { 'second-wind': 2 } })
    const c1 = longRest(c0, content).character
    const rest = { id: 'r', at: 1, kind: 'game' as const, groupType: 'longRest', items: [], revert: diff(c0, c1).revert }
    const hit = takeDamage(c1, computeSheet(c1, content), 5)
    if (!hit.ok) throw new Error()
    const c2 = hit.character
    const dmg = { id: 'd', at: 2, kind: 'game' as const, groupType: 'damage', items: [], revert: diff(c1, c2).revert }
    const history = [dmg, rest]
    expect(pastUndoable(history).has('r')).toBe(true)
    const back = undoPast(c2, rest, history)
    // Before the rest: 10 HP; the 5 damage after it still counts.
    expect(back.hp.current).toBe(5)
    expect(back.resourcesUsed['second-wind']).toBe(2)
  })
})
