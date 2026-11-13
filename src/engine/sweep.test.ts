// Broad sweep: every SRD class (with its SRD subclass) in both editions is leveled 1 → 20
// through the real Level up, picking the first valid option of every open choice. At every
// level the sheet must compute without errors and give sane numbers; at 20 the spell slot
// tables must match the rules; leveling down again must return to level 1.
import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import type { Character } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { choiceOptions, levelDown, levelUp, pendingChoices, setChoiceValues, setSubclass } from './levelup'
import { longRest, shortRest } from './rest'
import type { ContentIndex } from '../content'

const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}

/** Resolve every open decision with the first valid options (abilityPoints: +1/+1 or +2). */
function decideAll(char: Character, content: ContentIndex): Character {
  for (let guard = 0; guard < 40; guard++) {
    const sheet = computeSheet(char, content)
    const open = pendingChoices(char, content, sheet).filter((p) => p.kind !== 'spells')
    if (!open.length) return char
    const p = open[0]
    if (p.kind === 'subclass') {
      const sub = content.all('subclass').find((s) => s.class === p.classId)!
      char = okR(setSubclass(char, content, p.classId, sub.id))
      continue
    }
    if (p.kind !== 'choice') continue
    let values: string[]
    if (p.choice.kind === 'abilityPoints') {
      const total = (p.choice.points ?? 2) * Math.max(1, p.count)
      values = total >= 2 ? [`con+${Math.ceil(total / 2)}`, `wis+${Math.floor(total / 2)}`] : [`con+${total}`]
    } else {
      const options = choiceOptions(char, content, sheet, p.ae, p.choice).filter((o) => !o.blocked)
      values = [...p.chosen, ...options.filter((o) => !p.chosen.includes(o.id)).map((o) => o.id)].slice(0, p.count)
    }
    const r = setChoiceValues(char, content, p.ae, p.choice, values)
    if (!r.ok) throw new Error(`${p.ae.entity.id}/${p.choice.id}: ${r.error}`)
    char = r.character
  }
  throw new Error('Choices never settle')
}

const fullSlots = [4, 3, 3, 3, 3, 2, 2, 1, 1]
const halfSlots = [4, 3, 3, 3, 2]
const slotsAt20: Record<string, number[]> = {
  bard: fullSlots, cleric: fullSlots, druid: fullSlots, sorcerer: fullSlots, wizard: fullSlots,
  paladin: halfSlots, ranger: halfSlots,
}

for (const edition of ['2014', '2024'] as const) {
  const content = srd(edition)
  describe(`${edition}: every class 1 → 20`, () => {
    for (const cls of content.all('class')) {
      it(cls.name, () => {
        let c = makeCharacter({
          edition,
          classes: [{ classId: cls.id, level: 1 }],
          speciesId: 'human',
          backgroundId: edition === '2024' ? 'soldier' : 'acolyte',
          baseScores: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
          hp: { current: 10 },
        })
        c = decideAll(c, content)
        for (let level = 2; level <= 20; level++) {
          c = okR(levelUp(c, content, cls.id, null))
          c = decideAll(c, content)
          const s = computeSheet(c, content)
          expect(s.characterLevel).toBe(level)
          expect(s.hpMax.value, `HP at ${level}`).toBeGreaterThan(level)
          expect(s.ac.value).toBeGreaterThanOrEqual(10)
          expect(s.pb.value).toBe(2 + Math.floor((level - 1) / 4))
          for (const r of s.resources) expect(r.max, `${r.key} at ${level}`).toBeGreaterThanOrEqual(0)
          for (const a of s.attacks) expect(Number.isFinite(a.attack.value) && Number.isFinite(a.damage.value), a.name).toBe(true)
        }
        const s20 = computeSheet(c, content)
        if (slotsAt20[cls.id]) expect(s20.spellcasting.slots.map((x) => x.max), 'slots at 20').toEqual(slotsAt20[cls.id])
        if (cls.id === 'warlock') expect(s20.spellcasting.pact).toMatchObject({ level: 5, max: 4 })
        // Rests keep working at 20 and leave a valid character.
        const rested = longRest(shortRest(c, content).character, content).character
        expect(computeSheet(rested, content).hpMax.value).toBe(s20.hpMax.value)
        // Level down back to 1.
        for (let level = 20; level > 1; level--) c = okR(levelDown(c, content))
        expect(c.classes[0].level).toBe(1)
        expect(computeSheet(c, content).characterLevel).toBe(1)
      })
    }
  })
}
