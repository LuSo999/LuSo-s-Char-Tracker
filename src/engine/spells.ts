// Spellcasting: spell slots (own table, multiclass table, Pact Magic), how
// many cantrips and spells a class knows or prepares, every spell the
// character can cast and its save DC, attack bonus, damage and healing.
//
// Multiclass slots (SRD 5.1 / 5.2.1 "Multiclassing → Spellcasting"): add all
// levels of full casters and half the levels of Paladin and Ranger — rounded
// down in 2014, rounded up in 2024 — and read the Multiclass Spellcaster
// table (the full-caster slot table). Pact Magic slots stay separate.
import type { ContentIndex } from '../content'
import type { Ability, Class, Resource, Spell, SwapRule } from '../content/schema'
import type { Character } from './character'
import { selections, type ActiveEntity, type Value } from './derive'
import { evalFormula, resolveScaled, type FormulaVars } from './formula'

export type CasterState = {
  classId: string
  name: string
  level: number
  ability: Ability
  dc: number
  attack: number
  mode: 'known' | 'prepared'
  spellbook: boolean
  ritual: 'none' | 'prepared' | 'book'
  cantripsMax: number
  /** Leveled spells known (5e known casters) or prepared (everyone else). */
  spellsMax: number
  /** Highest spell level this class can learn or prepare. */
  maxSpellLevel: number
  cantrips: string[]
  /** Known spells (known casters) or the spellbook (Wizard). */
  known: string[]
  prepared: string[]
  pact: boolean
  /** Extra spells on this class's list (2014 Fiend: Expanded Spell List). */
  expanded: string[]
  /** Wizard: spells the spellbook gets for free (6 + 2 per level); more only by copying. */
  spellbookMax?: number
  /** Wizard: the free places by highest spell level (see spellbookPlaces). */
  spellbookPlaces?: number[]
  /** Class whose spell list it learns from (Eldritch Knight: "wizard"). */
  spellList: string
  /** full / half / third / pact: for the multiclass slot table. */
  progression: string
  /** 2014 Eldritch Knight / Arcane Trickster: allowed schools, and how many spells may be from any school. */
  schools?: string[]
  anySchool?: number
  /** When cantrips / spells may be replaced, and how many replacements are used up. */
  swap: { cantrips: SwapRule; spells: SwapRule }
  swapsUsed: { cantrips: number; spells: number }
}

export type SpellRow = {
  key: string
  spell: Spell
  /** Class it is cast through, or the entity that grants it. */
  classId?: string
  grantedBy?: ActiveEntity
  ability: Ability
  dc: number
  attackBonus: number
  /** Cast with slots (prepared / known / always prepared). */
  castable: boolean
  /** Granted spells don't count against class limits. */
  always: boolean
  /** Wizard: a ritual in the spellbook that isn't prepared can still be cast as a ritual. */
  ritualOnly: boolean
  canRitual: boolean
  /** Resource for casting it once without a slot (Magic Initiate). */
  freeCast?: string
  /** Cast without a slot at will (Eldritch Invocations). */
  atWill?: boolean
  /** Casting with a slot also spends one use of this resource. */
  limit?: string
  /** Level of the free cast, if higher than the spell's own. */
  freeLevel?: number
  /** Added to the damage (Agonizing Blast: Charisma modifier). */
  damageBonus?: number
  /** Only the free cast / at will (spells from items, 2014 Drow Magic): no slots. */
  freeOnly?: boolean
  /** Uses of freeCast per cast. */
  freeCost?: number
  /** What features change about it (Eldritch Spear: range +30 ft per level). */
  notes: string[]
}

export type SlotLevel = { level: number; max: number; key: string }

export type Spellcasting = {
  casters: CasterState[]
  /** Regular slots by level (resource keys "slot:<level>"). */
  slots: SlotLevel[]
  /** Pact Magic: all slots share one level (resource key "pact"). */
  pact?: SlotLevel
  rows: SpellRow[]
  /** Resources for the slots, added to the sheet's resources (rests restore them). */
  resources: Resource[]
  /** Whether the character casts anything at all (shows the Spellcasting panel). */
  any: boolean
}

const halfRound = (level: number, edition: string) => (edition === '2014' ? Math.floor(level / 2) : Math.ceil(level / 2))

function tableRow(cls: Class, level: number) {
  let row: Class['spellTable'][string] | undefined
  for (let l = 1; l <= level; l++) row = cls.spellTable[l] ?? row
  return row
}

/** Expected spellbook size of a Wizard: 6 at level 1, +2 per Wizard level. */
export const spellbookSize = (level: number) => 6 + 2 * (level - 1)

/**
 * The free places in a Wizard's spellbook, as the highest spell level each
 * may hold: six level 1 spells at level 1, then two per Wizard level of a
 * level the Wizard has slots for at that level.
 */
export function spellbookPlaces(cls: Class, level: number): number[] {
  const places = [1, 1, 1, 1, 1, 1]
  for (let l = 2; l <= level; l++) {
    const slots = tableRow(cls, l)?.slots ?? []
    const max = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 1)
    places.push(max, max)
  }
  return places
}

/** Fit the book's spells into the free places (highest levels first, each in the lowest place that holds it). */
function fitSpellbook(places: number[], spellLevels: number[]): { fitted: number; free: number[] } {
  const free = [...places].sort((a, b) => a - b)
  let fitted = 0
  for (const lvl of [...spellLevels].sort((a, b) => b - a)) {
    const i = free.findIndex((p) => p >= lvl)
    if (i < 0) continue
    free.splice(i, 1)
    fitted++
  }
  return { fitted, free }
}

/** How many of the spells fit the free places. */
export const spellbookFitting = (places: number[], spellLevels: number[]) => fitSpellbook(places, spellLevels).fitted

/** Free places still empty, by highest spell level, e.g. [1, 2, 2]. */
export const spellbookFree = (places: number[], spellLevels: number[]) => fitSpellbook(places, spellLevels).free

/** Key of a swap counter in Character.spellSwaps. */
export const swapKey = (classId: string, what: 'cantrips' | 'spells', rule: SwapRule) => `${classId}:${what}:${rule === 'levelUp' ? 'levelUp' : 'longRest'}`

const swapsUsed = (char: Character, classId: string, what: 'cantrips' | 'spells', rule: SwapRule) => char.spellSwaps[swapKey(classId, what, rule)] ?? 0

export function computeSpellcasting(
  char: Character,
  content: ContentIndex,
  active: ActiveEntity[],
  ctx: { pb: number; mods: Record<Ability, number>; characterLevel: number; dcBonus: number; attackBonus: number; classBonus?: (classId: string) => { dc: number; attack: number } },
): Spellcasting {
  const casters: CasterState[] = []
  for (const entry of char.classes) {
    const klass = content.getTyped(entry.classId, 'class')
    if (!klass) continue
    // A class casts on its own, or through its subclass (Eldritch Knight, Arcane Trickster).
    const sub = entry.subclassId ? content.getTyped(entry.subclassId, 'subclass') : undefined
    const source = klass.caster ? klass : sub?.caster ? sub : undefined
    if (!source?.caster) continue
    const cls = { ...klass, caster: source.caster, spellTable: source.spellTable, spellcasting: source.spellcasting }
    const row = tableRow(cls, entry.level)
    const slots = row?.slots ?? []
    const vars: FormulaVars = { ...ctx.mods, pb: ctx.pb, level: entry.level, classLevel: entry.level, characterLevel: ctx.characterLevel }
    const spellsMax =
      cls.caster.mode === 'known' ? (row?.known ?? 0) : cls.caster.preparedFormula ? Math.max(1, Math.floor(evalFormula(cls.caster.preparedFormula, vars))) : (row?.prepared ?? 0)
    const maxSpellLevel = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0)
    if (!row || (!maxSpellLevel && !row.cantrips)) continue
    const mod = ctx.mods[cls.caster.ability]
    const state = char.spells[cls.id] ?? { known: [], prepared: [] }
    const isCantrip = (id: string) => content.getTyped(id, 'spell')?.level === 0
    casters.push({
      classId: cls.id,
      name: cls.name,
      level: entry.level,
      ability: cls.caster.ability,
      dc: 8 + ctx.pb + mod + ctx.dcBonus + (ctx.classBonus?.(cls.id).dc ?? 0),
      attack: ctx.pb + mod + ctx.attackBonus + (ctx.classBonus?.(cls.id).attack ?? 0),
      mode: cls.caster.mode,
      spellbook: cls.caster.spellbook,
      ritual: cls.caster.ritual,
      cantripsMax: row.cantrips,
      spellsMax,
      maxSpellLevel,
      cantrips: state.known.filter(isCantrip),
      known: state.known.filter((id) => !isCantrip(id)),
      prepared: state.prepared,
      pact: cls.spellcasting === 'pact',
      spellbookMax: cls.caster.spellbook ? spellbookSize(entry.level) : undefined,
      spellbookPlaces: cls.caster.spellbook ? spellbookPlaces(cls, entry.level) : undefined,
      swap: cls.caster.swap,
      swapsUsed: { cantrips: swapsUsed(char, cls.id, 'cantrips', cls.caster.swap.cantrips), spells: swapsUsed(char, cls.id, 'spells', cls.caster.swap.spells) },
      expanded: [...(cls.caster.extraSpells ?? []), ...active.filter((ae) => ae.classId === cls.id || (!ae.classId && !ae.item)).flatMap((ae) => ae.entity.expandedSpells ?? [])],
      spellList: cls.caster.spellList ?? cls.id,
      progression: cls.spellcasting,
      schools: cls.caster.schools,
      anySchool: cls.caster.anySchool !== undefined ? resolveScaled(cls.caster.anySchool, vars) : undefined,
    })
  }

  // Slots: one regular caster uses its own table; several use the multiclass (full-caster) table.
  const regular = casters.filter((c) => !c.pact)
  let slotCounts: number[] = []
  if (regular.length === 1) {
    const only = char.classes.find((e) => e.classId === regular[0].classId)
    const sub = only?.subclassId ? content.getTyped(only.subclassId, 'subclass') : undefined
    const table = sub?.caster ? sub : content.require(regular[0].classId, 'class')
    slotCounts = tableRow(table as Class, regular[0].level)?.slots ?? []
  } else if (regular.length > 1) {
    const casterLevel = regular.reduce((sum, c) => {
      // Multiclass Spellcaster: full levels, half (Paladin, Ranger), a third rounded down (Eldritch Knight, Arcane Trickster).
      const kind = c.progression
      return sum + (kind === 'full' ? c.level : kind === 'half' ? halfRound(c.level, char.edition) : kind === 'third' ? Math.floor(c.level / 3) : 0)
    }, 0)
    const fullTable = content.all('class').find((k) => k.spellcasting === 'full' && k.caster)
    slotCounts = (fullTable && tableRow(fullTable, casterLevel)?.slots) ?? []
  }
  const slots: SlotLevel[] = slotCounts.map((max, i) => ({ level: i + 1, max, key: `slot:${i + 1}` })).filter((s) => s.max > 0)
  const pactCaster = casters.find((c) => c.pact)
  const pactRow = pactCaster && tableRow(content.require(pactCaster.classId, 'class'), pactCaster.level)
  const pactLevel = pactRow ? pactRow.slots.findIndex((n) => n > 0) + 1 : 0
  const pact = pactRow && pactLevel ? { level: pactLevel, max: pactRow.slots[pactLevel - 1], key: 'pact' } : undefined

  const resources: Resource[] = [
    ...slots.map((s) => ({ id: s.key, name: `Spell slots (level ${s.level})`, max: s.max, recharge: [{ on: 'longRest' as const, amount: 'all' as const }] })),
    ...(pact
      ? [{ id: 'pact', name: `Pact slots (level ${pact.level})`, max: pact.max, recharge: [{ on: 'shortRest' as const, amount: 'all' as const }, { on: 'longRest' as const, amount: 'all' as const }] }]
      : []),
  ]

  // Spell rows.
  const rows: SpellRow[] = []
  const dcFor = (a: Ability) => 8 + ctx.pb + ctx.mods[a] + ctx.dcBonus
  const atkFor = (a: Ability) => ctx.pb + ctx.mods[a] + ctx.attackBonus
  for (const c of casters) {
    const ids = [...c.cantrips, ...(c.mode === 'known' ? c.known : c.prepared), ...(c.spellbook ? c.known.filter((id) => !c.prepared.includes(id)) : [])]
    for (const id of new Set(ids)) {
      const spell = content.getTyped(id, 'spell')
      if (!spell) continue
      const castable = spell.level === 0 || (c.mode === 'known' ? c.known.includes(id) : c.prepared.includes(id))
      const canRitual = spell.ritual && (c.ritual === 'book' ? c.known.includes(id) || c.prepared.includes(id) : c.ritual === 'prepared' && castable)
      if (!castable && !canRitual) continue
      rows.push({
        key: `${c.classId}:${id}`, spell, classId: c.classId, ability: c.ability, dc: c.dc, attackBonus: c.attack,
        castable, always: false, ritualOnly: !castable, canRitual, notes: [],
      })
    }
  }

  // Spells granted by feats, traits, subclasses, items and extras: always prepared.
  const bestCasterAbility = casters[0]?.ability
  const bestMental = (['int', 'wis', 'cha'] as Ability[]).reduce((a, b) => (ctx.mods[b] > ctx.mods[a] ? b : a), 'int' as Ability)
  for (const ae of active) {
    const grants = ae.entity.type === 'spell' ? [{ id: ae.entity.id }] : (ae.entity.spells ?? [])
    for (const g of grants) {
      if ('minLevel' in g && g.minLevel !== undefined && ae.classLevel < g.minLevel) continue
      const ids = g.id ? [g.id] : 'fromChoice' in g && g.fromChoice ? selections(char, ae, g.fromChoice) : []
      // The ability picked in a choice: an "ability" choice, or the ability raised by a feat's increase ("int+1").
      const chosen = 'abilityFromChoice' in g && g.abilityFromChoice ? (selections(char, ae, g.abilityFromChoice)[0]?.split('+')[0] as Ability | undefined) : undefined
      // Spells from a class's own features (subclass spells, invocations) use that class's spellcasting.
      const own = casters.find((c) => c.classId === ae.classId)
      const ability: Ability = ('ability' in g && g.ability) || chosen || own?.ability || bestCasterAbility || bestMental
      const ownNumbers = own && own.ability === ability
      for (const id of ids) {
        const spell = content.getTyped(id, 'spell')
        if (!spell) continue
        rows.push({
          key: `${ae.grantKey}:${id}`, spell, grantedBy: ae, ability, dc: ownNumbers ? own.dc : dcFor(ability), attackBonus: ownNumbers ? own.attack : atkFor(ability),
          castable: !('ritualOnly' in g && g.ritualOnly), always: true, ritualOnly: 'ritualOnly' in g && !!g.ritualOnly, canRitual: spell.ritual,
          // An item's own charges / uses are keyed per inventory entry.
          freeCast: 'freeCast' in g && g.freeCast ? (ae.item && ae.entity.type === 'item' && [...ae.entity.resources, ae.entity.charges].some((r) => r?.id === g.freeCast) ? `item:${ae.item.uid}:${g.freeCast}` : g.freeCast) : undefined,
          atWill: 'atWill' in g ? g.atWill : undefined,
          limit: 'limit' in g ? g.limit : undefined,
          freeLevel: 'freeLevel' in g ? g.freeLevel : undefined,
          notes: [],
          freeOnly: ('freeOnly' in g && !!g.freeOnly) || (!!ae.item && ae.entity.type === 'item'),
          freeCost: 'freeCost' in g ? g.freeCost : undefined,
        })
      }
    }
  }

  // Features that change particular spells: "spellDamage:<id>" / "spellNote:<id>"; "@<choice>" means the spells picked in that choice.
  for (const ae of active) {
    for (const effect of ae.entity.effects) {
      const m = /^spell(Damage|Note):(.+)$/.exec(effect.target)
      if (!m) continue
      const ids = m[2].startsWith('@') ? selections(char, ae, m[2].slice(1)) : [m[2]]
      const vars: FormulaVars = { ...ctx.mods, pb: ctx.pb, level: ae.classLevel, classLevel: ae.classLevel, characterLevel: ctx.characterLevel }
      const value = resolveScaled(effect.value, vars)
      for (const row of rows.filter((r) => ids.includes(r.spell.id))) {
        if (m[1] === 'Damage') row.damageBonus = (row.damageBonus ?? 0) + value
        if (effect.note) row.notes.push(effect.note.replace('{value}', String(value)))
      }
    }
  }

  // Also "any" when something grants spells whose choices are still open (e.g. a new Magic Initiate).
  const any = casters.length > 0 || rows.length > 0 || active.some((ae) => (ae.entity.spells ?? []).length > 0)
  return { casters, slots, pact, rows, resources, any }
}

/** Damage or healing dice for a spell at a slot level (cantrips: by character level); "MOD" becomes the modifier. */
export function spellDice(spell: Spell, slotLevel: number, characterLevel: number, mod: number, damageBonus = 0): { damage?: string; heal?: string } {
  const pick = (table: Record<string, string>, at: number) => {
    let v: string | undefined
    for (const [k, d] of Object.entries(table).sort((a, b) => Number(a[0]) - Number(b[0]))) if (Number(k) <= at) v = d
    return v ?? Object.values(table)[0]
  }
  const withMod = (s: string | undefined) => s?.replace(/\s*\+\s*MOD/, mod ? (mod > 0 ? `+${mod}` : `${mod}`) : '')
  const bonus = damageBonus ? (damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`) : ''
  const damage = spell.damage ? `${pick(spell.damage.dice, spell.damage.by === 'character' ? characterLevel : slotLevel)}${bonus} ${spell.damage.type}` : undefined
  const heal = spell.heal ? withMod(pick(spell.heal, slotLevel)) : undefined
  return { damage, heal }
}

/** Spell save DC and attack bonus as Values for overrides (keys "spellDc:<class>", "spellAttack:<class>"). */
export type CasterValues = { dc: Value; attack: Value }

/** What a higher slot adds, cheat-sheet style ("↑ +1d6", "↑ +1 target"); empty if nothing or the brief already says it. */
export function upcastNote(spell: Spell): string {
  if (spell.level === 0 || spell.brief?.includes('↑')) return ''
  const step = (table?: Record<string, string>) => {
    if (!table) return ''
    const levels = Object.keys(table).map(Number).sort((a, b) => a - b)
    if (levels.length < 2) return ''
    const dice = (s: string) => /^(\d+)d(\d+)/.exec(s)
    const a = dice(table[levels[0]])
    const b = dice(table[levels[1]])
    if (!a || !b || a[2] !== b[2]) return ''
    const n = Number(b[1]) - Number(a[1])
    return n > 0 ? `+${n}d${a[2]}` : ''
  }
  const parts: string[] = []
  if (spell.damage?.by === 'slot') parts.push(step(spell.damage.dice))
  if (spell.heal) parts.push(step(spell.heal))
  if (/one additional (creature|target|Humanoid|Beast|Undead|ray|dart|beam)/i.test(spell.higherLevels ?? '')) parts.push('+1 target')
  const out = parts.filter(Boolean).join(', ')
  return out ? `↑ ${out}` : ''
}

/** The one-line effect for lists: the brief, or the short description (official and homebrew content). */
export const spellBrief = (spell: Spell) => spell.brief ?? spell.description
