// What changes on a character sheet when something is added: the homebrew editor's "try on a
// character" compares the sheet without and with the entity being edited.
import { abilities, Feature, type Entity } from '../content/schema'
import type { Character } from './character'
import { choiceKey, type Sheet } from './derive'

/**
 * One changed thing. `place` is where it shows on the sheet (same ids as the editor's 📍 badges),
 * `key` what it is (translated in the UI), `name` which one (an ability, a skill, an action's name…).
 */
export type DiffLine = { place: string; key: string; name?: string; before?: string; after?: string }

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export function diffSheets(a: Sheet, b: Sheet): DiffLine[] {
  const out: DiffLine[] = []
  const num = (place: string, key: string, x: number | undefined, y: number | undefined, name?: string, fmt: (n: number) => string = String) => {
    if (x !== y) out.push({ place, key, name, before: x === undefined ? undefined : fmt(x), after: y === undefined ? undefined : fmt(y) })
  }
  /** Things present in one list and not the other (by id); a changed description counts as changed. */
  const sets = (place: string, key: string, xs: Map<string, string>, ys: Map<string, string>) => {
    for (const [id, v] of ys) if (!xs.has(id)) out.push({ place, key, name: id, after: v })
      else if (xs.get(id) !== v) out.push({ place, key, name: id, before: xs.get(id), after: v })
    for (const [id, v] of xs) if (!ys.has(id)) out.push({ place, key, name: id, before: v })
  }
  const list = (xs: string[]) => new Map(xs.map((x) => [x, x]))

  num('ac', 'ac', a.ac.value, b.ac.value)
  num('hp', 'hpMax', a.hpMax.value, b.hpMax.value)
  num('speed', 'speed', a.speed.value, b.speed.value)
  num('initiative', 'initiative', a.initiative.value, b.initiative.value, undefined, signed)
  num('abilities', 'pb', a.pb.value, b.pb.value, undefined, signed)
  for (const ab of abilities) num('abilities', 'score', a.scores[ab].value, b.scores[ab].value, ab)
  for (const ab of abilities) {
    num('saves', 'save', a.saves[ab].value, b.saves[ab].value, ab, signed)
    if (a.saves[ab].proficient !== b.saves[ab].proficient) out.push({ place: 'proficiencies', key: 'saveProficiency', name: ab, after: b.saves[ab].proficient ? '✓' : '—' })
  }
  for (const s of Object.keys(b.skills) as (keyof Sheet['skills'])[]) {
    num('skills', 'skill', a.skills[s].value, b.skills[s].value, s, signed)
    if (a.skills[s].proficiency !== b.skills[s].proficiency) out.push({ place: 'proficiencies', key: 'skillProficiency', name: s, before: String(a.skills[s].proficiency), after: String(b.skills[s].proficiency) })
  }
  num('skills', 'passive', a.passivePerception.value, b.passivePerception.value)
  sets('senses', 'speedMode', new Map(Object.entries(a.speeds).map(([k, v]) => [k, `${v} ft`])), new Map(Object.entries(b.speeds).map(([k, v]) => [k, `${v} ft`])))
  sets('senses', 'sense', new Map(Object.entries(a.senses).map(([k, v]) => [k, `${v} ft`])), new Map(Object.entries(b.senses).map(([k, v]) => [k, `${v} ft`])))
  sets('senses', 'resistance', list(a.resistances), list(b.resistances))
  sets('senses', 'immunity', list(a.immunities), list(b.immunities))
  sets('senses', 'conditionImmunity', list(a.conditionImmunities), list(b.conditionImmunities))
  sets('proficiencies', 'armor', list(a.armorProficiencies), list(b.armorProficiencies))
  sets('proficiencies', 'weapon', list(a.weaponProficiencies), list(b.weaponProficiencies))
  sets('proficiencies', 'tool', list(a.toolProficiencies), list(b.toolProficiencies))
  sets('proficiencies', 'language', list(a.languages), list(b.languages))

  const attack = (s: Sheet) => new Map(s.attacks.map((x) => [x.name, `${signed(x.attack.value)} · ${x.damageDice}${x.damageBonus ? signed(x.damageBonus) : ''} ${x.damageType}${x.critRange < 20 ? ` · crit ${x.critRange}–20` : ''}${x.attacksPerAction > 1 ? ` · ×${x.attacksPerAction}` : ''}`]))
  sets('attacks', 'attack', attack(a), attack(b))
  const activity = (s: Sheet) => new Map(s.activities.map((x) => [x.activity.name, [x.rollDice && `${x.rollDice}${x.rollBonus ? signed(x.rollBonus) : ''}`, x.saveDc !== undefined && `DC ${x.saveDc}`, x.uses && `${x.uses.max}×`].filter(Boolean).join(' · ') || '✓']))
  sets('actions', 'activity', activity(a), activity(b))
  const resource = (s: Sheet) => new Map(s.resources.filter((r) => !r.resource.hidden && !r.key.startsWith('slot:') && r.key !== 'pact').map((r) => [r.resource.name, `${r.max}${r.die ? ` × d${r.die}` : ''}`]))
  sets('resources', 'resource', resource(a), resource(b))
  const slots = (s: Sheet) => new Map([...s.spellcasting.slots.map((x) => [`L${x.level}`, String(x.max)] as const), ...(s.spellcasting.pact ? [[`Pact L${s.spellcasting.pact.level}`, String(s.spellcasting.pact.max)] as const] : [])])
  sets('spells', 'slots', slots(a), slots(b))
  const casters = (s: Sheet) => new Map(s.spellcasting.casters.map((c) => [c.classId, `DC ${c.dc} · ${signed(c.attack)}`]))
  sets('spells', 'caster', casters(a), casters(b))
  const spells = (s: Sheet) => new Map(s.spellcasting.rows.filter((r) => r.always || r.atWill || r.freeCast).map((r) => [r.spell.name, [r.atWill && 'at will', r.freeCast && `free: ${r.freeCast}`, r.damageBonus && signed(r.damageBonus)].filter(Boolean).join(' · ') || '✓']))
  sets('spells', 'spell', spells(a), spells(b))
  const reminder = (s: Sheet) => list([...s.reminders.map((r) => r.note), ...s.saveNotes.map((r) => r.note)])
  sets('reminders', 'reminder', reminder(a), reminder(b))
  // Keyed by target (the UI turns it back into a sentence with the value).
  const allies = (s: Sheet) => new Map(s.allyEffects.map((x) => [x.effect.target, x.value === undefined ? '✓' : String(x.value)]))
  sets('allies', 'ally', allies(a), allies(b))
  const toggles = (s: Sheet) => new Map(s.toggles.map((x) => [x.label, x.on ? 'on' : 'off']))
  sets('situational', 'toggle', toggles(a), toggles(b))
  const companions = (s: Sheet) => new Map(s.companions.map((c) => [c.entry.uid, `${c.creature.name}: AC ${c.ac}, HP ${c.hpMax}${c.actions.find((x) => x.attack) ? `, ${signed(c.actions.find((x) => x.attack)!.attack!.bonus)}` : ''}${c.resistances.length ? `, res. ${c.resistances.join(', ')}` : ''}`]))
  // Keyed by the companion's uid; the value names the creature.
  sets('companions', 'companion', companions(a), companions(b))
  const sources = (s: Sheet) => new Map(s.companionSources.map((c) => [`${c.entity.id}/${c.grant.id}`, c.entity.name]))
  sets('companions', 'companionSource', sources(a), sources(b))
  num('inventory', 'attunementSlots', a.attunementSlots, b.attunementSlots)
  num('inventory', 'capacity', a.weight.capacity, b.weight.capacity, undefined, (n) => `${n} lb`)
  if (JSON.stringify(a.shapeRules) !== JSON.stringify(b.shapeRules)) out.push({ place: 'shape', key: 'shape', before: shapeText(a.shapeRules), after: shapeText(b.shapeRules) })
  return out
}

const shapeText = (r: Sheet['shapeRules']) => (r ? `CR ${r.maxCr}${r.fly ? ', fly' : ''}${r.swim ? ', swim' : ''}${r.forms ? `, ${r.forms} forms` : ''}` : undefined)

const TRY_UID = 'tryon'

/**
 * The character with an entity added the way a player would get it: a feature or feat as an extra,
 * an item equipped (and attuned), a spell granted, a species / background / subclass swapped in, a
 * condition switched on. Choices the entity asks for get their first options (listed in `picked`).
 * Classes and creatures can't be tried on this way (undefined).
 */
export function wearEntity(char: Character, entity: Entity): { character: Character; picked: { label: string; values: string[] }[] } | undefined {
  const c: Character = structuredClone(char)
  let grantKey: string
  switch (entity.type) {
    case 'feature':
    case 'feat':
    case 'trait':
      c.extras.push({ uid: TRY_UID, entityId: entity.id })
      grantKey = `extra:${TRY_UID}`
      break
    case 'item':
      c.inventory.push({ uid: TRY_UID, itemId: entity.id, quantity: 1, equipped: true, attuned: !!entity.attunement, twoHanded: false, chargesUsed: 0 })
      grantKey = `item:${TRY_UID}`
      break
    case 'spell':
      c.extras.push({ uid: TRY_UID, custom: Feature.parse({ id: `${TRY_UID}-${entity.id}`, edition: entity.edition, name: entity.name, type: 'feature', source: entity.source, spells: [{ id: entity.id }] }) })
      return { character: c, picked: [] }
    case 'species':
      c.speciesId = entity.id
      c.subspeciesId = undefined
      grantKey = entity.id
      break
    case 'subspecies':
      if (entity.species) c.speciesId = entity.species
      c.subspeciesId = entity.id
      grantKey = entity.id
      break
    case 'background':
      c.backgroundId = entity.id
      grantKey = entity.id
      break
    case 'subclass': {
      const entry = c.classes.find((x) => x.classId === entity.class)
      if (!entry) return undefined
      entry.subclassId = entity.id
      grantKey = entity.id
      break
    }
    case 'condition':
      if (!c.conditions.includes(entity.id)) c.conditions.push(entity.id)
      return { character: c, picked: [] }
    default:
      return undefined
  }
  const picked: { label: string; values: string[] }[] = []
  for (const choice of entity.choices) {
    const key = choiceKey(grantKey, choice.id)
    if (c.choices[key]?.length) continue
    const count = typeof choice.count === 'number' ? choice.count : 1
    const pool = choice.kind === 'entity' ? (choice.from?.ids ?? []) : choice.kind === 'abilityPoints' ? [] : (choice.options ?? [])
    const values = pool.slice(0, count)
    if (!values.length) continue
    c.choices[key] = values
    picked.push({ label: choice.label, values })
  }
  return { character: c, picked }
}

/** Toggles that belong to the tried-on entity (switch them on to see its conditional effects). */
export const tryOnToggles = (sheet: Sheet, entityId: string) => sheet.toggles.filter((t) => t.source.entity.id === entityId)
