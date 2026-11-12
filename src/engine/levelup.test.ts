// Milestone 9: level up, multiclassing, and choices the character still has to make.
import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import type { Character, CharacterInput } from './character'
import { choiceKey, computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { allChoices, choiceOptions, levelDown, levelUp, levelUpOptions, pendingChoices, setChoiceValues, setSubclass, spellbookSize } from './levelup'

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
    baseScores: { str: 16, dex: 14, con: 14, int: 8, wis: 14, cha: 13 },
    hp: { current: 10 },
    ...extra,
  })

describe('Level up', () => {
  it('adds a level, the HP gain (average or roll) and current HP', () => {
    const c = hero('2024', 'fighter', 1)
    const before = computeSheet(c, c24).hpMax.value
    const avg = okR(levelUp(c, c24, 'fighter', null))
    expect(avg.classes[0]).toMatchObject({ level: 2, hpRolls: [null] })
    expect(computeSheet(avg, c24).hpMax.value - before).toBe(6 + 2)
    expect(avg.hp.current).toBe(10 + 8)
    const rolled = okR(levelUp(c, c24, 'fighter', 3))
    expect(computeSheet(rolled, c24).hpMax.value - before).toBe(3 + 2)
  })

  it('lists the new features in history', () => {
    const r = levelUp(hero('2024', 'fighter', 1), c24, 'fighter', null)
    expect(r.ok && r.items.filter((i) => i.type === 'featureGained').map((i) => i.params?.name)).toContain('Action Surge')
  })

  it('multiclass: requirements of the new class and of the current one', () => {
    const c = hero('2024', 'fighter', 3)
    const opts = levelUpOptions(c, c24, computeSheet(c, c24))
    expect(opts.find((o) => o.cls.id === 'fighter')).toMatchObject({ isNew: false })
    expect(opts.find((o) => o.cls.id === 'wizard')?.blocked).toEqual(['Wizard: INT 13'])
    expect(opts.find((o) => o.cls.id === 'cleric')?.blocked).toBeUndefined()
    const off = { ...c, settings: { ...c.settings, multiclass: false } }
    expect(levelUpOptions(off, c24, computeSheet(off, c24)).map((o) => o.cls.id)).toEqual(['fighter'])
  })

  it('multiclass: a new class at level 1 with its own Hit Die and shared spell slots', () => {
    const c = okR(levelUp(hero('2024', 'paladin', 2), c24, 'cleric', null))
    expect(c.classes.map((e) => [e.classId, e.level])).toEqual([
      ['paladin', 2],
      ['cleric', 1],
    ])
    const s = computeSheet(c, c24)
    expect(s.hitDice.map((h) => [h.die, h.total])).toEqual([
      [10, 2],
      [8, 1],
    ])
    // Caster level: Paladin 2 (half, rounded up in 2024) + Cleric 1 = 2 → three 1st-level slots.
    expect(s.resources.find((r) => r.key === 'slot:1')?.max).toBe(3)
  })

  it('level down removes the newest level and its choices', () => {
    const up = okR(levelUp(hero('2024', 'rogue', 3), c24, 'rogue', null))
    const s = computeSheet(up, c24)
    const p = allChoices(up, s).find((x) => x.ae.entity.id === 'rogue-ability-score-improvement')!
    const withFeat = okR(setChoiceValues(up, c24, p.ae, p.choice, ['grappler']))
    expect(computeSheet(withFeat, c24).active.some((a) => a.entity.id === 'grappler')).toBe(true)
    const down = okR(levelDown(withFeat, c24))
    expect(down.classes[0].level).toBe(3)
    expect(down.levelOrder).toEqual(['rogue', 'rogue', 'rogue'])
    expect(Object.keys(down.choices).some((k) => k.includes('ability-score-improvement'))).toBe(false)
    expect(computeSheet(down, c24).active.some((a) => a.entity.id === 'grappler')).toBe(false)
  })

  it('level down of a 1st multiclass level removes the class', () => {
    const c = okR(levelUp(hero('2024', 'fighter', 3), c24, 'cleric', null))
    const down = okR(levelDown(c, c24))
    expect(down.classes.map((e) => e.classId)).toEqual(['fighter'])
    expect(down.hp.current).toBeLessThanOrEqual(computeSheet(down, c24).hpMax.value)
  })
})

describe('Pending choices', () => {
  it('a missing subclass, skills, expertise and spells are listed', () => {
    const c = hero('2024', 'rogue', 3)
    const pending = pendingChoices(c, c24, computeSheet(c, c24))
    expect(pending.some((p) => p.kind === 'subclass')).toBe(true)
    const labels = pending.flatMap((p) => (p.kind === 'choice' ? [`${p.ae.entity.id}/${p.choice.id}`] : []))
    expect(labels).toEqual(expect.arrayContaining(['rogue/skills', 'rogue-expertise/skills', 'rogue-weapon-mastery/weapons']))
    expect(labels).not.toContain('rogue/multiclass-skills')
  })

  it('expertise is offered only for proficient skills', () => {
    const c = hero('2024', 'rogue', 1, { choices: { 'rogue/skills': ['stealth', 'acrobatics', 'perception', 'insight'] } })
    const s = computeSheet(c, c24)
    const p = allChoices(c, s).find((x) => x.ae.entity.id === 'rogue-expertise')!
    const open = choiceOptions(c, c24, s, p.ae, p.choice).filter((o) => !o.blocked).map((o) => o.id)
    // Soldier: Athletics, Intimidation; Rogue: the four picked.
    expect(open.sort()).toEqual(['acrobatics', 'athletics', 'insight', 'intimidation', 'perception', 'stealth'])
  })

  it('2014: an ASI or a feat (alternative) completes the choice', () => {
    const c = hero('2014', 'fighter', 4)
    const s = computeSheet(c, c14)
    const asi = allChoices(c, s).find((x) => x.choice.id === 'asi')!
    expect(asi.alternative?.id).toBe('feat')
    const isOpen = (ch: Character) => pendingChoices(ch, c14, computeSheet(ch, c14)).some((p) => p.kind === 'choice' && p.choice.id === 'asi')
    expect(isOpen(c)).toBe(true)
    const feat = okR(setChoiceValues(c, c14, asi.ae, asi.alternative!, ['grappler']))
    expect(isOpen(feat)).toBe(false)
    expect(computeSheet(feat, c14).active.some((a) => a.entity.id === 'grappler')).toBe(true)
    // Picking the ASI afterwards replaces the feat.
    const points = okR(setChoiceValues(feat, c14, asi.ae, asi.choice, ['str+2']))
    expect(points.choices[choiceKey(asi.ae.grantKey, 'feat')]).toBeUndefined()
    expect(isOpen(points)).toBe(false)
  })

  it('Eldritch Invocations check their prerequisites', () => {
    const c = hero('2024', 'warlock', 5)
    const s = computeSheet(c, c24)
    const inv = allChoices(c, s).find((x) => x.choice.id === 'invocations')!
    expect(inv.count).toBe(5)
    const opts = Object.fromEntries(choiceOptions(c, c24, s, inv.ae, inv.choice).map((o) => [o.id, o.blocked]))
    expect(opts['invocation-pact-of-the-blade']).toBeUndefined()
    expect(opts['invocation-thirsting-blade']).toBe('invocation-pact-of-the-blade')
    expect(opts['invocation-witch-sight']).toBe('level 15')
    expect(opts['invocation-agonizing-blast']).toBeDefined() // no damaging cantrip known yet
    const withBlade = { ...c, choices: { [choiceKey(inv.ae.grantKey, 'invocations')]: ['invocation-pact-of-the-blade'] }, spells: { warlock: { known: ['eldritch-blast'], prepared: [] } } }
    const s2 = computeSheet(withBlade, c24)
    const opts2 = Object.fromEntries(choiceOptions(withBlade, c24, s2, inv.ae, inv.choice).map((o) => [o.id, o.blocked]))
    expect(opts2['invocation-thirsting-blade']).toBeUndefined()
    expect(opts2['invocation-agonizing-blast']).toBeUndefined()
    expect(opts2['invocation-pact-of-the-blade']).toBeUndefined() // selected here
  })

  it('2014 invocations: level and Eldritch Blast', () => {
    const c = hero('2014', 'warlock', 5)
    const s = computeSheet(c, c14)
    const inv = allChoices(c, s).find((x) => x.choice.id === 'invocations')!
    const opts = Object.fromEntries(choiceOptions(c, c14, s, inv.ae, inv.choice).map((o) => [o.id, o.blocked]))
    expect(opts['eldritch-invocation-mire-the-mind']).toBeUndefined()
    expect(opts['eldritch-invocation-ascendant-step']).toBe('level 9')
    expect(opts['eldritch-invocation-agonizing-blast']).toBe('eldritch-blast')
  })

  it('a subclass can be set; feats check level and abilities', () => {
    const c = okR(setSubclass(hero('2024', 'fighter', 4), c24, 'fighter', 'champion'))
    const s = computeSheet(c, c24)
    expect(pendingChoices(c, c24, s).some((p) => p.kind === 'subclass')).toBe(false)
    const asi = allChoices(c, s).find((x) => x.ae.entity.id === 'fighter-ability-score-improvement')!
    const opts = choiceOptions(c, c24, s, asi.ae, asi.choice)
    expect(opts.find((o) => o.id === 'grappler')?.blocked).toBeUndefined()
    expect(opts.some((o) => o.id === 'boon-of-fate')).toBe(false) // epic boons are their own choice
  })

  it('Wizard spellbook size and missing spells', () => {
    expect(spellbookSize(1)).toBe(6)
    expect(spellbookSize(5)).toBe(14)
    const c = hero('2024', 'wizard', 3)
    const sp = pendingChoices(c, c24, computeSheet(c, c24)).find((p) => p.kind === 'spells')
    expect(sp && sp.kind === 'spells' && sp.missing.map((m) => m.what)).toEqual(['cantrips', 'spellbook', 'prepared'])
  })

  it('every class at level 20 can complete all its choices (both editions)', () => {
    for (const [edition, content] of [['2024', c24], ['2014', c14]] as const) {
      for (const cls of content.all('class')) {
        let c = hero(edition, cls.id, 20)
        const sub = content.all('subclass').find((s) => s.class === cls.id)
        if (sub) c = okR(setSubclass(c, content, cls.id, sub.id))
        // Fill choices until nothing changes (picked entities can bring choices of their own).
        for (let round = 0; round < 6; round++) {
          const s = computeSheet(c, content)
          let changed = false
          for (const p of pendingChoices(c, content, s)) {
            if (p.kind !== 'choice') continue
            const opts = choiceOptions(c, content, s, p.ae, p.choice).filter((o) => !o.blocked)
            const values =
              p.choice.kind === 'abilityPoints'
                ? Array.from({ length: Math.ceil(((p.choice.points ?? 2) * p.count) / (p.choice.perOption ?? 1)) }, (_, i) => `${opts[i % opts.length].id}+${p.choice.perOption ?? 1}`)
                : opts.slice(0, p.count).map((o) => o.id)
            const r = setChoiceValues(c, content, p.ae, p.choice, values)
            if (r.ok) {
              c = r.character
              changed = true
            }
          }
          if (!changed) break
        }
        const left = pendingChoices(c, content, computeSheet(c, content)).filter((p) => p.kind === 'choice')
        expect(left.map((p) => (p.kind === 'choice' ? `${edition} ${cls.id}: ${p.ae.entity.id}/${p.choice.id}` : '')), `${edition} ${cls.id}`).toEqual([])
      }
    }
  })
})
