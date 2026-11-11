import { describe, expect, it } from 'vitest'
import { makeCharacter, srd, valdric } from './fixtures'
import { longRest, shortRest } from './rest'

const content2024 = srd('2024')
const content2014 = srd('2014')

describe('short rest', () => {
  it('2024 Second Wind regains one use; Action Surge regains all', () => {
    const c = valdric({ resourcesUsed: { 'second-wind': 3, 'action-surge': 1, 'giant-ancestry': 2 } })
    const { character } = shortRest(c, content2024)
    expect(character.resourcesUsed).toEqual({ 'second-wind': 2, 'action-surge': 0, 'giant-ancestry': 2 })
  })

  it('2014 Second Wind regains its single use', () => {
    const c = makeCharacter({ edition: '2014', resourcesUsed: { 'second-wind': 1 } })
    expect(shortRest(c, content2014).character.resourcesUsed['second-wind']).toBe(0)
  })

  it('spends hit dice: roll + Con each, capped at max HP', () => {
    const c = valdric({ hp: { current: 20 } })
    const { character, changes } = shortRest(c, content2024, { 10: [3, 7] })
    expect(character.hp.current).toBe(20 + 3 + 4 + 7 + 4)
    expect(character.hitDiceUsed['10']).toBe(2)
    expect(changes).toContainEqual({ kind: 'hitDice', die: 10, before: 4, after: 2, total: 4 })
    expect(shortRest(valdric({ hp: { current: 40 } }), content2024, { 10: [10] }).character.hp.current).toBe(44)
  })
})

describe('long rest', () => {
  it('2024 restores all HP, all hit dice, removes temp HP and one exhaustion level', () => {
    const c = valdric({ hp: { current: 5, temp: 6 }, hitDiceUsed: { 10: 4 }, exhaustion: 2, resourcesUsed: { 'giant-ancestry': 2 } })
    const { character } = longRest(c, content2024)
    expect(character.hp).toEqual({ current: 44, temp: 0 })
    expect(character.hitDiceUsed['10']).toBe(0)
    expect(character.exhaustion).toBe(1)
    expect(character.resourcesUsed['giant-ancestry']).toBe(0)
  })

  it('2014 regains only half of the hit dice (minimum one)', () => {
    const c = makeCharacter({ edition: '2014', classes: [{ classId: 'fighter', level: 5 }], hitDiceUsed: { 10: 5 } })
    expect(longRest(c, content2014).character.hitDiceUsed['10']).toBe(3)
    const one = makeCharacter({ edition: '2014', hitDiceUsed: { 10: 1 } })
    expect(longRest(one, content2014).character.hitDiceUsed['10']).toBe(0)
  })

  it('2014: dropping from exhaustion 4 to 3 restores the full HP maximum', () => {
    const c = makeCharacter({ edition: '2014', classes: [{ classId: 'fighter', level: 4 }], exhaustion: 4, hp: { current: 10 } })
    const { character } = longRest(c, content2014)
    expect(character.exhaustion).toBe(3)
    expect(character.hp.current).toBe(10 + 3 * 6) // Con 10 (+0) human 2014 gets +1 → 11, still +0
  })
})
