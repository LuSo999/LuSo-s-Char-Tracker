// Character sheet PDF export: catalogue and values, built-in templates, filling, analysis.
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { computeSheet } from '../derive'
import { makeCharacter, srd } from '../fixtures'
import { analyzeFields } from './analyze'
import { fillSheet } from './fill'
import { SheetTemplate } from './template'
import { exportCatalogue, exportValues } from './values'

const c24 = srd('2024')
const wizard = makeCharacter({
  name: 'Žofie Řezníčková', edition: '2024', classes: [{ classId: 'wizard', level: 5, subclassId: 'evoker' }], speciesId: 'human', backgroundId: 'sage',
  baseScores: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 }, hp: { current: 20 },
  inventory: [{ uid: 'a', itemId: 'dagger', quantity: 2, equipped: true }],
  spells: { wizard: { known: ['fire-bolt', 'magic-missile', 'fireball'], prepared: ['magic-missile', 'fireball'] } },
  currency: { cp: 0, sp: 0, ep: 0, gp: 42, pp: 0 },
})
const font = new Uint8Array(readFileSync('src/assets/fonts/Roboto-Regular.ttf'))

describe('Export values', () => {
  it('cover identity, abilities, skills, attacks, spells and money', () => {
    const v = exportValues(wizard, computeSheet(wizard, c24), c24)
    expect(v).toMatchObject({ name: 'Žofie Řezníčková', class: 'Wizard 5', 'int.score': '17', 'int.mod': '+3', 'int.saveProf': true, 'coins.gp': '42', 'spell.dc': '14' })
    expect(v['skill.arcana.prof']).toBe(true)
    expect(v['attack.1.name']).toBe('Dagger')
    expect(v['cantrip.1']).toBe('Fire Bolt')
    expect(v['lvl.3.1']).toBe('Fireball')
    // Every value has a catalogue entry.
    const keys = new Set(exportCatalogue().map((f) => f.key))
    for (const k of Object.keys(v)) expect(keys.has(k), k).toBe(true)
  })

  it('built-in templates are valid and only use known keys', () => {
    const keys = new Set(exportCatalogue().map((f) => f.key))
    for (const file of ['dnd-2024-official']) {
      const t = SheetTemplate.parse(JSON.parse(readFileSync(`src/engine/export/templates/${file}.json`, 'utf8')))
      for (const f of t.fields) expect(keys.has(f.key), `${file}: ${f.key}`).toBe(true)
    }
  })
})

describe('Filling a PDF', () => {
  it('fills form fields (with diacritics) and draws text and marks on pages', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 300])
    const form = doc.getForm()
    form.createTextField('who').addToPage(page, { x: 10, y: 250, width: 200, height: 20 })
    form.createCheckBox('arcana').addToPage(page, { x: 10, y: 200, width: 10, height: 10 })
    const pdf = await doc.save()
    const t = SheetTemplate.parse({
      id: 't', name: 'T', pages: [[300, 300]],
      fields: [
        { kind: 'form', name: 'who', key: 'name' },
        { kind: 'form', name: 'arcana', key: 'skill.arcana.prof' },
        { kind: 'text', page: 0, x: 10, y: 100, w: 100, h: 12, key: 'class' },
        { kind: 'mark', page: 0, x: 50, y: 50, key: 'int.saveProf' },
      ],
    })
    const { bytes, report } = await fillSheet(new Uint8Array(pdf), t, { name: 'Žofie', 'skill.arcana.prof': true, class: 'Wizard 5', 'int.saveProf': true }, font)
    expect(report).toEqual({ filled: 4, missingFields: [] })
    const back = await PDFDocument.load(bytes)
    expect(back.getForm().getTextField('who').getText()).toBe('Žofie')
    expect(back.getForm().getCheckBox('arcana').isChecked()).toBe(true)
  })
})

describe('Analysis', () => {
  it('finds skills, ability blocks, saves and plain labels from positions', () => {
    const words = [
      { page: 0, x: 40, y: 500, w: 40, h: 8, text: 'Arcana' },
      { page: 0, x: 20, y: 600, w: 50, h: 9, text: 'STRENGTH' },
      { page: 0, x: 20, y: 560, w: 30, h: 6, text: 'modifier' },
      { page: 0, x: 40, y: 540, w: 50, h: 7, text: 'Saving Throw' },
      { page: 0, x: 200, y: 700, w: 60, h: 6, text: 'character name' },
    ]
    const widgets = [
      { page: 0, name: 'a', type: 'check' as const, x: 25, y: 499, w: 10, h: 10 },
      { page: 0, name: 'b', type: 'text' as const, x: 20, y: 568, w: 25, h: 20 },
      { page: 0, name: 'c', type: 'check' as const, x: 25, y: 539, w: 10, h: 10 },
      { page: 0, name: 'd', type: 'text' as const, x: 200, y: 708, w: 150, h: 14 },
    ]
    const keys = Object.fromEntries(analyzeFields(widgets, words).map((p) => [p.field.name, p.key]))
    expect(keys).toEqual({ a: 'skill.arcana.prof', b: 'str.mod', c: 'str.saveProf', d: 'name' })
  })
})
