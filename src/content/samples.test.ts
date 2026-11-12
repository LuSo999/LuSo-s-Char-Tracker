// The importable sample files in docs/samples must stay valid characters.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Character } from '../engine/character'
import { computeSheet } from '../engine/derive'
import { srdBoth } from '../engine/fixtures'

describe('docs/samples/wizard-level-4-2024.json', () => {
  const raw = JSON.parse(readFileSync(new URL('../../docs/samples/wizard-level-4-2024.json', import.meta.url), 'utf8'))
  const content = srdBoth('2024')
  const c = Character.parse({ id: 'w', ...raw })
  const s = computeSheet(c, content)

  it('is a level 4 Wizard with 4/3 slots, 4 cantrips and 7 prepared spells', () => {
    expect(s.spellcasting.slots.map((x) => x.max)).toEqual([4, 3])
    expect(s.spellcasting.casters[0]).toMatchObject({ cantripsMax: 4, spellsMax: 7, dc: 8 + 2 + 4, attack: 2 + 4 })
    expect(s.spellcasting.casters[0].cantrips).toHaveLength(4)
    expect(s.spellcasting.casters[0].prepared).toHaveLength(7)
    expect(s.hpMax.value).toBe(26)
    expect(s.scores.int.value).toBe(19)
  })

  it('every id in the file exists in the content', () => {
    const ids = [...c.spells.wizard.known, ...c.inventory.map((e) => e.itemId), c.speciesId, c.subspeciesId!, c.backgroundId, 'evoker']
    expect(ids.filter((id) => !content.get(id))).toEqual([])
    expect(s.spellcasting.rows.filter((r) => r.always).map((r) => r.spell.id).sort()).toEqual(['detect-magic', 'find-familiar', 'light', 'minor-illusion', 'prestidigitation'])
  })
})
