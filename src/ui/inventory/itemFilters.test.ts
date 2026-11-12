import { describe, expect, it } from 'vitest'
import { srd } from '../../engine/fixtures'
import { defaultFilters, filterItems, type ItemFilters } from './itemFilters'

const content = srd('2024')
const items = content.all('item').filter((i) => !i.tags.includes('variant-group'))
const run = (f: Partial<ItemFilters>) => filterItems(items, { ...defaultFilters, ...f }, (i) => i.source.book).map((i) => i.id)

describe('add-item filters', () => {
  it('weapons include magic weapons built on a base item', () => {
    const ids = run({ category: 'weapon' })
    expect(ids).toContain('longsword')
    expect(ids).toContain('weapon-1')
    expect(ids).not.toContain('chain-mail')
  })

  it('sub-filters for weapon and armor kinds', () => {
    expect(run({ category: 'weapon', sub: 'ranged' })).toContain('longbow')
    expect(run({ category: 'weapon', sub: 'ranged' })).not.toContain('longsword')
    expect(run({ category: 'armor', sub: 'heavy' })).toEqual(expect.arrayContaining(['chain-mail', 'plate-armor']))
    expect(run({ category: 'armor', sub: 'heavy' })).not.toContain('leather-armor')
  })

  it('magic, rarity and attunement', () => {
    const rare = run({ magic: 'magic', rarity: 'rare' })
    expect(rare.length).toBeGreaterThan(0)
    expect(rare).not.toContain('longsword')
    expect(run({ attunement: 'yes' })).toContain('cloak-of-protection')
    expect(run({ attunement: 'no' })).not.toContain('cloak-of-protection')
  })

  it('sorts by cost, cheapest first', () => {
    const byCost = run({ category: 'weapon', magic: 'mundane', sort: 'cost' })
    expect(byCost.indexOf('club')).toBeLessThan(byCost.indexOf('longsword'))
  })
})
