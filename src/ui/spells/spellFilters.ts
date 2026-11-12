// Filters for the Spellcasting panel. Pure, so they can be tested.
import type { ActionType } from '../../content/schema'
import type { Sheet } from '../../engine/derive'
import { castOptions } from '../../engine/spellActions'
import type { SpellRow } from '../../engine/spells'

export type SpellFilters = {
  query: string
  /** Spell levels to show; empty = all. */
  levels: number[]
  actionType: ActionType | 'all'
  favorites: boolean
  /** Only spells that can be cast right now (a slot, a free cast or a ritual is available). */
  castable: boolean
  concentration: 'all' | 'yes' | 'no'
  ritual: boolean
  kind: 'all' | 'attack' | 'save' | 'heal' | 'damage'
  school: string
  /** "class:<id>" or "granted". */
  source: string
  sort: 'level' | 'name'
}

export const defaultSpellFilters: SpellFilters = {
  query: '', levels: [], actionType: 'all', favorites: false, castable: false, concentration: 'all', ritual: false, kind: 'all', school: '', source: '', sort: 'level',
}

export function filterSpells(rows: SpellRow[], f: SpellFilters, sheet: Sheet, favorites: string[]): SpellRow[] {
  const q = f.query.trim().toLowerCase()
  return rows
    .filter((r) => {
      const s = r.spell
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (f.levels.length && !f.levels.includes(s.level)) return false
      if (f.actionType !== 'all' && s.actionType !== f.actionType) return false
      if (f.favorites && !favorites.includes(s.id)) return false
      if (f.castable && castOptions(r, sheet).length === 0) return false
      if (f.concentration !== 'all' && s.concentration !== (f.concentration === 'yes')) return false
      if (f.ritual && !s.ritual) return false
      if (f.kind === 'attack' && !s.attack) return false
      if (f.kind === 'save' && !s.save) return false
      if (f.kind === 'heal' && !s.heal) return false
      if (f.kind === 'damage' && !s.damage) return false
      if (f.school && s.school !== f.school) return false
      if (f.source === 'granted' && !r.always) return false
      if (f.source.startsWith('class:') && r.classId !== f.source.slice(6)) return false
      return true
    })
    .sort((a, b) => (f.sort === 'name' ? a.spell.name.localeCompare(b.spell.name) : a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name)))
}
