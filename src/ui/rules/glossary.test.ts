import { describe, expect, it } from 'vitest'
import { ContentIndex } from '../../content'
import { loadSrd } from '../../data/srd'
import { buildGlossary, glossaryOf, splitTerms, type TermSegment } from './glossary'

const terms = (segments: TermSegment[]) => segments.filter((s) => typeof s !== 'string').map((s) => (s as { id: string; text: string }).id)
const joined = (segments: TermSegment[]) => segments.map((s) => (typeof s === 'string' ? s : s.text)).join('')

describe('Rules terms in free text', () => {
  const glossary = buildGlossary([
    { id: 'paralyzed', name: 'Paralyzed' },
    { id: 'rule-hit-points', name: 'Hit Points' },
    { id: 'rule-temporary-hit-points', name: 'Temporary Hit Points' },
    { id: 'rule-saving-throw', name: 'Saving Throw' },
  ])

  it('finds conditions whatever the case and keeps the text intact', () => {
    const text = 'The target must succeed on a Wisdom saving throw or be paralyzed for the duration.'
    const segments = splitTerms(text, glossary)
    expect(terms(segments)).toEqual(['rule-saving-throw', 'paralyzed'])
    expect(joined(segments)).toBe(text)
  })

  it('matches plurals, singulars and line breaks, longest name first', () => {
    expect(terms(splitTerms('gains 5 Temporary Hit Points and 1 hit point; repeats the saving\nthrows', glossary))).toEqual([
      'rule-temporary-hit-points',
      'rule-hit-points',
      'rule-saving-throw',
    ])
  })

  it('only matches whole words and can skip the entity being shown', () => {
    expect(terms(splitTerms('Unparalyzedness', glossary))).toEqual([])
    expect(terms(splitTerms('While you have the Paralyzed condition…', glossary, 'paralyzed'))).toEqual([])
  })

  it('links skills only in their rules form', () => {
    const skills = buildGlossary([{ id: 'skill-nature', name: 'Nature', strict: true }])
    expect(terms(splitTerms('You commune with nature spirits. Nature trick.', skills))).toEqual([])
    expect(terms(splitTerms('an Intelligence (Nature) check or a Nature check', skills))).toEqual(['skill-nature', 'skill-nature'])
  })

  it('links Hold Person to the Paralyzed condition in both editions', async () => {
    for (const edition of ['2014', '2024'] as const) {
      const content = new ContentIndex(edition, [await loadSrd(edition)])
      const spell = content.get('hold-person')!
      expect(terms(splitTerms(spell.description, glossaryOf(content), spell.id)), edition).toContain('paralyzed')
    }
  })
})
