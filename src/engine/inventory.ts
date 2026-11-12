// Inventory and money changes as pure functions with history items, like
// actions.ts. Ammunition rules: both SRDs let you recover half of the
// expended ammunition after a fight (2024: rounded down); thrown weapons
// are picked up again.
import type { ContentIndex } from '../content'
import type { ActionResult, HistoryItem } from './actions'
import type { Character, InventoryEntry } from './character'
import type { AttackRow } from './derive'
import { resolveEntry } from './items'

export const ATTUNEMENT_SLOTS = 3
export const coins = ['pp', 'gp', 'ep', 'sp', 'cp'] as const
export type Coin = (typeof coins)[number]

const ok = (character: Character, groupType: string, items: HistoryItem[]): ActionResult => ({ ok: true, character, items, groupType, kind: 'game' })
const newUid = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

function update(char: Character, uid: string, patch: Partial<InventoryEntry>): Character {
  return { ...char, inventory: char.inventory.map((e) => (e.uid === uid ? { ...e, ...patch } : e)) }
}

function nameOf(char: Character, content: ContentIndex, uid: string) {
  const e = char.inventory.find((x) => x.uid === uid)
  return (e && resolveEntry(e, content)?.name) ?? e?.itemId ?? uid
}

/** Add items. Mundane stackables (gear, ammunition, potions) merge into an existing stack. */
export function addItem(char: Character, content: ContentIndex, itemId: string, quantity = 1, baseItemId?: string): ActionResult {
  const item = content.item(itemId)
  if (!item) return { ok: false, error: 'unknownItem' }
  if (!(quantity > 0)) return { ok: false, error: 'positiveAmount' }
  if (item.kind !== 'weapon' && item.kind !== 'armor' && 'baseKind' in item && item.baseKind && !baseItemId) return { ok: false, error: 'chooseBase' }
  const stackable = !item.attunement && !item.charges && item.kind !== 'armor'
  const existing = stackable ? char.inventory.find((e) => e.itemId === itemId && e.baseItemId === baseItemId && !e.label) : undefined
  if (existing) {
    const after = existing.quantity + quantity
    return ok(update(char, existing.uid, { quantity: after }), 'inventory', [
      { type: 'quantity', params: { name: nameOf(char, content, existing.uid) }, before: existing.quantity, after, entity: itemId },
    ])
  }
  const entry: InventoryEntry = {
    uid: newUid(), itemId, quantity, equipped: false, attuned: false, twoHanded: false, chargesUsed: 0, ...(baseItemId ? { baseItemId } : {}),
  }
  const next = { ...char, inventory: [...char.inventory, entry] }
  return ok(next, 'inventory', [{ type: 'itemAdded', params: { name: nameOf(next, content, entry.uid), count: quantity }, entity: itemId }])
}

export function removeItem(char: Character, content: ContentIndex, uid: string): ActionResult {
  const e = char.inventory.find((x) => x.uid === uid)
  if (!e) return { ok: false, error: 'unknownItem' }
  return ok({ ...char, inventory: char.inventory.filter((x) => x.uid !== uid) }, 'inventory', [
    { type: 'itemRemoved', params: { name: nameOf(char, content, uid), count: e.quantity }, entity: e.itemId },
  ])
}

export function setQuantity(char: Character, content: ContentIndex, uid: string, quantity: number): ActionResult {
  const e = char.inventory.find((x) => x.uid === uid)
  if (!e) return { ok: false, error: 'unknownItem' }
  if (quantity < 0) return { ok: false, error: 'notEnoughItems', params: { name: nameOf(char, content, uid) } }
  const q = Math.round(quantity)
  if (q === e.quantity) return { ok: false, error: 'noChange' }
  return ok(update(char, uid, { quantity: q }), 'inventory', [{ type: 'quantity', params: { name: nameOf(char, content, uid) }, before: e.quantity, after: q, entity: e.itemId }])
}

/**
 * Equip or unequip. Only one body armor and one shield can be worn: putting
 * one on takes the other off. Taking off an attuned item keeps the attunement.
 */
export function toggleEquip(char: Character, content: ContentIndex, uid: string): ActionResult {
  const r = char.inventory.map((e) => resolveEntry(e, content)).find((x) => x?.entry.uid === uid)
  if (!r) return { ok: false, error: 'unknownItem' }
  const on = !r.entry.equipped
  const items: HistoryItem[] = []
  let next = update(char, uid, { equipped: on })
  if (on && r.armor) {
    const slot = r.armor.category === 'shield' ? 'shield' : 'body'
    for (const other of char.inventory) {
      if (other.uid === uid || !other.equipped) continue
      const o = resolveEntry(other, content)
      if (o?.armor && (o.armor.category === 'shield' ? 'shield' : 'body') === slot) {
        next = update(next, other.uid, { equipped: false })
        items.push({ type: 'unequipped', params: { name: o.name }, entity: other.itemId })
      }
    }
  }
  items.unshift({ type: on ? 'equipped' : 'unequipped', params: { name: r.name }, entity: r.entry.itemId })
  return ok(next, 'equip', items)
}

/** `slots`: attunement limit (3, or more from features such as the 2024 Thief's Use Magic Device). */
export function toggleAttune(char: Character, content: ContentIndex, uid: string, slots = ATTUNEMENT_SLOTS): ActionResult {
  const e = char.inventory.find((x) => x.uid === uid)
  if (!e) return { ok: false, error: 'unknownItem' }
  if (!e.attuned && char.inventory.filter((x) => x.attuned).length >= slots) return { ok: false, error: 'attunementFull' }
  return ok(update(char, uid, { attuned: !e.attuned }), 'equip', [{ type: e.attuned ? 'unattuned' : 'attuned', params: { name: nameOf(char, content, uid) }, entity: e.itemId }])
}

export function setTwoHanded(char: Character, content: ContentIndex, uid: string, twoHanded: boolean): ActionResult {
  return ok(update(char, uid, { twoHanded }), 'equip', [{ type: twoHanded ? 'twoHanded' : 'oneHanded', params: { name: nameOf(char, content, uid) } }])
}

export function selectAmmo(char: Character, content: ContentIndex, weaponUid: string, ammoUid: string): ActionResult {
  return ok(update(char, weaponUid, { ammoUid }), 'equip', [{ type: 'ammoSelected', params: { name: nameOf(char, content, weaponUid), ammo: nameOf(char, content, ammoUid) } }])
}

/** Money never goes negative: such a change is refused. */
export function adjustCoin(char: Character, coin: Coin, delta: number): ActionResult {
  const before = char.currency[coin]
  const after = before + Math.round(delta)
  if (after < 0) return { ok: false, error: 'notEnoughMoney', params: { coin: coin.toUpperCase() } }
  if (after === before) return { ok: false, error: 'noChange' }
  return ok({ ...char, currency: { ...char.currency, [coin]: after } }, 'money', [{ type: 'coin', params: { coin: coin.toUpperCase() }, before, after }])
}

export function setCoin(char: Character, coin: Coin, value: number): ActionResult {
  return adjustCoin(char, coin, Math.round(value) - char.currency[coin])
}

export function setAmmoTracking(char: Character, on: boolean): ActionResult {
  return ok({ ...char, settings: { ...char.settings, trackAmmunition: on } }, 'settings', [{ type: on ? 'ammoTrackingOn' : 'ammoTrackingOff' }])
}

/**
 * Bookkeeping for one attack: fired ammunition is counted for recovery,
 * thrown weapons are counted as lying on the battlefield, reload weapons
 * fire from their magazine.
 */
export function trackShot(char: Character, attack: AttackRow): Character {
  let next = char
  if (attack.loaded && attack.item) {
    next = update(next, attack.item.uid, { loaded: Math.max(0, attack.loaded.rounds - 1) })
  }
  const uid = attack.ammo?.uid
  if (!uid) return next
  if (attack.properties.includes('ammunition')) {
    next = { ...next, ammoSpent: { ...next.ammoSpent, [uid]: (next.ammoSpent[uid] ?? 0) + 1 } }
  } else if (attack.properties.includes('thrown')) {
    next = { ...next, thrownOut: { ...next.thrownOut, [uid]: (next.thrownOut[uid] ?? 0) + 1 } }
  }
  return next
}

/** After a fight: get back half of the fired ammunition (rounded down). */
export function recoverAmmo(char: Character, content: ContentIndex): ActionResult {
  const items: HistoryItem[] = []
  let next: Character = { ...char, ammoSpent: {} }
  for (const [uid, spent] of Object.entries(char.ammoSpent)) {
    const e = next.inventory.find((x) => x.uid === uid)
    const r = e && resolveEntry(e, content)
    const shape = r && (r.base ?? r.item)
    const back = Math.floor(spent / 2)
    if (!e || back === 0 || !(shape && 'recoverable' in shape && shape.recoverable !== false)) continue
    next = update(next, uid, { quantity: e.quantity + back })
    items.push({ type: 'recovered', params: { name: r!.name, count: back, spent }, before: e.quantity, after: e.quantity + back, entity: e.itemId })
  }
  if (!items.length && !Object.keys(char.ammoSpent).length) return { ok: false, error: 'nothingToRecover' }
  return ok(next, 'recover', items.length ? items : [{ type: 'recoveredNone' }])
}

/** Pick up thrown weapons again. */
export function pickUpThrown(char: Character, content: ContentIndex): ActionResult {
  const items: HistoryItem[] = []
  let next: Character = { ...char, thrownOut: {} }
  for (const [uid, count] of Object.entries(char.thrownOut)) {
    const e = next.inventory.find((x) => x.uid === uid)
    if (!e || count === 0) continue
    next = update(next, uid, { quantity: e.quantity + count })
    items.push({ type: 'pickedUp', params: { name: nameOf(char, content, uid), count }, before: e.quantity, after: e.quantity + count, entity: e.itemId })
  }
  if (!items.length) return { ok: false, error: 'nothingToRecover' }
  return ok(next, 'recover', items)
}

/** Fill a reload weapon's magazine from its ammunition. */
export function reload(char: Character, attack: AttackRow): ActionResult {
  if (!attack.loaded || !attack.item) return { ok: false, error: 'noReload' }
  const need = attack.loaded.size - attack.loaded.rounds
  const ammoEntry = attack.ammo?.uid ? char.inventory.find((e) => e.uid === attack.ammo!.uid) : undefined
  const take = Math.min(need, ammoEntry?.quantity ?? (char.settings.trackAmmunition ? 0 : need))
  if (take <= 0) return { ok: false, error: need ? 'noAmmo' : 'noChange' }
  let next = update(char, attack.item.uid, { loaded: attack.loaded.rounds + take })
  if (ammoEntry && char.settings.trackAmmunition) next = update(next, ammoEntry.uid, { quantity: ammoEntry.quantity - take })
  return ok(next, 'reload', [{ type: 'reloaded', params: { name: attack.name }, before: attack.loaded.rounds, after: attack.loaded.rounds + take }])
}
