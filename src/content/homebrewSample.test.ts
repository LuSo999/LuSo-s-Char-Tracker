// docs/samples/homebrew-example.json: the documented homebrew pack works on a character.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ContentIndex } from '.'
import { Pack } from './schema'
import { performActivity } from '../engine/actions'
import { computeSheet } from '../engine/derive'
import { makeCharacter } from '../engine/fixtures'
import { checkEntity, copyPack, missingReferences, newEntity, newPack, parsePackFile } from '../engine/homebrew'
import { allChoices, choiceOptions, setChoiceValues } from '../engine/levelup'

const text = readFileSync('docs/samples/homebrew-example.json', 'utf8')
const srd = Pack.parse(JSON.parse(readFileSync('src/data/srd/2024.json', 'utf8')))

describe('Homebrew example pack', () => {
  const r = parsePackFile(text)
  if (!r.ok) throw new Error(r.errors.join('\n'))
  const content = new ContentIndex('2024', [srd, r.pack])

  it('has no missing references', () => {
    expect(missingReferences(r.pack, (id) => !!content.get(id))).toEqual([])
  })

  it('Lantern Warden: dice pool, techniques choice, actions that spend dice', () => {
    let c = makeCharacter({ edition: '2024', classes: [{ classId: 'fighter', level: 10, subclassId: 'hb-example-lantern-warden' }], speciesId: 'human', backgroundId: 'soldier', baseScores: { str: 16, dex: 12, con: 14, int: 8, wis: 14, cha: 10 }, hp: { current: 20 } })
    let s = computeSheet(c, content)
    expect(s.resources.find((x) => x.key === 'lantern-dice')).toMatchObject({ max: 5, die: 8 })
    const p = allChoices(c, s).find((x) => x.choice.id === 'techniques')!
    expect(p.count).toBe(4)
    expect(choiceOptions(c, content, s, p.ae, p.choice).map((o) => o.id)).toHaveLength(4)
    const set = setChoiceValues(c, content, p.ae, p.choice, ['hb-example-flare', 'hb-example-kindle', 'hb-example-ward', 'hb-example-guiding-beam'])
    if (!set.ok) throw new Error(set.error)
    c = set.character
    s = computeSheet(c, content)
    const flare = s.activities.find((a) => a.activity.name === 'Flare')!
    expect(flare.rollDice).toBe('1d8')
    expect(flare.saveDc).toBe(8 + 4 + 2)
    const kindle = s.activities.find((a) => a.activity.name === 'Kindle')!
    const healed = performActivity(c, s, kindle, 12, { spent: 2 })
    expect(healed.ok && healed.character.hp.current).toBe(32)
    expect(s.senses.darkvision).toBe(60)
  })
})

describe('Homebrew editing helpers', () => {
  it('new pack and entities are valid; ids are unique; copies get new ids', () => {
    const pack = newPack('2024', 'My Stuff')
    const a = newEntity(pack, 'spell', 'Fire Ball')
    const withA = { ...pack, entities: [a] }
    const b = newEntity(withA, 'spell', 'Fire Ball')
    expect(a.id).not.toBe(b.id)
    for (const type of ['feature', 'subclass', 'feat', 'species', 'subspecies', 'background', 'item', 'spell'] as const) expect(checkEntity(newEntity(pack, type, type)).ok).toBe(true)
    const copy = copyPack({ ...pack, entities: [a, b] })
    expect(copy.id).not.toBe(pack.id)
    expect(copy.entities.every((e) => e.id.startsWith(copy.id))).toBe(true)
  })

  it('reports readable errors', () => {
    const r = checkEntity({ id: 'x', type: 'spell', edition: '2024', name: 'Bad', source: { book: 'homebrew' }, level: 12 })
    expect(r.ok).toBe(false)
    const bad = parsePackFile('{ not json')
    expect(!bad.ok && bad.errors[0]).toMatch(/JSON/)
  })
})
