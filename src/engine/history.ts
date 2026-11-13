// History groups and undo, as pure functions (stored by state/history.ts).
import type { HistoryItem, HistoryKind } from './actions'
import type { Character } from './character'

export type HistoryGroup = {
  id: string
  /** Client time in ms; ordering works offline too. */
  at: number
  kind: HistoryKind
  groupType: string
  items: HistoryItem[]
  /** Previous values of the top-level character fields this group changed. */
  revert?: Record<string, unknown>
  /** For undo groups: the group that was undone. */
  undoes?: string
  /** Attacks made within one Attack action share this id (shown together in history). */
  actionId?: string
}

/** Firestore can't store `undefined`; JSON round-trip drops it. */
export const clean = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

/** Changed top-level fields: new values for the character, old values for undo. */
export function diff(before: Character, after: Character) {
  const patch: Record<string, unknown> = {}
  const revert: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Character>) {
    if (key === 'id') continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      patch[key] = clean(after[key]) ?? null
      revert[key] = clean(before[key]) ?? null
    }
  }
  return { patch, revert }
}

/** Swap before/after so an undo group reads as the reverse change. */
const reversed = (items: HistoryItem[]): HistoryItem[] =>
  items.map((i) => (i.before === undefined && i.after === undefined ? i : { ...i, before: i.after, after: i.before }))

export function makeUndoGroup(group: HistoryGroup): Omit<HistoryGroup, 'id' | 'at'> {
  return {
    kind: group.kind,
    groupType: 'undo',
    undoes: group.id,
    items: [{ type: 'undo', params: { what: group.groupType } }, ...reversed(group.items.filter((i) => i.before !== undefined || i.after !== undefined))],
  }
}

/** The newest group that can still be undone (undo works like a stack). */
export function undoable(history: HistoryGroup[]): HistoryGroup | undefined {
  const undone = new Set(history.filter((g) => g.undoes).map((g) => g.undoes))
  for (const g of history) {
    if (g.undoes || undone.has(g.id)) continue
    if (g.groupType === 'session' || g.groupType === 'note') continue
    return g.revert ? g : undefined
  }
  return undefined
}


const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Take back one change (`before` → `after`) from a value that may have changed again since (`current`):
 * untouched parts go back, numbers keep the later change as a difference (HP after a rest and
 * later damage), anything else changed later stays as it is now.
 */
export function rebase(before: unknown, after: unknown, current: unknown): unknown {
  if (same(current, after)) return before
  if (typeof before === 'number' && typeof after === 'number' && typeof current === 'number') return Math.max(0, current - (after - before))
  if (isObject(current) && (isObject(before) || before == null) && (isObject(after) || after == null)) {
    const b = before ?? {}
    const a = after ?? {}
    const out: Record<string, unknown> = { ...current }
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (same(a[k], b[k])) continue
      const v = rebase(b[k], a[k], current[k])
      if (v === undefined || v === null) delete out[k]
      else out[k] = v
    }
    return out
  }
  return current
}

/**
 * Undo an older group (the last rest or level up) although other changes came after it.
 * The later groups' stored "before" values tell what the group itself set; those changes are
 * taken back from the current character without losing what happened since.
 */
export function undoPast(current: Character, group: HistoryGroup, history: HistoryGroup[]): Character {
  if (!group.revert) return current
  const index = history.indexOf(group)
  const undone = new Set(history.filter((g) => g.undoes).map((g) => g.undoes))
  // Newer groups, oldest first, that still apply.
  const later = history.slice(0, index).reverse().filter((g) => g.revert && !g.undoes && !undone.has(g.id))
  const next = { ...current } as Record<string, unknown>
  for (const [field, beforeG] of Object.entries(group.revert)) {
    const touching = later.find((g) => field in g.revert!)
    const afterG = touching ? touching.revert![field] : (current as Record<string, unknown>)[field]
    const value = rebase(beforeG, afterG, (current as Record<string, unknown>)[field])
    if (value === null || value === undefined) delete next[field]
    else next[field] = value
  }
  return next as Character
}

/** The newest rest and the newest level up, which history can still undo out of order. */
export function pastUndoable(history: HistoryGroup[]): Set<string> {
  const undone = new Set(history.filter((g) => g.undoes).map((g) => g.undoes))
  const out = new Set<string>()
  for (const types of [['shortRest', 'longRest'], ['levelUp']]) {
    const g = history.find((x) => types.includes(x.groupType))
    if (g && g.revert && !undone.has(g.id)) out.add(g.id)
  }
  return out
}
