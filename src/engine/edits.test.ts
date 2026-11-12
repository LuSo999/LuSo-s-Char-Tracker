import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import { computeSheet } from './derive'
import { customize, resetAllOverrides, setBaseScore, setOverride } from './edits'
import { srd, valdric } from './fixtures'

const content = srd('2024')
function okR(r: ActionResult) {
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('manual overrides', () => {
  it('override, mark, and reset to the computed value', () => {
    const r = okR(setOverride(valdric(), 'ac', 21, 'AC', 19))
    expect(r.kind).toBe('sheet')
    expect(computeSheet(r.character, content).ac).toMatchObject({ value: 21, computed: 19, overridden: true })
    expect(r.items[0]).toMatchObject({ type: 'override', before: 19, after: 21 })
    const back = okR(setOverride(r.character, 'ac', undefined, 'AC', 19))
    expect(computeSheet(back.character, content).ac.overridden).toBe(false)
  })

  it('typing the computed value again clears the override', () => {
    const c = okR(setOverride(valdric(), 'ac', 21, 'AC', 19)).character
    expect(okR(setOverride(c, 'ac', 19, 'AC', 19)).character.overrides).toEqual({})
  })

  it('an overridden score flows into everything that uses its modifier', () => {
    const c = okR(setOverride(valdric(), 'score:str', 20, 'STR', 16)).character
    const s = computeSheet(c, content)
    expect(s.mods.str).toBe(5)
    expect(s.attacks.find((a) => a.key === 'flail')!.attack.value).toBe(7)
  })

  it('damage, save DC and resource maximum overrides', () => {
    let c = okR(setOverride(valdric(), 'damage:flail', 5, 'Flail damage', 3)).character
    c = okR(setOverride(c, 'resource:second-wind:max', 4, 'Second Wind', 3)).character
    c = okR(setOverride(c, 'dc:core-combat:grapple', 15, 'Grapple DC', 13)).character
    const s = computeSheet(c, content)
    expect(s.attacks.find((a) => a.key === 'flail')!.damage).toMatchObject({ value: 5, computed: 3, overridden: true })
    expect(s.resources.find((r) => r.key === 'second-wind')).toMatchObject({ max: 4, maxComputed: 3, maxOverridden: true })
    expect(s.activities.find((a) => a.activity.id === 'grapple')!.saveDc).toBe(15)
    expect(okR(resetAllOverrides(c)).character.overrides).toEqual({})
  })

  it('base scores are clamped to 1–30', () => {
    expect(okR(setBaseScore(valdric(), 'str', 40)).character.baseScores.str).toBe(30)
  })
})

describe('own names, summaries and links', () => {
  it('apply everywhere through the content view and can be reset', () => {
    const c = okR(customize(valdric(), 'fighter-second-wind', 'Second Wind', { name: 'Druhý dech', url: 'https://example.com/sw' })).character
    const view = content.withCustomizations(c.customizations)
    expect(view.get('fighter-second-wind')).toMatchObject({ name: 'Druhý dech', source: { url: 'https://example.com/sw' } })
    expect(view.isCustomized('fighter-second-wind')).toBe(true)
    const s = computeSheet(c, view)
    expect(s.activities.find((a) => a.source.entity.id === 'fighter-second-wind')!.activity.name).toBe('Druhý dech')
    expect(s.resources.find((r) => r.key === 'second-wind')!.resource.name).toBe('Druhý dech')
    expect(content.get('fighter-second-wind')!.name).toBe('Second Wind')
    const reset = okR(customize(c, 'fighter-second-wind', 'Second Wind', { name: '', url: '' })).character
    expect(reset.customizations).toEqual({})
  })
})
