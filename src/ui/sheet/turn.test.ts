import { beforeEach, describe, expect, it } from 'vitest'
import { attacksLeft, restoreTurnFor, rememberTurn, slotFree, snapshotTurn, useTurn } from './turn'

const turn = () => useTurn.getState()

describe('turn tracker', () => {
  beforeEach(() => turn().newTurn())

  it('Extra Attack: the first attack spends the Action, the rest belong to the same Attack action', () => {
    const id = turn().attack('Flail', 2, true)
    expect(turn().action).toBe(1)
    expect(attacksLeft(turn())).toBe(1)
    expect(turn().attack('Javelin', 2, true)).toBe(id)
    expect(turn().action).toBe(1)
    expect(attacksLeft(turn())).toBe(0)
    expect(turn().attackAction!.names).toEqual(['Flail', 'Javelin'])
  })

  it('Action Surge allows a second Attack action with all its attacks', () => {
    turn().attack('Flail', 2, true)
    turn().attack('Flail', 2, true)
    turn().surge()
    expect(slotFree(turn(), 'action')).toBe(true)
    turn().attack('Flail', 2, true)
    expect(turn().action).toBe(2)
    expect(attacksLeft(turn())).toBe(1)
  })

  it('using another Action ends the Attack action', () => {
    turn().attack('Flail', 2, true)
    turn().use('action')
    expect(turn().attackAction).toBeUndefined()
  })

  it('one maneuver per attack: a new attack clears the per-attack groups', () => {
    turn().attack('Flail', 2, true)
    turn().markPerAttack('maneuver')
    expect(turn().perAttack).toEqual(['maneuver'])
    turn().attack('Flail', 2, true)
    expect(turn().perAttack).toEqual([])
  })

  it('undo restores the snapshot taken before the action', () => {
    const before = snapshotTurn()
    turn().attack('Flail', 2, true)
    turn().countPerTurn('mastery:cleave')
    rememberTurn('g1', before)
    restoreTurnFor('g1')
    expect(turn().action).toBe(0)
    expect(turn().attackAction).toBeUndefined()
    expect(turn().perTurn).toEqual({})
  })
})
