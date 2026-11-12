// Shared helpers for the per-class overlays (scripts/overlay/*.ts).
import type { Edition } from '../../src/content/schema.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any
export type Patch = Record<string, unknown>

/** Per-class overlay: patches by entity id per edition, plus class-table checks. */
export type ClassOverlay = {
  '2014': Record<string, Patch>
  '2024': Record<string, Patch>
  /** [classId, column, table] checked against the source data's class levels. */
  checks?: Partial<Record<Edition, [string, string, Record<number, number>][]>>
}

export const all = 'all' as const
export const shortAndLong = (short: number | 'all' = all) => [
  { on: 'shortRest', amount: short },
  { on: 'longRest', amount: all },
]
export const longOnly = [{ on: 'longRest', amount: all }]

/** A reminder line in the reminders strip, optionally only while a toggle is on. */
export const note = (text: string, toggle?: string) => ({ target: 'note', note: text, ...(toggle ? { when: { toggle } } : {}) })
