// Engine features added for book content (milestone 11), tested with custom features.
import { describe, expect, it } from 'vitest'
import { performActivity, type ActionResult } from './actions'
import type { CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'

const c24 = srd('2024')
const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const withFeature = (feature: Record<string, unknown>, p: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition: '2024', classes: [{ classId: 'wizard', level: 5 }], speciesId: 'human', backgroundId: 'sage',
    baseScores: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 }, hp: { current: 20 },
    extras: [{ uid: 'x', custom: { id: 'test-feature', edition: '2024', type: 'feature', name: 'Test', source: { book: 'homebrew' }, ...feature } as never }],
    ...p,
  })

describe('Book engine features', () => {
  it('attacks granted by a feature appear with the weapon attacks (always proficient)', () => {
    const c = withFeature({ attacks: [{ id: 'claws', name: 'Claws', damage: { dice: '1d6', type: 'slashing' }, properties: ['finesse'] }] })
    const claws = computeSheet(c, c24).attacks.find((a) => a.name === 'Claws')!
    expect(claws).toMatchObject({ damageDice: '1d6', damageType: 'slashing', ability: 'dex' })
    expect(claws.attack.value).toBe(2 + 3)
  })

  it('a granted attack can depend on a state', () => {
    const c = withFeature({ attacks: [{ id: 'blade', name: 'Pact Blade', damage: { dice: '1d8', type: 'force' }, while: 'Blade out' }] })
    expect(computeSheet(c, c24).attacks.some((a) => a.name === 'Pact Blade')).toBe(false)
    expect(computeSheet({ ...c, toggles: ['state:Blade out'] }, c24).attacks.some((a) => a.name === 'Pact Blade')).toBe(true)
  })

  it('dice pools: spend N dice, heal their rolled total', () => {
    const c = withFeature({
      resources: [{ id: 'light-dice', name: 'Light dice', max: 5, recharge: [{ on: 'longRest', amount: 'all' }] }],
      activities: [{ id: 'heal', name: 'Heal', actionType: 'bonusAction', cost: [{ resource: 'light-dice' }], spendInput: true, spendDice: 6, roll: { kind: 'heal' } }],
    }, { hp: { current: 5 } })
    const s = computeSheet(c, c24)
    const row = s.activities.find((a) => a.activity.id === 'heal')!
    const after = okR(performActivity(c, s, row, 11, { spent: 3 }))
    expect(after.hp.current).toBe(16)
    expect(computeSheet(after, c24).resources.find((r) => r.key === 'light-dice')?.remaining).toBe(2)
  })

  it('slot cost: minimum level and refilling a pool per slot level', () => {
    const c = withFeature({
      resources: [{ id: 'ward', name: 'Ward', max: 20, recharge: [{ on: 'longRest', amount: 'all' }] }],
      activities: [{ id: 'charge', name: 'Charge', actionType: 'other', slotCost: true, slotMin: 2, restorePerSlotLevel: { resource: 'ward', amount: 2 } }],
    }, { resourcesUsed: { ward: 15 } })
    const s = computeSheet(c, c24)
    const row = s.activities.find((a) => a.activity.id === 'charge')!
    expect(performActivity(c, s, row, undefined, { slotKey: 'slot:1' }).ok).toBe(false)
    const after = okR(performActivity(c, s, row, undefined, { slotKey: 'slot:3' }))
    expect(computeSheet(after, c24).resources.find((r) => r.key === 'ward')?.remaining).toBe(11)
  })

  it('senses add, other speeds, immunities, unarmed die with empty hands', () => {
    const c = withFeature({
      effects: [
        { target: 'sense:darkvision', op: 'add', value: 60 },
        { target: 'speed:fly', value: 'walk' },
        { target: 'conditionImmunity:charmed', value: 1 },
        { target: 'unarmedDamage', op: 'max', value: 8, when: 'emptyHands' },
      ],
    })
    const s = computeSheet(c, c24)
    expect(s.senses.darkvision).toBe(60)
    expect(s.speeds.fly).toBe(30)
    expect(s.conditionImmunities).toEqual(['charmed'])
    expect(s.attacks.find((a) => a.key === 'unarmed')?.damageDice).toBe('1d8')
  })
})

describe('Choice-driven effects and formulas', () => {
  it('"@choice" in an effect target expands to the picked values; activities may use hpMax', () => {
    const c = withFeature(
      {
        choices: [{ id: 'types', label: 'Types', kind: 'option', count: 2, options: ['fire', 'cold', 'acid'] }],
        effects: [{ target: 'resistance:@types', value: 1 }],
        activities: [{ id: 'stand', name: 'Last Stand', actionType: 'other', roll: { bonus: 'floor(hpMax / 2)', kind: 'heal' } }],
      },
      { choices: { 'extra:x/types': ['fire', 'cold'] } },
    )
    const s = computeSheet(c, c24)
    expect(s.resistances.sort()).toEqual(['cold', 'fire'])
    expect(s.activities.find((a) => a.activity.id === 'stand')?.rollBonus).toBe(Math.floor(s.hpMax.value / 2))
  })
})

describe('Granted attack scaling', () => {
  it('dice by class level and flat bonuses', () => {
    const c = withFeature({ attacks: [{ id: 'gauntlet', name: 'Gauntlet', damage: { dice: '1d6', type: 'force' }, diceByLevel: { 5: '1d8' }, attackBonus: 1, damageBonus: 'int' }] })
    const g = computeSheet(c, c24).attacks.find((a) => a.name === 'Gauntlet')!
    expect(g.damageDice).toBe('1d8')
    expect(g.attack.value).toBe(0 + 3 + 1)
    expect(g.damageBonus).toBe(0 + 3)
  })
})

describe('Options added by books', () => {
  it('a feature with optionOf the choice owner joins that choice', async () => {
    const { ContentIndex } = await import('../content')
    const { Pack } = await import('../content/schema')
    const { srd: srdPack } = await import('./fixtures')
    void srdPack
    const base = (await import('../data/srd/2014.json')).default
    const pack = Pack.parse({ id: 'x', name: 'X', edition: '2014', book: 'x', entities: [{ id: 'x-blind-fighting', edition: '2014', type: 'feature', name: 'Blind Fighting', source: { book: 'x' }, optionOf: 'fighter-fighting-style' }] })
    const content = new ContentIndex('2014', [Pack.parse(base), pack])
    const c = makeCharacter({ edition: '2014', classes: [{ classId: 'fighter', level: 1 }], speciesId: 'human', backgroundId: 'acolyte', baseScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, hp: { current: 12 } })
    const s = computeSheet(c, content)
    const { allChoices, choiceOptions } = await import('./levelup')
    const style = allChoices(c, s).find((p) => p.ae.entity.id === 'fighter-fighting-style')!
    expect(choiceOptions(c, content, s, style.ae, style.choice).map((o) => o.id)).toContain('x-blind-fighting')
  })
})

describe('Attack ability', () => {
  it('attackAbility:int replaces Str/Dex for weapons while a toggle is on', () => {
    const c = withFeature(
      { effects: [{ target: 'attackAbility:int', value: 1, when: [{ toggle: 'Bladesong' }, 'meleeWeapon'] }] },
      { inventory: [{ uid: 'r', itemId: 'rapier', quantity: 1, equipped: true }] },
    )
    const off = computeSheet(c, c24).attacks.find((a) => a.key === 'r')!
    expect(off.ability).toBe('dex')
    const key = computeSheet(c, c24).toggles.find((t) => t.label === 'Bladesong')!.key
    const on = computeSheet({ ...c, toggles: [key] }, c24).attacks.find((a) => a.key === 'r')!
    expect(on.ability).toBe('int')
  })
})
