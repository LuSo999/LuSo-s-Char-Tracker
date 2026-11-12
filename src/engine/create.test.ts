// Milestone 10: character creation.
import { describe, expect, it } from 'vitest'
import { buildCharacter, gearComplete, gearInventory, pointsSpent, roll4d6, startingGear, validBackgroundBonuses, type Draft, type EquipmentSelection } from './create'
import { computeSheet } from './derive'
import { srd } from './fixtures'
import { allChoices, choiceOptions, pendingChoices, setChoiceValues } from './levelup'

const c24 = srd('2024')
const c14 = srd('2014')
const draft = (p: Partial<Draft>): Draft => ({
  edition: '2024', name: 'Test', classId: 'fighter', speciesId: 'human', backgroundId: 'soldier',
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, backgroundBonuses: { str: 2, con: 1 },
  choices: {}, spells: {}, inventory: [], gp: 0, notes: '', ...p,
})

describe('Ability scores', () => {
  it('point buy costs and 4d6 drop lowest', () => {
    expect(pointsSpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27)
    const seq = [0.99, 0.0, 0.5, 0.2] // 6, 1, 4, 2 → 12
    let i = 0
    expect(roll4d6(() => seq[i++])).toEqual({ dice: [6, 1, 4, 2], total: 12 })
  })

  it('2024 background increases: +2/+1 or +1/+1/+1 within its three abilities', () => {
    expect(validBackgroundBonuses(['str', 'dex', 'con'], { str: 2, con: 1 })).toBe(true)
    expect(validBackgroundBonuses(['str', 'dex', 'con'], { str: 1, dex: 1, con: 1 })).toBe(true)
    expect(validBackgroundBonuses(['str', 'dex', 'con'], { str: 2, wis: 1 })).toBe(false)
    expect(validBackgroundBonuses(['str', 'dex', 'con'], { str: 2, dex: 2 })).toBe(false)
  })
})

describe('New character', () => {
  it('starts at level 1 with full HP and the background bonuses', () => {
    const c = buildCharacter(c24, draft({}))
    const s = computeSheet(c, c24)
    expect(s.scores.str.value).toBe(17)
    expect(c.hp.current).toBe(s.hpMax.value)
    expect(s.hpMax.value).toBe(10 + 2)
  })

  it('2024 Human: Skillful, Versatile (origin feat) and two languages are choices', () => {
    const c = buildCharacter(c24, draft({}))
    const ids = pendingChoices(c, c24, computeSheet(c, c24)).flatMap((p) => (p.kind === 'choice' ? [`${p.ae.entity.id}/${p.choice.id}`] : []))
    expect(ids).toEqual(expect.arrayContaining(['skillful/skill', 'versatile/feat', 'core-languages/languages', 'fighter/skills', 'soldier/tool']))
    const s = computeSheet(c, c24)
    const lang = allChoices(c, s).find((p) => p.ae.entity.id === 'core-languages')!
    const withLang = setChoiceValues(c, c24, lang.ae, lang.choice, ['elvish', 'draconic'])
    expect(withLang.ok && computeSheet(withLang.character, c24).languages.sort()).toEqual(['common', 'draconic', 'elvish'])
    const feat = allChoices(c, s).find((p) => p.ae.entity.id === 'versatile')!
    expect(choiceOptions(c, c24, s, feat.ae, feat.choice).map((o) => o.id)).toContain('skilled')
  })

  it('2024 Sage: Magic Initiate offers Wizard spells only', () => {
    const c = buildCharacter(c24, draft({ classId: 'wizard', backgroundId: 'sage', backgroundBonuses: { int: 2, con: 1 } }))
    const s = computeSheet(c, c24)
    const mi = allChoices(c, s).find((p) => p.ae.entity.id === 'magic-initiate' && p.choice.id === 'cantrips')!
    const opts = choiceOptions(c, c24, s, mi.ae, mi.choice).map((o) => o.id)
    expect(opts).toContain('fire-bolt')
    expect(opts).not.toContain('eldritch-blast')
  })

  it('2024 Dragonborn: ancestry gives resistance and a Breath Weapon (PB uses, 1d10)', () => {
    const c = buildCharacter(c24, draft({ speciesId: 'dragonborn', subspeciesId: 'draconic-ancestor-red' }))
    const s = computeSheet(c, c24)
    expect(s.resistances).toEqual(['fire'])
    expect(s.senses.darkvision).toBe(60)
    const breath = s.activities.find((a) => a.activity.id === 'breath')!
    expect(breath).toMatchObject({ rollDice: '1d10', uses: { max: 2 } })
  })

  it('2014 Dwarf: combat training, a tool choice, poison resistance; Hill Dwarf toughness', () => {
    const c = buildCharacter(c14, draft({ edition: '2014', speciesId: 'dwarf', subspeciesId: 'hill-dwarf', backgroundId: 'acolyte', backgroundBonuses: {} }))
    const s = computeSheet(c, c14)
    expect(s.weaponProficiencies).toEqual(expect.arrayContaining(['battleaxe', 'warhammer']))
    expect(s.resistances).toContain('poison')
    expect(s.hpMax.value).toBe(10 + 2 + 1) // d10 + Con +2 (13 + Dwarf 2 = 15) + Dwarven Toughness
    const ids = pendingChoices(c, c14, s).flatMap((p) => (p.kind === 'choice' ? [`${p.ae.entity.id}/${p.choice.id}`] : []))
    expect(ids).toEqual(expect.arrayContaining(['tool-proficiency/tool', 'acolyte/languages']))
    expect(s.languages).toEqual(expect.arrayContaining(['common', 'dwarvish']))
  })

  it('2014 Dragonborn breath weapon follows the chosen ancestry', () => {
    let c = buildCharacter(c14, draft({ edition: '2014', speciesId: 'dragonborn', backgroundId: 'acolyte', backgroundBonuses: {} }))
    const p = allChoices(c, computeSheet(c, c14)).find((x) => x.ae.entity.id === 'draconic-ancestry')!
    const r = setChoiceValues(c, c14, p.ae, p.choice, ['draconic-ancestry-blue'])
    if (!r.ok) throw new Error(r.error)
    c = r.character
    const s = computeSheet(c, c14)
    expect(s.resistances).toEqual(['lightning'])
    expect(s.activities.find((a) => a.activity.id === 'breath')).toMatchObject({ rollDice: '2d6', uses: { max: 1 } })
  })
})

describe('Starting equipment', () => {
  it('2024 Fighter option A / C (gold) and background gear', () => {
    const fighter = c24.require('fighter', 'class')
    const a = startingGear(fighter, [{ option: 0, picks: [] }])
    expect(a.gp).toBe(4)
    expect(a.items.map((i) => i.id)).toContain('chain-mail')
    expect(startingGear(fighter, [{ option: 2, picks: [] }])).toEqual({ items: [], gp: 155 })
    const inv = gearInventory(c24, a)
    expect(inv.find((e) => e.itemId === 'chain-mail')?.equipped).toBe(true)
    expect(inv.find((e) => e.itemId === 'javelin')?.quantity).toBe(8)
  })

  it('2014 Fighter picks a martial weapon; the pick must be made', () => {
    const fighter = c14.require('fighter', 'class')
    const sel: EquipmentSelection = [{ option: 0, picks: [] }, { option: 0, picks: [] }, { option: 0, picks: [] }, { option: 0, picks: [] }]
    expect(gearComplete(fighter.startingEquipment, sel)).toBe(false)
    sel[1] = { option: 0, picks: [['longsword']] }
    expect(gearComplete(fighter.startingEquipment, sel)).toBe(true)
    expect(startingGear(fighter, sel).items.map((i) => i.id)).toEqual(expect.arrayContaining(['chain-mail', 'longsword', 'shield']))
  })

  it('every class and background has starting equipment with existing items', () => {
    for (const content of [c24, c14]) {
      for (const e of [...content.all('class'), ...content.all('background')]) {
        if (e.edition !== content.edition) continue
        expect(e.startingEquipment.length + e.startingItems.length + e.startingGold, e.id).toBeGreaterThan(0)
        for (const c of e.startingEquipment) for (const o of c.options) for (const it of o.items) expect(content.item(it.id), `${e.id}: ${it.id}`).toBeDefined()
      }
    }
  })
})
