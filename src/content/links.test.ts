import { describe, expect, it } from 'vitest'
import { srd } from '../engine/fixtures'
import { ruleLink } from './links'

describe('wikidot links (patterns checked against the live sites)', () => {
  const c14 = srd('2014')
  const c24 = srd('2024')
  const link = (c: typeof c14, id: string) => ruleLink(c.get(id)!, c, 'wikidot')

  it('classes and subclasses', () => {
    expect(link(c14, 'fighter')).toBe('https://dnd5e.wikidot.com/fighter')
    expect(link(c24, 'fighter')).toBe('https://dnd2024.wikidot.com/fighter:main')
    expect(link(c24, 'path-of-the-berserker')).toBe('https://dnd2024.wikidot.com/barbarian:path-of-the-berserker')
    expect(link(c14, 'draconic')).toBe('https://dnd5e.wikidot.com/sorcerer:draconic-bloodline')
  })

  it('features open their class or subclass page', () => {
    expect(link(c24, 'fighter-second-wind')).toBe('https://dnd2024.wikidot.com/fighter:main')
    expect(link(c24, 'champion-improved-critical')).toBe('https://dnd2024.wikidot.com/fighter:champion')
    expect(link(c14, 'fighter-fighting-style-archery')).toBe('https://dnd5e.wikidot.com/fighter')
  })

  it('spells, including names the SRD shortened', () => {
    expect(link(c24, 'find-familiar')).toBe('https://dnd2024.wikidot.com/spell:find-familiar')
    expect(link(c14, 'acid-arrow')).toBe('https://dnd5e.wikidot.com/spell:melfs-acid-arrow')
    expect(link(c24, 'arcane-hand')).toBe('https://dnd2024.wikidot.com/spell:bigby-s-hand')
  })

  it('species traits, magic item variants and equipment', () => {
    expect(link(c24, 'large-form')).toBe('https://dnd2024.wikidot.com/species:goliath')
    expect(link(c14, 'potion-of-healing-greater')).toBe('https://dnd5e.wikidot.com/wondrous-items:potion-of-healing')
    expect(link(c24, 'flail')).toBe('https://dnd2024.wikidot.com/equipment:weapon')
  })

  it('an explicit source.url always wins', () => {
    const e = { ...c24.get('alert')!, source: { book: 'x', url: 'https://example.com/alert' } }
    expect(ruleLink(e, c24, 'wikidot')).toBe('https://example.com/alert')
  })
})
