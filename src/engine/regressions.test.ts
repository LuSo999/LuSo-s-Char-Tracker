// Regression tests for rules bugs found in the full review (one test per bug).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ContentIndex } from '../content'
import { Pack } from '../content/schema'
import { adjustXp, heal, setHitDiceRemaining, setHp, takeDamage, toggleEffect, type ActionResult } from './actions'
import { Character, type CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { longRest } from './rest'
import { startShape } from './shape'
import { fontOfMagic } from './spellActions'

const c24 = srd('2024')
const c14 = srd('2014')
const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const hero = (edition: '2014' | '2024', classes: CharacterInput['classes'], extra: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition,
    classes,
    speciesId: 'human',
    backgroundId: edition === '2024' ? 'soldier' : 'acolyte',
    baseScores: { str: 14, dex: 14, con: 14, int: 8, wis: 18, cha: 10 },
    hp: { current: 10 },
    ...extra,
  })

describe('Review fixes', () => {
  it('a slot created with Font of Magic keeps the character valid (saved and loaded again)', () => {
    const c = hero('2024', [{ classId: 'sorcerer', level: 3 }])
    const s = computeSheet(c, c24)
    const points = s.resources.find((r) => r.resource.id === 'sorcery-points')!
    const made = okR(fontOfMagic(c, s, points.key, 'create', 1, 3))
    expect(made.resourcesUsed['slot:1']).toBeLessThan(0)
    expect(Character.safeParse(JSON.parse(JSON.stringify(made))).success).toBe(true)
  })

  it('2014 long rest: half of all Hit Dice together, largest first', () => {
    const c = hero('2014', [{ classId: 'fighter', level: 3 }, { classId: 'rogue', level: 3 }], { hitDiceUsed: { '10': 3, '8': 3 } })
    const after = longRest(c, c14).character
    const back = 6 - Object.values(after.hitDiceUsed).reduce((a, b) => a + b, 0)
    expect(back).toBe(3)
    expect(after.hitDiceUsed['10']).toBe(0)
  })

  it('subclass spells of a second class use that class’s spellcasting ability', () => {
    const c = hero('2014', [{ classId: 'wizard', level: 1 }, { classId: 'cleric', level: 1, subclassId: 'life' }])
    const s = computeSheet(c, c14)
    const bless = s.spellcasting.rows.find((r) => r.spell.id === 'bless' && r.grantedBy)!
    expect(bless.ability).toBe('wis')
    expect(bless.dc).toBe(8 + 2 + 4)
  })

  it('2024 Barbarian Extra Attack gives two attacks', () => {
    expect(computeSheet(hero('2024', [{ classId: 'barbarian', level: 5 }]), c24).attacks[0].attacksPerAction).toBe(2)
  })

  it('a stable character who takes damage is dying again', () => {
    const c = hero('2024', [{ classId: 'fighter', level: 1 }], { hp: { current: 0 }, deathSaves: { successes: 3, failures: 0 } })
    const hit = okR(takeDamage(c, computeSheet(c, c24), 2))
    expect(hit.deathSaves).toEqual({ successes: 0, failures: 1 })
  })

  it('healing never lowers HP that is above a lowered maximum', () => {
    const c = hero('2014', [{ classId: 'fighter', level: 5 }], { hp: { current: 49 }, exhaustion: 4 })
    const r = heal(c, computeSheet(c, c14), 3)
    expect(r.ok ? r.character.hp.current : c.hp.current).toBeGreaterThanOrEqual(49)
  })

  it('Martial Arts doesn’t work in armor', () => {
    const c = hero('2014', [{ classId: 'monk', level: 5 }], { inventory: [{ uid: 'a', itemId: 'chain-mail', quantity: 1, equipped: true }] })
    const unarmed = computeSheet(c, c14).attacks.find((a) => !a.weapon)!
    expect(unarmed.ability).toBe('str')
  })

  it('2024 exhaustion lowers spell attack rolls', () => {
    const fresh = computeSheet(hero('2024', [{ classId: 'wizard', level: 1 }]), c24).spellcasting.casters[0].attack
    const tired = computeSheet(hero('2024', [{ classId: 'wizard', level: 1 }], { exhaustion: 2 }), c24).spellcasting.casters[0].attack
    expect(fresh - tired).toBe(4)
  })

  it('dropping to 0 HP ends Wild Shape and Rage', () => {
    const c = okR(startShape(hero('2024', [{ classId: 'druid', level: 2 }], { hp: { current: 5 } }), c24, 'creature-wolf'))
    const down = okR(takeDamage(c, computeSheet(c, c24), 10))
    expect(down.shape).toBeUndefined()
    expect(down.toggles).not.toContain('state:Wild Shape')
  })

  it('setting HP above 0 resets death saves', () => {
    const c = hero('2024', [{ classId: 'fighter', level: 1 }], { hp: { current: 0 }, deathSaves: { successes: 1, failures: 2 } })
    expect(okR(setHp(c, computeSheet(c, c24), 5)).deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('2024 weapon prices and dawn recharges come out right', () => {
    expect(c24.getTyped('javelin', 'item')?.cost).toEqual({ amount: 5, unit: 'sp' })
    expect(c24.getTyped('longbow', 'item')?.cost).toEqual({ amount: 50, unit: 'gp' })
    expect(c14.getTyped('helm-of-teleportation', 'item')?.charges?.recharge[0]).toMatchObject({ on: 'dawn', dice: '1d3' })
  })

  it('darts (finesse) use Strength when it is higher', () => {
    const c = hero('2024', [{ classId: 'fighter', level: 1 }], { baseScores: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 10 }, inventory: [{ uid: 'd', itemId: 'dart', quantity: 5, equipped: true }] })
    expect(computeSheet(c, c24).attacks.find((a) => a.weapon?.id === 'dart')?.ability).toBe('str')
  })

  it('switching the Wild Shape state off drops the beast form', () => {
    const c = okR(startShape(hero('2024', [{ classId: 'druid', level: 2 }]), c24, 'creature-wolf'))
    const off = okR(toggleEffect(c, 'state:Wild Shape', 'Wild Shape', computeSheet(c, c24)))
    expect(off.shape).toBeUndefined()
  })

  it('Cleric and Paladin: the larger Channel Divinity pool counts', () => {
    const c = hero('2024', [{ classId: 'paladin', level: 3 }, { classId: 'cleric', level: 6 }])
    const cd = computeSheet(c, c24).resources.filter((r) => r.resource.id === 'channel-divinity')
    expect(cd).toHaveLength(1)
    expect(cd[0].max).toBe(3)
  })

  it('XP: adjust up and down, never below 0', () => {
    const c = hero('2024', [{ classId: 'fighter', level: 1 }])
    const up = okR(adjustXp(c, 300))
    expect(up.xp).toBe(300)
    expect(adjustXp(up, -400)).toMatchObject({ ok: false, error: 'notEnoughXp' })
  })

  it('Hit Dice left can be set from the resources panel', () => {
    const c = hero('2024', [{ classId: 'fighter', level: 3 }])
    const after = okR(setHitDiceRemaining(c, computeSheet(c, c24), 10, 1))
    expect(after.hitDiceUsed['10']).toBe(2)
  })

  it('a homebrew weapon property with a note shows on the attack', () => {
    const srdPack = Pack.parse(JSON.parse(readFileSync('src/data/srd/2024.json', 'utf8')))
    const blaster = { ...c24.getTyped('longbow', 'item')!, id: 'blaster', name: 'Blaster', propertyNotes: { misfire: 'on a 1 it jams' } }
    const content = new ContentIndex('2024', [srdPack, Pack.parse({ id: 'hb', name: 'HB', edition: '2024', book: 'homebrew:hb', entities: [blaster] })])
    const sheet = computeSheet(hero('2024', [{ classId: 'fighter', level: 1 }], { books: ['homebrew:hb'], inventory: [{ uid: 'b', itemId: 'blaster', quantity: 1, equipped: true }] }), content)
    expect(sheet.attacks.find((a) => a.weapon?.id === 'blaster')?.notes).toContain('Misfire: on a 1 it jams')
  })

  it('edit mode can override spell DC / attack, slot counts, Hit Dice and attunement slots', () => {
    const c = hero('2024', [{ classId: 'wizard', level: 3 }], { overrides: { 'spellDc:wizard': 17, 'spellAttack:wizard': 9, 'resource:slot:2:max': 5, 'hitDice:6': 7, attunementSlots: 4 } })
    const s = computeSheet(c, c24)
    expect(s.spellcasting.casters[0]).toMatchObject({ dc: 17, attack: 9 })
    expect(s.spellcasting.casters[0].dcValue.overridden).toBe(true)
    expect(s.resources.find((r) => r.key === 'slot:2')?.max).toBe(5)
    expect(s.hitDice[0]).toMatchObject({ die: 6, total: 7 })
    expect(s.attunementSlots).toBe(4)
  })
})
