// Random tables on activities: roll, pick the outcome, apply it.
import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import { performActivity } from './actions'
import { computeSheet } from './derive'
import { makeCharacter, srdWith } from './fixtures'
import { longRest } from './rest'
import { diceRange, rollDice, rollTable, tableOutcome, tableProblems } from './shape'

const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const wild = {
  id: 'hb-wild-blood',
  edition: '2024',
  type: 'feature',
  name: 'Wild Blood',
  description: '',
  source: { book: 'homebrew:hb-test' },
  resources: [{ id: 'wild-blood', name: 'Wild Blood', max: 1, recharge: [{ on: 'longRest', amount: 'all' }] }],
  activities: [
    {
      id: 'surge',
      name: 'Wild Blood',
      actionType: 'action',
      cost: [{ resource: 'wild-blood' }],
      table: {
        dice: '1d20',
        noOwnAbilities: true,
        rows: [
          { min: 1, max: 10, text: 'Brown Bear for 1 minute', creature: 'creature-brown-bear' },
          { min: 11, max: 19, text: 'Iron skin', effects: [{ target: 'ac', op: 'add', value: 2 }] },
          { min: 20, max: 20, text: 'You glow purple' },
        ],
      },
    },
  ],
}
const content = srdWith('2024', [wild])
const hero = makeCharacter({ edition: '2024', classes: [{ classId: 'fighter', level: 5 }], speciesId: 'human', backgroundId: 'soldier', extras: [{ uid: 'w', entityId: 'hb-wild-blood' }], inventory: [{ uid: 's', itemId: 'longsword', quantity: 1, equipped: true }] })

function use(total: number) {
  const s = computeSheet(hero, content)
  const row = s.activities.find((a) => a.activity.name === 'Wild Blood')!
  const paid = okR(performActivity(hero, s, row))
  return okR(rollTable(paid, content, row.activity, total))
}

describe('random tables', () => {
  it('dice helpers', () => {
    expect(diceRange('2d6')).toEqual({ min: 2, max: 12 })
    expect(rollDice('1d100', () => 0.999)).toBe(100)
    expect(rollDice('3d6', () => 0)).toBe(3)
    expect(tableProblems('1d20', [{ min: 1, max: 10 }, { min: 9, max: 18 }])).toEqual({ gaps: [19, 20], overlaps: [9, 10] })
  })

  it('a creature outcome: Wild Shape-style form, own actions and attacks gone, the use spent once', () => {
    const c = use(4)
    expect(c.shape).toMatchObject({ creatureId: 'creature-brown-bear', noOwnAbilities: true })
    const s = computeSheet(c, content)
    expect(s.shape?.creature.name).toBe('Brown Bear')
    expect(s.attacks).toHaveLength(0)
    expect(s.activities).toHaveLength(0)
    expect(s.resources.find((r) => r.key === 'wild-blood')?.remaining).toBe(0)
    // A rest (or ending Wild Shape) brings the character back.
    expect(longRest(c, content).character.shape).toBeUndefined()
  })

  it('an outcome with effects switches on its state until a rest', () => {
    const before = computeSheet(hero, content).ac.value
    const c = use(15)
    const s = computeSheet(c, content)
    expect(s.ac.value).toBe(before + 2)
    expect(s.toggles.find((t) => t.label === 'Wild Blood: Iron skin')).toMatchObject({ on: true, state: true })
    expect(computeSheet(longRest(c, content).character, content).ac.value).toBe(before)
  })

  it('a text outcome goes to the reminders; a total outside the table changes nothing else', () => {
    expect(use(20).reminders.map((r) => r.text)).toEqual(['Wild Blood: You glow purple (1d20 = 20)'])
    expect(tableOutcome(wild.activities[0].table as never, 0)).toBeUndefined()
  })
})
