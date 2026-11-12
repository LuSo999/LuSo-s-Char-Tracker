// Shared helpers for the per-class overlays (scripts/overlay/*.ts).
import type { Edition } from '../../src/content/schema.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any
export type Patch = Record<string, unknown>

/** Per-class overlay: patches by entity id per edition, plus class-table checks. */
export type ClassOverlay = {
  '2014': Record<string, Patch>
  '2024': Record<string, Patch>
  /** New entities (e.g. options the SRD only lists in prose), added before the patches. */
  entities?: Partial<Record<Edition, Raw[]>>
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

/** 2014 Fighting Style options shared by Fighter, Paladin and Ranger (SRD 5.1). */
export const fightingStyleEffects2014: Record<string, Patch> = {
  archery: { effects: [{ target: 'attack', value: 2, when: 'rangedWeapon' }] },
  defense: { effects: [{ target: 'ac', value: 1, when: 'wearingArmor' }] },
  dueling: { effects: [{ target: 'damage', value: 2, when: { toggle: 'One-handed melee weapon, no other weapon' } }] },
  'two-weapon-fighting': { effects: [{ target: 'offhandAbilityMod', value: 1 }] },
  protection: {
    activities: [{ id: 'use', name: 'Protection', actionType: 'reaction', summary: 'With a shield: impose disadvantage on an attack against a creature within 5 ft of you.' }],
  },
}

/** A feature option the SRD only describes in prose. */
export const option = (edition: Edition, id: string, name: string, parent: string, optionOf: string, description: string, patch: Patch = {}) => ({
  id, edition, type: 'feature', name, description, parent, optionOf, source: { book: edition === '2014' ? 'srd-5.1' : 'srd-5.2' }, ...patch,
})
