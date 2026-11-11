// Inventory entries resolved to what they are in play: a magic "Weapon +1"
// built on a longsword attacks like a longsword; magic armor protects like
// its base armor. Also weight and carrying capacity.
import type { ContentIndex } from '../content'
import type { Armor, Edition, Gear, Item, Weapon } from '../content/schema'
import type { Character, InventoryEntry } from './character'

export type ResolvedEntry = {
  entry: InventoryEntry
  /** The item as listed in content (the magic item for magic weapons/armor). */
  item: Item
  /** Mundane base for magic weapons/armor/ammunition, chosen when the item was added. */
  base?: Item
  weapon?: Weapon
  armor?: Armor
  /** Ammunition kind it supplies (arrows, bolts…). */
  ammoKind?: string
  name: string
}

/** "Weapon +1" on a longsword → "Longsword +1"; "Flame Tongue" on a scimitar → "Flame Tongue (Scimitar)". */
export function magicName(item: Item, base: Item | undefined): string {
  if (!base) return item.name
  const plus = /^(?:Weapon|Armor|Shield|Ammunition),? (\+\d)$/.exec(item.name)
  return plus ? `${base.name} ${plus[1]}` : `${item.name} (${base.name})`
}

export function resolveEntry(entry: InventoryEntry, content: ContentIndex): ResolvedEntry | undefined {
  const item = content.item(entry.itemId)
  if (!item) return undefined
  const base = entry.baseItemId ? content.item(entry.baseItemId) : undefined
  const shape = base ?? item
  const weapon = shape.kind === 'weapon' ? shape : undefined
  const armor = shape.kind === 'armor' ? shape : undefined
  const ammoKind = shape.kind === 'ammunition' ? (shape as Gear).ammoKind : undefined
  return { entry, item, base, weapon, armor, ammoKind, name: entry.label ?? magicName(item, base) }
}

/** Weight of one piece: ammunition is listed per bundle (e.g. 20 arrows weigh 1 lb). */
export function unitWeight(r: ResolvedEntry): number {
  const shape = r.base ?? r.item
  const w = shape.weight ?? 0
  return shape.kind === 'ammunition' && (shape as Gear).bundle ? w / (shape as Gear).bundle! : w
}

/** Coins: 50 to the pound in both editions. */
export const COINS_PER_POUND = 50

const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

/**
 * Carrying capacity in pounds: Strength × 15 for Small and Medium creatures,
 * doubled for each size above Medium and halved for Tiny (both editions).
 * `sizeSteps` counts effects like Powerful Build ("count as one size larger").
 */
export function carryingCapacity(strength: number, size: string, sizeSteps: number): number {
  const index = Math.min(sizeOrder.length - 1, sizeOrder.indexOf(size) + sizeSteps)
  const name = sizeOrder[Math.max(0, index)]
  const factor = name === 'Tiny' ? 0.5 : name === 'Small' || name === 'Medium' ? 1 : 2 ** (index - sizeOrder.indexOf('Medium'))
  return strength * 15 * factor
}

export function totalWeight(char: Character, content: ContentIndex): number {
  let total = 0
  for (const entry of char.inventory) {
    const r = resolveEntry(entry, content)
    if (r) total += unitWeight(r) * entry.quantity
  }
  const coins = Object.values(char.currency).reduce((s, n) => s + n, 0)
  return Math.round((total + coins / COINS_PER_POUND) * 100) / 100
}

/** Can this weapon make the Light-property extra attack (2024: any Light weapon; 2014: light melee weapons)? */
export function offhandEligible(w: Weapon | undefined, edition: Edition) {
  return !!w && w.properties.includes('light') && (edition === '2024' || w.range === 'melee')
}
