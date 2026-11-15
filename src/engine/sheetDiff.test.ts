import { describe, expect, it } from 'vitest'
import { sampleChampion, sampleWizard } from '../data/samples'
import { computeSheet } from './derive'
import { makeCharacter, srdWith } from './fixtures'
import { diffSheets, tryOnToggles, wearEntity } from './sheetDiff'

const base = { edition: '2024', source: { book: 'homebrew:hb-test' }, description: '' } as const
const feat = {
  ...base,
  id: 'hb-guard',
  type: 'feat',
  name: 'Guard',
  choices: [{ id: 'types', label: 'Element', kind: 'option', options: ['fire', 'cold'] }],
  effects: [{ target: 'ac', op: 'add', value: 1 }, { target: 'resistance:@types' }, { target: 'speed', op: 'add', value: 10, when: { toggle: 'Dash' } }],
  activities: [{ id: 'shove', name: 'Guard Shove', actionType: 'bonusAction' }],
}
const ring = { ...base, id: 'hb-ring', type: 'item', kind: 'ring', name: 'Ring of Warding', magic: true, attunement: true, effects: [{ target: 'save:all', op: 'add', value: 1 }] }
const spell = { ...base, id: 'hb-bolt', type: 'spell', name: 'Rune Bolt', level: 1, school: 'evocation', castingTime: '1 action', actionType: 'action', range: '60 feet', components: ['V'], duration: 'Instantaneous', concentration: false, ritual: false, classes: [] }
const content = srdWith('2024', [feat, ring, spell])
const champion = makeCharacter(sampleChampion)

describe('try on a character', () => {
  it('a feat: AC, resistance from its first option, a new action; toggles listed', () => {
    const worn = wearEntity(champion, content.require('hb-guard', 'feat'))!
    expect(worn.picked).toEqual([{ label: 'Element', values: ['fire'] }])
    const before = computeSheet(champion, content)
    const after = computeSheet(worn.character, content)
    const diff = diffSheets(before, after)
    expect(diff).toContainEqual({ place: 'ac', key: 'ac', before: String(before.ac.value), after: String(before.ac.value + 1), name: undefined })
    expect(diff).toContainEqual({ place: 'senses', key: 'resistance', name: 'fire', after: 'fire' })
    expect(diff.some((d) => d.key === 'activity' && d.name === 'Guard Shove')).toBe(true)
    const tg = tryOnToggles(after, 'hb-guard')
    expect(tg.map((x) => x.label)).toEqual(['Dash'])
    const on = computeSheet({ ...worn.character, toggles: [tg[0].key] }, content)
    expect(on.speed.value).toBe(before.speed.value + 10)
  })

  it('an item is equipped and attuned; a spell is granted', () => {
    const ring2 = wearEntity(champion, content.require('hb-ring', 'item'))!
    expect(diffSheets(computeSheet(champion, content), computeSheet(ring2.character, content)).filter((d) => d.key === 'save')).toHaveLength(6)
    const wizard = makeCharacter(sampleWizard)
    const bolt = wearEntity(wizard, content.require('hb-bolt', 'spell'))!
    expect(diffSheets(computeSheet(wizard, content), computeSheet(bolt.character, content))).toContainEqual(expect.objectContaining({ key: 'spell', name: 'Rune Bolt' }))
  })
})
