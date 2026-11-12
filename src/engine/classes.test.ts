// Milestone 8 class mechanics: Barbarian, Monk, Rogue in both editions.
import { describe, expect, it } from 'vitest'
import { performActivity, toggleEffect, type ActionResult } from './actions'
import type { CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { longRest, shortRest } from './rest'

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

describe('Bard', () => {
  it('Bardic Inspiration: Cha uses, die grows, Short Rest recharge from level 5; Jack of All Trades', () => {
    for (const [edition, content] of [['2024', c24], ['2014', c14]] as const) {
      const bardAt = (level: number) => hero(edition, 'bard', level, { baseScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 }, resourcesUsed: { 'bardic-inspiration': 2 } })
      const c = bardAt(5)
      const s = computeSheet(c, content)
      const bi = s.activities.find((a) => a.activity.name === 'Bardic Inspiration')!
      expect(bi.uses?.max).toBe(3)
      expect(bi.rollDice).toBe('1d8')
      expect(shortRest(c, content).character.resourcesUsed['bardic-inspiration']).toBe(0)
      expect(shortRest(bardAt(4), content).character.resourcesUsed['bardic-inspiration']).toBe(2)
      expect(s.skills.arcana.value).toBe(0 + 1) // Int 10, half of PB 3
    }
  })
})

describe('Cleric', () => {
  it('2024 Channel Divinity 2 → 3 at level 6; Divine Spark dice; Life Domain spells', () => {
    const c = hero('2024', 'cleric', 7, { classes: [{ classId: 'cleric', level: 7, subclassId: 'life-domain' }] })
    const s = computeSheet(c, c24)
    expect(s.resources.find((r) => r.key.endsWith('channel-divinity'))?.max).toBe(3)
    expect(s.activities.find((a) => a.activity.name === 'Divine Spark')?.rollDice).toBe('2d8')
    expect(s.spellcasting.rows.filter((r) => r.always).map((r) => r.spell.id)).toEqual(expect.arrayContaining(['aid', 'mass-healing-word', 'death-ward']))
  })

  it('2014 Life Domain: heavy armor proficiency and 1st-level domain spells', () => {
    const s = computeSheet(hero('2014', 'cleric', 1, { classes: [{ classId: 'cleric', level: 1, subclassId: 'life' }] }), c14)
    expect(s.spellcasting.rows.filter((r) => r.always).map((r) => r.spell.id).sort()).toEqual(['bless', 'cure-wounds'])
  })
})

describe('Druid', () => {
  it('2024 Wild Shape: uses, Temp HP = Druid level, switches the Wild Shape state on', () => {
    const c = hero('2024', 'druid', 6)
    const s = computeSheet(c, c24)
    const ws = s.activities.find((a) => a.activity.name === 'Wild Shape')!
    expect(ws.uses?.max).toBe(3)
    const shaped = okR(performActivity(c, s, ws, 0))
    expect(shaped.hp.temp).toBe(6)
    expect(computeSheet(shaped, c24).toggles.find((t) => t.label === 'Wild Shape')?.on).toBe(true)
  })

  it('2024 Circle of the Land: the chosen land’s spells by level', () => {
    const c = hero('2024', 'druid', 5, { classes: [{ classId: 'druid', level: 5, subclassId: 'circle-of-the-land' }] })
    const land = computeSheet(c, c24).active.find((a) => a.entity.id === 'land-circle-of-the-land-spells')!
    const s = computeSheet({ ...c, choices: { [`${land.grantKey}/land`]: ['land-polar'] } }, c24)
    expect(s.spellcasting.rows.filter((r) => r.always).map((r) => r.spell.id).sort()).toEqual(['fog-cloud', 'hold-person', 'ray-of-frost', 'sleet-storm'])
  })
})

describe('Sorcerer', () => {
  it('Font of Magic: points → slot (vanishes on a Long Rest) and slot → points', async () => {
    const { fontOfMagic } = await import('./spellActions')
    const c = hero('2024', 'sorcerer', 5)
    const s = computeSheet(c, c24)
    const created = okR(fontOfMagic(c, s, 'sorcery-points', 'create', 2, 5))
    const s2 = computeSheet(created, c24)
    expect(s2.resources.find((r) => r.key === 'slot:2')?.remaining).toBe(4)
    expect(s2.resources.find((r) => r.key === 'sorcery-points')?.remaining).toBe(2)
    expect(fontOfMagic(c, s, 'sorcery-points', 'create', 4, 5)).toMatchObject({ ok: false })
    expect(longRest(created, c24).character.resourcesUsed['slot:2']).toBe(0)
    const spent = { ...c, resourcesUsed: { 'sorcery-points': 3 } }
    const converted = okR(fontOfMagic(spent, computeSheet(spent, c24), 'sorcery-points', 'convert', 3, 5))
    expect(computeSheet(converted, c24).resources.find((r) => r.key === 'sorcery-points')?.remaining).toBe(5)
  })

  it('2024 Innate Sorcery raises the spell save DC by 1 while active; Draconic Resilience AC and HP', () => {
    const c = hero('2024', 'sorcerer', 3, { classes: [{ classId: 'sorcerer', level: 3, subclassId: 'draconic-sorcery' }], baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 } })
    const s = computeSheet(c, c24)
    const innate = s.activities.find((a) => a.activity.name === 'Innate Sorcery')!
    const on = computeSheet(okR(performActivity(c, s, innate)), c24)
    expect(on.spellcasting.casters[0].dc - s.spellcasting.casters[0].dc).toBe(1)
    expect(s.ac.value).toBe(10 + 2 + 3)
  })
})

describe('Warlock', () => {
  it('2024 invocations: Armor of Shadows casts Mage Armor at will', async () => {
    const { castOptions } = await import('./spellActions')
    const c = hero('2024', 'warlock', 2)
    const inv = computeSheet(c, c24).active.find((a) => a.entity.id === 'warlock-eldritch-invocations')!
    const s = computeSheet({ ...c, choices: { [`${inv.grantKey}/invocations`]: ['invocation-armor-of-shadows'] } }, c24)
    const row = s.spellcasting.rows.find((r) => r.spell.id === 'mage-armor')!
    expect(row.atWill).toBe(true)
    expect(castOptions(row, s).map((o) => o.kind)).toContain('free')
  })

  it("Dark One's Blessing gives Temp HP without a roll", () => {
    const c = hero('2024', 'warlock', 3, { classes: [{ classId: 'warlock', level: 3, subclassId: 'fiend-patron' }], baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 } })
    const s = computeSheet(c, c24)
    const blessing = s.activities.find((a) => a.activity.name === "Dark One's Blessing")!
    expect(okR(performActivity(c, s, blessing, 0)).hp.temp).toBe(3 + 3)
  })
})
