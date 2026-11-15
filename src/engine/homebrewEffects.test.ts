// Homebrew mechanics beyond the character's own numbers: effects on the character's creatures,
// auras for allies, conditions with effects.
import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import type { CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srdWith } from './fixtures'
import { addCompanion } from './shape'

const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const base = { edition: '2024', source: { book: 'homebrew:hb-test' }, description: '' } as const
const bond = {
  ...base,
  id: 'hb-bond',
  type: 'feat',
  name: 'Draconic Bond',
  choices: [{ id: 'types', label: 'Element', kind: 'option', options: ['fire', 'cold'] }],
  effects: [
    { target: 'companion@summon:ac', op: 'add', value: 2 },
    { target: 'companion:attack', op: 'add', value: 'pb' },
    { target: 'companion:hp', op: 'add', value: 'level' },
    { target: 'companion@familiar:ac', op: 'add', value: 5 },
    { target: 'companion@summon:resistance:@types' },
    { target: 'companion:save:all', op: 'add', value: 1, when: { toggle: 'Bond' } },
    { target: 'companion:note', note: 'Shares your senses' },
  ],
}
const aura = { ...base, id: 'hb-aura', type: 'feat', name: 'Aura of Valor', effects: [{ target: 'ally:save:all', op: 'add', value: 'max(1, cha)', range: 10, note: 'within 10 ft' }] }
const cursed = { ...base, id: 'hb-cursed', type: 'condition', name: 'Cursed', effects: [{ target: 'save:all', op: 'add', value: -2 }, { target: 'note', note: 'Cursed: −2 to saves' }] }
const content = srdWith('2024', [bond, aura, cursed])

const sorcerer = (extra: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition: '2024',
    classes: [{ classId: 'sorcerer', level: 9 }],
    speciesId: 'human',
    backgroundId: 'soldier',
    baseScores: { str: 10, dex: 14, con: 14, int: 8, wis: 10, cha: 18 },
    hp: { current: 40 },
    spells: { sorcerer: { known: ['summon-dragon'], prepared: ['summon-dragon'] } },
    ...extra,
  })

function withSpirit(c: ReturnType<typeof sorcerer>) {
  const s = computeSheet(c, content)
  const src = s.companionSources.find((x) => x.grant.id === 'dragon')!
  return okR(addCompanion(c, s, content, src, 'creature-draconic-spirit', 5, 'cold'))
}

describe('effects on your creatures', () => {
  const plain = computeSheet(withSpirit(sorcerer()), content).companions[0]
  const bonded = sorcerer({ extras: [{ uid: 'e1', entityId: 'hb-bond' }], choices: { 'extra:e1/types': ['fire'] } })

  it('change the stat block: AC, attacks, HP, resistances, notes', () => {
    const c = withSpirit(bonded)
    const spirit = computeSheet(c, content).companions[0]
    expect(spirit.ac).toBe(plain.ac + 2)
    expect(spirit.parts.ac.map((p) => p.label)).toContain('Draconic Bond')
    const bite = (v: typeof spirit) => v.actions.find((a) => a.attack)!.attack!.bonus
    expect(bite(spirit)).toBe(bite(plain) + 4)
    expect(spirit.hpMax).toBe(plain.hpMax + 9)
    expect(spirit.resistances).toContain('fire')
    expect(spirit.notes).toEqual([{ note: 'Shares your senses', source: 'Draconic Bond' }])
    // A new creature arrives at its full (raised) maximum.
    expect(c.companions[0].hp).toBe(spirit.hpMax)
  })

  it('filters by kind and respects toggles; notes stay off the reminders strip', () => {
    const s = computeSheet(withSpirit(bonded), content)
    expect(s.companions[0].ac).toBe(plain.ac + 2) // the +5 for familiars doesn't apply
    expect(s.reminders.some((r) => r.note === 'Shares your senses')).toBe(false)
    const on = computeSheet({ ...withSpirit(bonded), toggles: ['extra:e1#Bond'] }, content)
    const str = (v: typeof plain) => v.saves.str ?? v.mods.str
    expect(str(on.companions[0])).toBe(str(s.companions[0]) + 1)
  })
})

describe('effects for allies', () => {
  it('are computed with the owner numbers and listed apart from reminders', () => {
    const s = computeSheet(sorcerer({ extras: [{ uid: 'a', entityId: 'hb-aura' }] }), content)
    expect(s.allyEffects).toHaveLength(1)
    expect(s.allyEffects[0].value).toBe(4)
    expect(s.allyEffects[0].effect.range).toBe(10)
    expect(s.reminders.some((r) => r.note === 'within 10 ft')).toBe(false)
    expect(s.saves.wis.value).toBe(computeSheet(sorcerer(), content).saves.wis.value)
  })
})

describe('conditions with effects', () => {
  it('apply while the character has the condition', () => {
    const before = computeSheet(sorcerer(), content)
    const after = computeSheet(sorcerer({ conditions: ['hb-cursed'] }), content)
    expect(after.saves.dex.value).toBe(before.saves.dex.value - 2)
    expect(after.reminders.map((r) => r.note)).toContain('Cursed: −2 to saves')
  })
})

describe('Paladin auras (SRD)', () => {
  const paladin = (level: number) =>
    makeCharacter({ edition: '2024', classes: [{ classId: 'paladin', level }], speciesId: 'human', backgroundId: 'soldier', baseScores: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 }, hp: { current: 50 } })
  it('give allies the same bonus, 10 ft and 30 ft from level 18', () => {
    const s6 = computeSheet(paladin(6), content)
    expect(s6.allyEffects.map((a) => [a.effect.target, a.value, a.range])).toEqual([['ally:save:all', 3, 10]])
    const s18 = computeSheet(paladin(18), content)
    expect(s18.allyEffects.map((a) => a.effect.target).sort()).toEqual(['ally:conditionImmunity:frightened', 'ally:save:all'])
    expect(s18.allyEffects.every((a) => a.range === 30)).toBe(true)
    expect(s18.conditionImmunities).toContain('frightened')
  })
})
