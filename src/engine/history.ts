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

