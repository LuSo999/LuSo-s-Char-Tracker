// Character creation: ability scores, starting equipment, the new character.
// Rules: SRD 5.2.1 "Creating a Character" (standard array, point cost, 4d6),
// SRD 5.1 / 5.2.1 class and background starting equipment.
import type { ContentIndex } from '../content'
import type { Ability, EquipmentChoice, Item } from '../content/schema'
import { Character, type CharacterInput, type InventoryEntry } from './character'
import { computeSheet } from './derive'

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

/** Point cost of a score (8–15), 27 points in total. */
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const POINT_BUDGET = 27
export const pointsSpent = (scores: Record<Ability, number>) => Object.values(scores).reduce((s, v) => s + (POINT_COST[v] ?? 99), 0)

/** SRD 5.2.1 "Standard Array by Class": suggested placement (Str, Dex, Con, Int, Wis, Cha). */
export const STANDARD_BY_CLASS: Record<string, number[]> = {
  barbarian: [15, 13, 14, 10, 12, 8],
  bard: [8, 14, 12, 13, 10, 15],
  cleric: [14, 8, 13, 10, 15, 12],
  druid: [8, 12, 14, 13, 15, 10],
  fighter: [15, 14, 13, 8, 10, 12],
  monk: [12, 15, 13, 10, 14, 8],
  paladin: [15, 10, 13, 8, 12, 14],
  ranger: [12, 15, 13, 8, 14, 10],
  rogue: [12, 15, 13, 14, 10, 8],
  sorcerer: [10, 13, 14, 8, 12, 15],
  warlock: [8, 14, 13, 12, 10, 15],
  wizard: [8, 12, 13, 15, 14, 10],
}

/** Four d6, the lowest dropped. */
export function roll4d6(random: () => number = Math.random): { dice: number[]; total: number } {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6))
  const total = [...dice].sort((a, b) => b - a).slice(0, 3).reduce((s, d) => s + d, 0)
  return { dice, total }
}

/** Minimum XP for each level (both editions). */
export const XP_FOR_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

/** 2024 background increases: +2/+1 or +1/+1/+1 among the background's three abilities. */
export function validBackgroundBonuses(options: Ability[], bonuses: Partial<Record<Ability, number>>): boolean {
  const entries = Object.entries(bonuses).filter(([, v]) => v)
  if (entries.some(([a]) => !options.includes(a as Ability))) return false
  const values = entries.map(([, v]) => v!).sort()
  return JSON.stringify(values) === '[1,2]' || JSON.stringify(values) === '[1,1,1]'
}

// --- Starting equipment ----------------------------------------------------------------

/** Per equipment choice: the option taken and the items picked for each of its picks. */
export type EquipmentSelection = { option: number; picks: string[][] }[]

export type StartingGear = { items: { id: string; count: number }[]; gp: number }

/** Items and coins from fixed items, the chosen options and picks. */
export function startingGear(source: { startingItems: { id: string; count: number }[]; startingGold: number; startingEquipment: EquipmentChoice[] }, selection: EquipmentSelection): StartingGear {
  const items = [...source.startingItems]
  let gp = source.startingGold
  source.startingEquipment.forEach((choice, i) => {
    const sel = selection[i]
    const option = choice.options[sel?.option ?? 0]
    if (!option) return
    items.push(...option.items)
    gp += option.gp
    option.picks.forEach((pick, p) => {
      for (const id of (sel?.picks[p] ?? []).slice(0, pick.count)) items.push({ id, count: 1 })
    })
  })
  return { items, gp }
}

/** Every pick of the chosen options is filled. */
export function gearComplete(choices: EquipmentChoice[], selection: EquipmentSelection): boolean {
  return choices.every((c, i) => {
    const option = c.options[selection[i]?.option ?? 0]
    return !option || option.picks.every((pick, p) => (selection[i]?.picks[p] ?? []).length >= Math.min(pick.count, pick.from.length))
  })
}

let uidCounter = 0
const newUid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Inventory entries: same items stack; body armor, a shield and weapons
 * start equipped (the first body armor only).
 */
export function gearInventory(content: ContentIndex, gear: StartingGear): InventoryEntry[] {
  const merged = new Map<string, number>()
  for (const it of gear.items) merged.set(it.id, (merged.get(it.id) ?? 0) + it.count)
  const out: InventoryEntry[] = []
  let armorOn = false
  for (const [id, quantity] of merged) {
    const item: Item | undefined = content.item(id)
    if (!item) continue
    let equipped = false
    if (item.kind === 'weapon') equipped = true
    if (item.kind === 'armor' && item.category === 'shield') equipped = true
    if (item.kind === 'armor' && item.category !== 'shield' && !armorOn) equipped = armorOn = true
    out.push({ uid: newUid(), itemId: id, quantity, equipped, attuned: false, twoHanded: false, chargesUsed: 0 })
  }
  return out
}

// --- The new character -------------------------------------------------------------

export type Draft = {
  edition: '2014' | '2024'
  name: string
  classId: string
  speciesId: string
  subspeciesId?: string
  backgroundId: string
  baseScores: Record<Ability, number>
  backgroundBonuses: Partial<Record<Ability, number>>
  choices: Record<string, string[]>
  spells: Character['spells']
  inventory: InventoryEntry[]
  gp: number
  notes: string
}

/** A level 1 character from the draft, at full HP. */
export function buildCharacter(content: ContentIndex, d: Draft): Character {
  const input: CharacterInput = {
    id: 'new',
    name: d.name.trim() || 'New character',
    edition: d.edition,
    classes: [{ classId: d.classId, level: 1, hpRolls: [] }],
    levelOrder: [d.classId],
    speciesId: d.speciesId,
    subspeciesId: d.subspeciesId,
    backgroundId: d.backgroundId,
    baseScores: d.baseScores,
    backgroundBonuses: d.edition === '2024' ? d.backgroundBonuses : {},
    choices: d.choices,
    spells: d.spells,
    inventory: d.inventory,
    currency: { cp: 0, sp: 0, ep: 0, gp: Math.floor(d.gp), pp: 0 },
    hp: { current: 1, temp: 0 },
    notes: d.notes,
  }
  const c = Character.parse(input)
  return { ...c, hp: { current: computeSheet(c, content).hpMax.value, temp: 0 } }
}
