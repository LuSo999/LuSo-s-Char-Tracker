import { describe, expect, it } from 'vitest'
import { takeDamage, toggleCondition, type ActionResult } from './actions'
import type { CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd, valdric } from './fixtures'
import { longRest, shortRest } from './rest'
import { castOptions, castSpell, endConcentration, setClassSpell } from './spellActions'
import { spellDice } from './spells'

const c24 = srd('2024')
const c14 = srd('2014')
function okR(r: ActionResult) {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const wizard = (edition: '2014' | '2024', level: number, extra: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition,
    classes: [{ classId: 'wizard', level }],
    speciesId: 'human',
    backgroundId: edition === '2024' ? 'sage' : 'acolyte',
    baseScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    ...extra,
  })

describe('slots and limits', () => {
  it('2024 Wizard 5: slots 4/3/2, 4 cantrips, 9 prepared, DC and attack from Int', () => {
    const sc = computeSheet(wizard('2024', 5), c24).spellcasting
    expect(sc.slots.map((s) => s.max)).toEqual([4, 3, 2])
    expect(sc.casters[0]).toMatchObject({ cantripsMax: 4, spellsMax: 9, dc: 8 + 3 + 3, attack: 3 + 3, maxSpellLevel: 3 })
  })

  it('2014 Wizard prepares Int modifier + level (minimum 1)', () => {
    expect(computeSheet(wizard('2014', 5), c14).spellcasting.casters[0].spellsMax).toBe(3 + 5) // human 2014: Int 16 + 1 = 17 (+3)
  })

  it('Warlock Pact Magic: one slot level, back on a Short Rest', () => {
    const c = makeCharacter({ edition: '2024', classes: [{ classId: 'warlock', level: 5 }], resourcesUsed: { pact: 2 } })
    const s = computeSheet(c, c24)
    expect(s.spellcasting.pact).toMatchObject({ level: 3, max: 2 })
    expect(s.spellcasting.slots).toEqual([])
    expect(shortRest(c, c24).character.resourcesUsed.pact).toBe(0)
  })

  it('multiclass slots: half Paladin levels round down in 2014, up in 2024', () => {
    const mc = (edition: '2014' | '2024', content = edition === '2014' ? c14 : c24) =>
      computeSheet(
        makeCharacter({ edition, classes: [{ classId: 'paladin', level: 5 }, { classId: 'wizard', level: 1 }], baseScores: { str: 13, dex: 10, con: 10, int: 13, wis: 10, cha: 13 } }),
        content,
      ).spellcasting.slots.map((s) => s.max)
    expect(mc('2014')).toEqual([4, 2]) // 1 + floor(5/2) = 3
    expect(mc('2024')).toEqual([4, 3]) // 1 + ceil(5/2) = 4
  })

  it('a long rest restores the slots', () => {
    const c = wizard('2024', 5, { resourcesUsed: { 'slot:1': 4, 'slot:3': 1 } })
    expect(longRest(c, c24).character.resourcesUsed).toMatchObject({ 'slot:1': 0, 'slot:3': 0 })
  })
})

describe('Magic Initiate (Valdric)', () => {
  const v = valdric({
    choices: {
      ...valdric().choices,
      'sage/feat/cantrips': ['mage-hand', 'prestidigitation'],
      'sage/feat/spell': ['find-familiar'],
      'sage/feat/ability': ['int'],
    },
  })
  const s = computeSheet(v, c24)
  const ff = s.spellcasting.rows.find((r) => r.spell.id === 'find-familiar')!

  it('grants the chosen spells, always prepared, Wizard list from the Sage preset, DC from Int', () => {
    expect(s.spellcasting.rows.map((r) => r.spell.id).sort()).toEqual(['find-familiar', 'mage-hand', 'prestidigitation'])
    expect(ff).toMatchObject({ always: true, ability: 'int', dc: 8 + 2 + 1, freeCast: 'magic-initiate' })
  })

  it('Find Familiar: once for free per long rest, or as a ritual without a slot', () => {
    expect(castOptions(ff, s).map((o) => o.kind)).toEqual(['free', 'ritual'])
    const after = okR(castSpell(v, s, ff, { kind: 'free' }))
    expect(after.resourcesUsed['magic-initiate']).toBe(1)
    const s2 = computeSheet(after, c24)
    expect(castOptions(s2.spellcasting.rows.find((r) => r.spell.id === 'find-familiar')!, s2).map((o) => o.kind)).toEqual(['ritual'])
  })
})

describe('casting and concentration', () => {
  const base = wizard('2024', 5, { hp: { current: 30 }, spells: { wizard: { known: ['fire-bolt', 'magic-missile', 'hold-person', 'detect-magic'], prepared: ['magic-missile', 'hold-person'] } } })
  const s = computeSheet(base, c24)
  const row = (id: string) => s.spellcasting.rows.find((r) => r.spell.id === id)!

  it('upcasting uses the chosen slot; spellbook rituals castable unprepared', () => {
    expect(castOptions(row('magic-missile'), s).map((o) => (o.kind === 'slot' ? o.level : o.kind))).toEqual([1, 2, 3])
    expect(okR(castSpell(base, s, row('magic-missile'), { kind: 'slot', level: 3 })).resourcesUsed['slot:3']).toBe(1)
    expect(row('detect-magic')).toMatchObject({ castable: false, ritualOnly: true })
    expect(castOptions(row('detect-magic'), s)).toEqual([{ kind: 'ritual' }])
  })

  it('concentration: starts, damage asks for a save, Incapacitated ends it', () => {
    const c = okR(castSpell(base, s, row('hold-person'), { kind: 'slot', level: 2 }))
    expect(c.concentration).toEqual({ spellId: 'hold-person', name: 'Hold Person' })
    const hit = takeDamage(c, computeSheet(c, c24), 25)
    expect(hit.ok && hit.items.find((i) => i.type === 'concentrationCheck')?.params?.dc).toBe(12)
    expect(okR(toggleCondition(c, 'stunned', 'Stunned')).concentration).toBeUndefined()
    expect(okR(endConcentration(c)).concentration).toBeUndefined()
  })

  it('damage and healing dice scale with the slot / character level', () => {
    expect(spellDice(c24.getTyped('fireball', 'spell')!, 5, 9, 3).damage).toBe('10d6 fire')
    expect(spellDice(c24.getTyped('fire-bolt', 'spell')!, 0, 11, 3).damage).toBe('3d10 fire')
    expect(spellDice(c24.getTyped('cure-wounds', 'spell')!, 2, 3, 3).heal).toBe('4d8+3')
  })

  it('class limits: prepared count and spell level', () => {
    const full = wizard('2024', 1, { spells: { wizard: { known: ['magic-missile', 'spell-shield', 'sleep', 'mage-armor', 'burning-hands'], prepared: ['magic-missile', 'spell-shield', 'sleep', 'mage-armor'] } } })
    const sf = computeSheet(full, c24)
    expect(setClassSpell(full, sf, c24, 'wizard', 'prepared', 'burning-hands', true)).toMatchObject({ ok: false, error: 'limitSpells' })
    expect(setClassSpell(full, sf, c24, 'wizard', 'prepared', 'burning-hands', true, true).ok).toBe(true)
    expect(setClassSpell(full, sf, c24, 'wizard', 'known', 'fireball', true)).toMatchObject({ ok: false, error: 'spellTooHigh' })
  })
})

describe('concentration at 0 HP', () => {
  it('dropping to 0 HP ends concentration', () => {
    const c = wizard('2024', 5, { hp: { current: 5 }, concentration: { spellId: 'hold-person', name: 'Hold Person' } })
    expect(okR(takeDamage(c, computeSheet(c, c24), 10)).concentration).toBeUndefined()
  })
})

describe('content saved by an older app version', () => {
  it('a feature without the newer "spells" field does not break the sheet', async () => {
    const { ContentIndex } = await import('../content')
    const { readFileSync } = await import('node:fs')
    const { Pack } = await import('../content/schema')
    const srdPack = Pack.parse(JSON.parse(readFileSync(new URL('../data/srd/2024.json', import.meta.url), 'utf8')))
    const old = {
      id: 'old', name: 'Old pack', edition: '2024', version: '1', book: 'x',
      entities: [{ id: 'old-feature', edition: '2024', type: 'feature', name: 'Old', description: '', source: { book: 'x' }, verified: true, effects: [], resources: [], activities: [], choices: [], tags: [] }],
    } as unknown as import('../content/schema').Pack
    const content = new ContentIndex('2024', [srdPack, old])
    const c = valdric({ extras: [{ uid: 'o', entityId: 'old-feature' }] })
    expect(() => computeSheet(c, content)).not.toThrow()
  })
})
