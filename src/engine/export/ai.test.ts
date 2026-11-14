// Desktop app's Claude requests: catalogue for the prompt and the answers' conversions.
import { describe, expect, it } from 'vitest'
import { SheetImport } from '../exchange'
import { compactCatalogue, extractToImport, mappingPrompt, mappingToFields, type AiExtract } from './ai'
import { exportCatalogue } from './values'

const catalogue = exportCatalogue()
const keys = new Set(catalogue.map((f) => f.key))

describe('Claude mapping', () => {
  it('lists numbered families once', () => {
    const text = compactCatalogue(catalogue)
    expect(text.split('\n').filter((l) => l.startsWith('spell.N.name'))).toHaveLength(1)
    expect(text).toContain('lvl.L.N')
    expect(text.split('\n').length).toBeLessThan(160)
  })

  it('turns pixels into PDF points and drops unknown or repeated keys', () => {
    const pages = [{ width: 600, height: 800, image: { width: 1200, height: 1600 } }]
    const fields = mappingToFields(
      {
        formFields: [{ name: 'f1', key: 'name' }, { name: 'nope', key: 'ac' }, { name: 'f2', key: 'name' }],
        boxes: [{ page: 0, key: 'ac', x: 100, y: 200, w: 60, h: 40, multiline: false, align: 'center' }, { page: 0, key: 'made.up', x: 0, y: 0, w: 1, h: 1, multiline: false, align: 'left' }],
        marks: [{ page: 0, key: 'skill.arcana.prof', x: 50, y: 1500 }],
        comment: '',
      },
      pages, keys, new Set(['f1', 'f2']),
    )
    expect(fields).toEqual([
      { kind: 'form', name: 'f1', key: 'name' },
      { kind: 'text', page: 0, key: 'ac', x: 50, y: 680, w: 30, h: 20, align: 'center' },
      { kind: 'mark', page: 0, key: 'skill.arcana.prof', x: 25, y: 50 },
    ])
    const prompt = mappingPrompt({ pages, widgets: [{ page: 0, name: 'f1', type: 'text', x: 10, y: 700, w: 100, h: 20 }], words: [], catalogue })
    expect(prompt).toContain('f1 | text | page 0 | [20, 160, 200, 40]')
  })
})

describe('Claude extraction', () => {
  it('becomes a valid sheet import without blanks', () => {
    const e: AiExtract = {
      edition: 'unknown', name: ' Brom ', classes: [{ name: 'Fighter', level: 3, subclass: '' }], species: 'Dwarf', subspecies: '', background: '',
      abilities: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 0 }, hpMax: 31, hpCurrent: 0, xp: 0,
      skills: ['Athletics', ' '], expertise: [], languages: ['Common', 'Dwarvish'], tools: [], cantrips: [], spells: [], feats: [],
      items: [{ name: 'Longsword', quantity: 0, equipped: true }], currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 }, notes: '',
    }
    const out = SheetImport.parse(extractToImport(e))
    expect(out).toMatchObject({ name: 'Brom', species: 'Dwarf', abilities: { str: 16, int: 8 }, hpMax: 31, skills: ['Athletics'], items: [{ name: 'Longsword', quantity: 1, equipped: true }], currency: { gp: 15 } })
    expect(out.edition).toBeUndefined()
    expect(out.abilities.cha).toBeUndefined()
  })
})
