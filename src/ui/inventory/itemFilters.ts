// Filters and sorting for the "Add item" search. Magic weapons and armor
// built on a base item ("Weapon +1") count as weapons / armor.
import type { Item } from '../../content/schema'

export const categories = ['all', 'weapon', 'armor', 'ammunition', 'potion', 'gear', 'wondrous'] as const
export type Category = (typeof categories)[number]

export const rarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies'] as const

export type ItemFilters = {
  query: string
  category: Category
  magic: 'all' | 'magic' | 'mundane'
  rarity: string
  attunement: 'all' | 'yes' | 'no'
  /** Weapons: simple / martial / melee / ranged. Armor: light / medium / heavy / shield. */
  sub: string
  book: string
  sort: 'name' | 'cost' | 'rarity'
  /** Items of this edition only, or both editions. */
  edition: 'this' | 'both'
}

export const defaultFilters: ItemFilters = { query: '', category: 'all', magic: 'all', rarity: '', attunement: 'all', sub: '', book: '', sort: 'name', edition: 'this' }

export function categoryOf(i: Item): Exclude<Category, 'all'> {
  if (i.kind === 'weapon' || ('baseKind' in i && i.baseKind === 'weapon')) return 'weapon'
  if (i.kind === 'armor' || ('baseKind' in i && (i.baseKind === 'armor' || i.baseKind === 'shield'))) return 'armor'
  if (i.kind === 'ammunition' || ('baseKind' in i && i.baseKind === 'ammunition')) return 'ammunition'
  if (i.kind === 'potion') return 'potion'
  if (i.magic) return 'wondrous'
  return 'gear'
}

/** Rarity text in the data varies ("Very Rare", "very rare (+2)"); compare on the leading words. */
export function rarityOf(i: Item): string | undefined {
  const r = i.rarity?.toLowerCase() ?? ''
  return rarities.find((x) => r.startsWith(x))
}

const toCopper: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
export const costInCopper = (i: Item) => (i.cost ? i.cost.amount * toCopper[i.cost.unit] : Number.POSITIVE_INFINITY)

/** Sub-filter: matches simple/martial/melee/ranged weapons and light/medium/heavy/shield armor (plain items only). */
function subMatches(i: Item, sub: string) {
  if (!sub) return true
  if (i.kind === 'weapon') return i.category === sub || i.range === sub
  if (i.kind === 'armor') return i.category === sub
  // Magic items built on a base: a shield variant counts as "shield", anything else passes.
  if ('baseKind' in i && i.baseKind) return sub === 'shield' ? i.baseKind === 'shield' : i.baseKind !== 'shield' || sub === 'shield'
  return false
}

export function filterItems(items: Item[], f: ItemFilters, bookOf: (i: Item) => string): Item[] {
  const q = f.query.trim().toLowerCase()
  const out = items.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q)) &&
      (f.category === 'all' || categoryOf(i) === f.category) &&
      (f.magic === 'all' || (f.magic === 'magic') === i.magic) &&
      (!f.rarity || rarityOf(i) === f.rarity) &&
      (f.attunement === 'all' || (f.attunement === 'yes') === i.attunement) &&
      subMatches(i, f.sub) &&
      (!f.book || bookOf(i) === f.book),
  )
  const rank = (i: Item) => {
    const r = rarityOf(i)
    return r ? (rarities as readonly string[]).indexOf(r) : -1
  }
  return out.sort((a, b) =>
    f.sort === 'cost' ? costInCopper(a) - costInCopper(b) || a.name.localeCompare(b.name) : f.sort === 'rarity' ? rank(a) - rank(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name),
  )
}
