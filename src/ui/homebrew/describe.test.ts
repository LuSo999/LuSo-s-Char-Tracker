import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import csJson from '../../i18n/cs.json'
import enJson from '../../i18n/en.json'
import { srd } from '../../engine/fixtures'
import { EffectWhen } from '../../content/schema'
import { describeActivity, describeEffect, describeResource } from './describe'
import { findExamples } from './help/examples'
import { cs } from './help/text.cs'
import { en, type HelpId } from './help/text.en'
import { topicMeta } from './help/topics'
import { COMPANION_KINDS, FAMILIES, formatTarget, parseTarget } from './targets'

const i18n = i18next.createInstance()
await i18n.init({ resources: { en: { translation: enJson }, cs: { translation: csJson } }, lng: 'en', interpolation: { escapeValue: false } })
const t = i18n.getFixedT('en')
const tc = i18n.getFixedT('cs')
const content = srd('2024')

describe('effect targets', () => {
  it.each(['ac', 'speed:fly', 'save:all', 'save:wis', 'proficiency:skill:stealth', 'proficiency:tool:thieves-tools', 'resistance:@types', 'spellDc', 'spellDc:warlock', 'shape:maxCr', 'shape@fluid:maxCr', 'shape:creature:creature-air-elemental', 'companion:ac', 'companion@summon:resistance:fire', 'ally:save:all', 'note'])('%s parses and formats back', (target) => {
    const p = parseTarget(target)
    expect(p.family, target).toBeDefined()
    expect(formatTarget(p.family!.id, p.args, p.group)).toBe(target)
  })

  it('keeps unknown targets as custom', () => {
    expect(parseTarget('damageReduction').family).toBeUndefined()
  })
})

describe('sentences', () => {
  it('describes effects', () => {
    expect(describeEffect({ target: 'ac', op: 'add', value: 1, when: 'wearingArmor' }, { t })).toBe('+1 to AC, while wearing armor')
    expect(describeEffect({ target: 'critRange', op: 'min', value: 19 }, { t })).toBe('Critical hit on 19–20')
    expect(describeEffect({ target: 'proficiency:skill:stealth', op: 'max', value: 2 }, { t, content })).toBe('Expertise: skill Stealth')
    expect(describeEffect({ target: 'sense:darkvision', op: 'max', value: 60 }, { t })).toBe('Darkvision 60 ft')
    expect(describeEffect({ target: 'damage', op: 'add', value: 2, when: [{ toggle: 'Raging' }, 'strengthAttack'] }, { t })).toBe('+2 to Weapon damage, while “Raging” is on and with Strength attacks')
    expect(describeEffect({ target: 'companion@summon:ac', op: 'add', value: 2 }, { t })).toBe('summons: +2 to AC')
    expect(describeEffect({ target: 'ally:save:all', op: 'add', value: 'max(1, cha)', range: 10 }, { t })).toBe('Allies within 10 ft: +max(1, cha) to all saving throws')
    expect(describeEffect({ target: 'ac', op: 'add', value: 1 }, { t: tc })).toBe('+1 k AC')
  })

  it('describes resources and actions', () => {
    expect(describeResource({ id: 'x', name: 'Lantern Dice', max: 'pb', die: 8, recharge: [{ on: 'longRest', amount: 'all' }] }, { t })).toBe('Lantern Dice: pb× d8, back on long rest')
    expect(describeActivity({ name: 'Rage', actionType: 'bonusAction', cost: [{ resource: 'rage', amount: 1 }], toggle: 'Raging' }, { t })).toBe('Rage (Bonus action), spends 1× rage, switches on “Raging”')
    expect(describeActivity({ name: 'Wild Blood', actionType: 'action', table: { dice: '1d100', rows: [{}, {}] } }, { t })).toBe('Wild Blood (Action), rolls 1d100 on a table (2 outcomes)')
  })
})

describe('help topics', () => {
  it('cover every target family, condition, op and kind', () => {
    const whens = (EffectWhen.options[0] as unknown as { options: { options: string[] }[] }).options[0].options
    const ids = [...FAMILIES.map((f) => `target.${f.id}`), ...whens.map((w) => `when.${w}`), ...['add', 'set', 'min', 'max'].map((o) => `op.${o}`), ...COMPANION_KINDS.map((k) => `companion.kind.${k}`)]
    for (const id of ids) {
      expect(en[id as HelpId], id).toBeTruthy()
      expect(cs[id as HelpId], id).toBeTruthy()
    }
  })

  it('find real examples in the SRD', () => {
    expect(findExamples(content, 'target.ac').length).toBeGreaterThan(0)
    expect(findExamples(content, 'when.wearingArmor').map((x) => x.entity.id)).toContain('defense')
    expect(findExamples(content, 'activity.toggle').length).toBeGreaterThan(0)
    expect(findExamples(content, 'companion.kind.summon').length).toBeGreaterThan(0)
    expect(topicMeta('target.save').place).toBe('saves')
  })
})
