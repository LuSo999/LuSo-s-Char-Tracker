// Milestone 8 class mechanics: Barbarian, Monk, Rogue in both editions.
import { describe, expect, it } from 'vitest'
import { performActivity, toggleEffect, type ActionResult } from './actions'
import type { CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { longRest } from './rest'

const c24 = srd('2024')
const c14 = srd('2014')
const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const hero = (edition: '2014' | '2024', classId: string, level: number, extra: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition,
    classes: [{ classId, level }],
    speciesId: 'human',
    backgroundId: edition === '2024' ? 'soldier' : 'acolyte',
    baseScores: { str: 16, dex: 14, con: 14, int: 8, wis: 14, cha: 10 },
    hp: { current: 40 },
    ...extra,
  })
const greataxe = { inventory: [{ uid: 'axe', itemId: 'greataxe', quantity: 1, equipped: true }] }

describe('Barbarian', () => {
  for (const [edition, content] of [['2024', c24], ['2014', c14]] as const) {
    it(`${edition}: Unarmored Defense, Fast Movement, Rage uses`, () => {
      const s = computeSheet(hero(edition, 'barbarian', 5), content)
      expect(s.ac.value).toBe(10 + 2 + 2)
      expect(s.speed.value).toBe(30 + 10)
      expect(s.resources.find((r) => r.key.endsWith('rage'))?.max).toBe(3)
    })

    it(`${edition}: Rage switches Raging on, adds Rage Damage to Strength attacks, rests end it`, () => {
      const c = hero(edition, 'barbarian', 9, greataxe)
      const s = computeSheet(c, content)
      const rage = s.activities.find((a) => a.activity.id === 'rage')!
      const raging = okR(performActivity(c, s, rage))
      const s2 = computeSheet(raging, content)
      expect(s2.toggles.find((t) => t.label === 'Raging')).toMatchObject({ on: true, state: true })
      const axe = (sh: typeof s) => sh.attacks.find((a) => a.key === 'axe')!.damage.value
      expect(axe(s2) - axe(s)).toBe(3)
      expect(s2.reminders.some((r) => r.note.startsWith('Raging'))).toBe(true)
      expect(s.reminders.some((r) => r.note.startsWith('Raging'))).toBe(false)
      expect(longRest(raging, content).character.toggles).toEqual([])
      // Switching it off by hand works too.
      const off = okR(toggleEffect(raging, s2.toggles.find((t) => t.label === 'Raging')!.key, 'Raging'))
      expect(computeSheet(off, content).toggles.find((t) => t.label === 'Raging')?.on).toBe(false)
    })
  }

  it('2024 Rage recharges one use on a Short Rest; 2014 only on a Long Rest', () => {
    const r24 = c24.require('barbarian-rage', 'feature').resources[0].recharge
    expect(r24.find((r) => r.on === 'shortRest')?.amount).toBe(1)
    expect(c14.require('rage', 'feature').resources[0].recharge.map((r) => r.on)).toEqual(['longRest'])
  })
})

describe('Monk', () => {
  it('2024: Martial Arts die and Dex on Unarmed Strikes, Unarmored Defense with Wis, Focus Points', () => {
    const s = computeSheet(hero('2024', 'monk', 5, { baseScores: { str: 10, dex: 16, con: 14, int: 8, wis: 14, cha: 10 } }), c24)
    const unarmed = s.attacks.find((a) => a.key === 'unarmed')!
    expect(unarmed.damageDice).toBe('1d8')
    expect(unarmed.ability).toBe('dex')
    expect(s.ac.value).toBe(10 + 3 + 2)
    expect(s.speed.value).toBe(30 + 10)
    expect(s.resources.find((r) => r.key.endsWith('focus'))?.max).toBe(5)
  })

  it('2014: d4 at level 1 → d6 at 5; shortsword counts as a monk weapon', () => {
    const c = hero('2014', 'monk', 5, { baseScores: { str: 10, dex: 16, con: 14, int: 8, wis: 14, cha: 10 }, inventory: [{ uid: 's', itemId: 'shortsword', quantity: 1, equipped: true }] })
    const s = computeSheet(c, c14)
    expect(s.attacks.find((a) => a.key === 'unarmed')!.damageDice).toBe('1d6')
    expect(s.attacks.find((a) => a.key === 's')!.ability).toBe('dex')
    expect(computeSheet(hero('2014', 'monk', 1), c14).attacks.find((a) => a.key === 'unarmed')!.damageDice).toBe('1d4')
  })
})

describe('Rogue', () => {
  it('Sneak Attack dice scale with level, once per turn', () => {
    for (const [edition, content] of [['2024', c24], ['2014', c14]] as const) {
      const sa = computeSheet(hero(edition, 'rogue', 7), content).activities.find((a) => a.activity.name === 'Sneak Attack')!
      expect(sa.rollDice).toBe('4d6')
      expect(sa.activity.perTurn).toBe(1)
    }
  })

  it('2024 Slippery Mind: Wis and Cha save proficiency; Thief Use Magic Device: 4 attunement slots', () => {
    const s = computeSheet(hero('2024', 'rogue', 15), c24)
    expect(s.saves.wis.proficient && s.saves.cha.proficient).toBe(true)
    const thief = computeSheet(hero('2024', 'rogue', 13, { classes: [{ classId: 'rogue', level: 13, subclassId: 'thief' }] }), c24)
    expect(thief.attunementSlots).toBe(4)
  })
})

describe('Paladin', () => {
  for (const [edition, content] of [['2024', c24], ['2014', c14]] as const) {
    it(`${edition}: Lay on Hands pool spends the entered points and heals that much`, () => {
      const c = hero(edition, 'paladin', 5, { hp: { current: 10 } })
      const s = computeSheet(c, content)
      const loh = s.activities.find((a) => a.activity.name === 'Lay on Hands')!
      expect(loh.uses?.remaining).toBe(25)
      const after = okR(performActivity(c, s, loh, 7))
      expect(after.hp.current).toBe(17)
      expect(computeSheet(after, content).resources.find((r) => r.key.endsWith('lay-on-hands'))?.remaining).toBe(18)
      const cure = okR(performActivity(c, s, loh, 5, { spendOnly: true }))
      expect(cure.hp.current).toBe(10)
    })

    it(`${edition}: Aura of Protection adds Charisma to every save; Devotion oath spells by level`, () => {
      const sub = edition === '2024' ? 'oath-of-devotion' : 'devotion'
      const base = { baseScores: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 } }
      const s5 = computeSheet(hero(edition, 'paladin', 5, { ...base, classes: [{ classId: 'paladin', level: 5, subclassId: sub }] }), content)
      const s6 = computeSheet(hero(edition, 'paladin', 6, { ...base, classes: [{ classId: 'paladin', level: 6, subclassId: sub }] }), content)
      expect(s6.saves.dex.value - s5.saves.dex.value).toBe(3)
      const always = s5.spellcasting.rows.filter((r) => r.always).map((r) => r.spell.id)
      expect(always).toContain('zone-of-truth')
      expect(always).not.toContain('beacon-of-hope')
    })
  }

  it('2014 Divine Smite spends a slot: 2d8, +1d8 per level, max 5d8', async () => {
    const { spellDice } = await import('./spells')
    const smite = c14.getTyped('divine-smite-slot', 'spell')!
    expect([1, 2, 4, 5].map((l) => spellDice(smite, l, 5, 0).damage)).toEqual(['2d8 radiant', '3d8 radiant', '5d8 radiant', '5d8 radiant'])
    const s = computeSheet(hero('2014', 'paladin', 5), c14)
    expect(s.spellcasting.rows.some((r) => r.spell.id === 'divine-smite-slot')).toBe(true)
  })

  it("2024 Paladin's Smite: Divine Smite always prepared with one free cast", () => {
    const s = computeSheet(hero('2024', 'paladin', 2), c24)
    expect(s.spellcasting.rows.find((r) => r.spell.id === 'divine-smite')).toMatchObject({ always: true, freeCast: 'paladins-smite' })
  })
})

describe('Ranger', () => {
  it("2024: Hunter's Mark free casts 2 → 3 at level 5; Tireless gives Temp HP", () => {
    const s = computeSheet(hero('2024', 'ranger', 5), c24)
    expect(s.resources.find((r) => r.key.endsWith('favored-enemy'))?.max).toBe(3)
    expect(s.spellcasting.rows.find((r) => r.spell.id === 'hunters-mark')?.freeCast).toBe('favored-enemy')
    const c = hero('2024', 'ranger', 10)
    const s10 = computeSheet(c, c24)
    const tireless = s10.activities.find((a) => a.activity.name === 'Tireless')!
    expect(okR(performActivity(c, s10, tireless, 6)).hp.temp).toBe(6 + 2)
  })

  it("2024 Hunter's Prey: the chosen option's activity shows up", () => {
    const c = hero('2024', 'ranger', 3, { classes: [{ classId: 'ranger', level: 3, subclassId: 'hunter' }], choices: {} })
    const s = computeSheet(c, c24)
    const prey = s.active.find((a) => a.entity.id === 'hunter-hunters-prey')!
    const chosen = computeSheet({ ...c, choices: { [`${prey.grantKey}/option`]: ['hunter-colossus-slayer'] } }, c24)
    expect(chosen.activities.some((a) => a.activity.name === 'Colossus Slayer')).toBe(true)
  })
})
