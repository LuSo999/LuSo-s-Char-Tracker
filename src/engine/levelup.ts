// Level up, multiclassing and the choices a character still has to make.
import type { ContentIndex } from '../content'
import type { Ability, Choice, Class, Entity, Prerequisite } from '../content/schema'
import type { ActionResult, HistoryItem } from './actions'
import type { Character } from './character'
import { choiceKey, collectActive, computeSheet, selections, type ActiveEntity, type Sheet } from './derive'
import { resolveScaled } from './formula'

export const MAX_LEVEL = 20

const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const skillIds = [
  'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation',
  'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight-of-hand', 'stealth', 'survival',
] as const

/** Standard and rare languages (SRD). */
export const languages: Record<'2014' | '2024', string[]> = {
  '2014': ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'],
  '2024': [
    'Common', 'Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
    'Abyssal', 'Celestial', 'Deep Speech', 'Druidic', 'Infernal', 'Primordial', 'Sylvan', "Thieves' Cant", 'Undercommon',
  ],
}

// --- Choices ---------------------------------------------------------------

/** How many selections a choice takes at the entity's current level. */
export function choiceCount(choice: Choice, ae: ActiveEntity, characterLevel: number): number {
  return resolveScaled(choice.count, { level: ae.classLevel, classLevel: ae.classLevel, characterLevel })
}

/** Ability points spent in an "str+2" style selection list. */
const pointsOf = (values: string[]) => values.reduce((s, v) => s + Number(/\+(\d+)$/.exec(v)?.[1] ?? 0), 0)

export function isComplete(choice: Choice, values: string[], count: number): boolean {
  if (choice.kind === 'abilityPoints') return pointsOf(values) >= (choice.points ?? 2) * Math.max(1, count)
  return values.length >= count
}

export type PendingChoice = {
  kind: 'choice'
  ae: ActiveEntity
  choice: Choice
  /** The other way to make it (2014: a feat instead of the Ability Score Improvement). */
  alternative?: Choice
  count: number
  chosen: string[]
}
export type PendingSubclass = { kind: 'subclass'; classId: string; className: string }
export type PendingSpells = { kind: 'spells'; classId: string; className: string; missing: { what: 'cantrips' | 'known' | 'prepared' | 'spellbook'; count: number }[] }
export type Pending = PendingChoice | PendingSubclass | PendingSpells

/** Class skill choices: "skills" only for the starting class, "multiclass-skills" only for later ones. */
function choiceApplies(char: Character, ae: ActiveEntity, choice: Choice): boolean {
  if (ae.entity.type !== 'class') return true
  const primary = ae.entity.id === char.classes[0].classId
  if (choice.id === 'skills') return primary
  if (choice.id === 'multiclass-skills') return !primary
  if (choice.startingClassOnly) return primary
  return true
}

/** Every choice of the character's entities, with what is selected so far. */
export function allChoices(char: Character, sheet: Sheet): PendingChoice[] {
  const out: PendingChoice[] = []
  for (const ae of sheet.active) {
    for (const choice of ae.entity.choices) {
      if (choice.alternativeTo || ae.presets?.[choice.id] || !choiceApplies(char, ae, choice)) continue
      const count = choiceCount(choice, ae, sheet.characterLevel)
      if (count <= 0) continue
      out.push({
        kind: 'choice',
        ae,
        choice,
        alternative: ae.entity.choices.find((c) => c.alternativeTo === choice.id),
        count,
        chosen: char.choices[choiceKey(ae.grantKey, choice.id)] ?? [],
      })
    }
  }
  return out
}

import { spellbookFree } from './spells'
export { spellbookSize } from './spells'

/**
 * Every decision the character has: subclasses (from their level on), all
 * choices, and spells per spellcasting class, made or not.
 */
export function allDecisions(char: Character, content: ContentIndex, sheet: Sheet): Pending[] {
  const out: Pending[] = []
  for (const entry of char.classes) {
    const cls = content.require(entry.classId, 'class')
    if (entry.level >= cls.subclassLevel && content.all('subclass').some((s) => s.class === cls.id)) out.push({ kind: 'subclass', classId: cls.id, className: cls.name })
  }
  out.push(...allChoices(char, sheet))
  for (const c of sheet.spellcasting.casters) {
    const missing: PendingSpells['missing'] = []
    if (c.cantrips.length < c.cantripsMax) missing.push({ what: 'cantrips', count: c.cantripsMax - c.cantrips.length })
    if (c.spellbookPlaces) {
      const free = spellbookFree(c.spellbookPlaces, c.known.map((id) => content.getTyped(id, 'spell')?.level ?? 1)).length
      if (free) missing.push({ what: 'spellbook', count: free })
    }
    const counted = c.mode === 'known' ? c.known.length : c.prepared.length
    if (counted < c.spellsMax) missing.push({ what: c.mode === 'known' ? 'known' : 'prepared', count: c.spellsMax - counted })
    out.push({ kind: 'spells', classId: c.classId, className: c.name, missing })
  }
  return out
}

/** True while a decision still needs the player. */
export function isOpen(p: Pending, char: Character): boolean {
  if (p.kind === 'subclass') return !char.classes.find((c) => c.classId === p.classId)?.subclassId
  if (p.kind === 'spells') return p.missing.length > 0
  const altChosen = p.alternative ? (char.choices[choiceKey(p.ae.grantKey, p.alternative.id)] ?? []) : []
  return !(p.alternative && altChosen.length >= 1) && !isComplete(p.choice, p.chosen, p.count)
}

/** Everything the player still has to decide: open choices, a missing subclass, spells to pick. */
export function pendingChoices(char: Character, content: ContentIndex, sheet: Sheet): Pending[] {
  return allDecisions(char, content, sheet).filter((p) => {
    if (!isOpen(p, char)) return false
    // Nothing left to pick (every skill already proficient…): not something the player can do.
    if (p.kind !== 'choice' || p.choice.kind === 'abilityPoints') return true
    return choiceOptions(char, content, sheet, p.ae, p.choice).some((o) => !o.blocked && !p.chosen.includes(o.id))
  })
}

/** Stable id of a decision (to keep it on screen after it is made). */
export const pendingId = (p: Pending) => (p.kind === 'choice' ? choiceKey(p.ae.grantKey, p.choice.id) : `${p.kind}:${p.classId}`)

/** Number of separate decisions still open (for the badge). */
export const pendingCount = (pending: Pending[]) => pending.length

// --- Options -----------------------------------------------------------------

export type Option = {
  id: string
  label: string
  entity?: Entity
  /** Why it can't be picked (a prerequisite isn't met, already taken). */
  blocked?: string
  /** A requirement the app can't check (shown for the player to check). */
  note?: string
  /** Can be picked more than once. */
  repeatable?: boolean
}

/** Every spell the character knows or can cast (class lists and granted spells). */
const knownSpells = (char: Character, sheet: Sheet) =>
  new Set([...Object.values(char.spells).flatMap((s) => s.known), ...sheet.spellcasting.rows.map((r) => r.spell.id)])

/** Prerequisites written as text that the app still understands. */
const textChecks: [RegExp, (sheet: Sheet) => boolean][] = [
  [/^(Spellcasting|Pact Magic)( or (Spellcasting|Pact Magic))? feature$/i, (sheet) => sheet.spellcasting.casters.length > 0],
  [/^Fighting Style feature$/i, (sheet) => sheet.active.some((ae) => /fighting-style/.test(ae.entity.id))],
]

/** A text-only prerequisite the app can't check, if any. */
export function uncheckedPrerequisite(pre: Prerequisite | undefined): string | undefined {
  // Texts that only restate the checked fields ("Warlock 5, Pact of the Blade", "level 5") need no warning.
  if (!pre?.text || pre.features || pre.spells || pre.anyTag || pre.noTag || pre.anyOf || pre.weaponProficiency || pre.species || /^(level|[A-Z][a-z]+) \d+$/.test(pre.text)) return undefined
  return textChecks.some(([re]) => re.test(pre.text!)) ? undefined : pre.text
}

/** Unmet prerequisites as short texts; empty when everything is met. */
export function unmetPrerequisites(pre: Prerequisite | undefined, char: Character, sheet: Sheet, level: number): string[] {
  if (!pre) return []
  const out: string[] = []
  if (pre.level && level < pre.level) out.push(`level ${pre.level}`)
  for (const a of pre.abilities ?? []) if (sheet.scores[a.ability].value < a.min) out.push(`${a.ability.toUpperCase()} ${a.min}`)
  const activeIds = new Set(sheet.active.map((ae) => ae.entity.id))
  for (const f of pre.features ?? []) if (!activeIds.has(f)) out.push(f)
  if (pre.spells?.length) {
    const known = knownSpells(char, sheet)
    if (!pre.spells.some((s) => known.has(s))) out.push(pre.spells.join(' / '))
  }
  if (pre.anyOf?.length && pre.anyOf.every((alt) => unmetPrerequisites(alt, char, sheet, level).length > 0)) out.push(pre.anyOf.map((alt) => alt.text ?? '…').join(' or '))
  const tags = new Set(sheet.active.flatMap((ae) => ae.entity.tags))
  if (pre.anyTag?.length && !pre.anyTag.some((t) => tags.has(t))) out.push(pre.anyTag.join(' / '))
  if (pre.noTag?.some((t) => tags.has(t))) out.push(`no ${pre.noTag.join(' / ')}`)
  if (pre.species?.length && !pre.species.includes(char.speciesId) && !(char.subspeciesId && pre.species.includes(char.subspeciesId))) out.push(pre.species.join(' / '))
  if (pre.weaponProficiency?.length && !pre.weaponProficiency.some((w) => sheet.weaponProficiencies.includes(w))) out.push(`${pre.weaponProficiency.join(' / ')} weapons`)
  const check = pre.text ? textChecks.find(([re]) => re.test(pre.text!)) : undefined
  if (check && !check[1](sheet)) out.push(pre.text!)
  return out
}

/** The options a choice offers, with the ones that can't be picked marked. */
export function choiceOptions(char: Character, content: ContentIndex, sheet: Sheet, ae: ActiveEntity, choice: Choice): Option[] {
  const chosen = new Set(char.choices[choiceKey(ae.grantKey, choice.id)] ?? [])
  switch (choice.kind) {
    case 'entity': {
      const from = choice.from ?? {}
      // Options a book adds to an existing choice name its owner in `optionOf` (Tasha's fighting styles, invocations…).
      const added = (): Entity[] => {
        const entityChoices = ae.entity.choices.filter((c) => c.kind === 'entity' && c.from?.ids)
        const ids = new Set(from.ids)
        const owns = entityChoices.length === 1 || from.ids!.some((id) => content.get(id)?.type === 'feature' && (content.get(id) as { optionOf?: string }).optionOf === ae.entity.id)
        return owns ? content.all('feature').filter((f) => f.optionOf === ae.entity.id && !ids.has(f.id)) : []
      }
      let pool: Entity[] = from.ids
        ? [...from.ids.map((id) => content.get(id)).filter((e): e is Entity => !!e), ...added()]
        : from.type
          ? (content.all(from.type as Entity['type']) as Entity[]).filter((e) => (from.tags ?? []).every((t) => e.tags.includes(t)))
          : []
      pool = pool.filter((e) => e.edition === char.edition)
      const taken = new Set(sheet.active.map((a) => a.entity.id))
      return pool
        .map((e) => {
          const pre = 'prerequisite' in e ? (e.prerequisite as Prerequisite | undefined) : undefined
          // Feats count the character level; class options the level in their class.
          const level = e.type === 'feat' ? sheet.characterLevel : ae.classLevel
          const unmet = unmetPrerequisites(pre, char, sheet, level)
          const repeatable = 'repeatable' in e && e.repeatable === true
          const blocked = chosen.has(e.id) ? undefined : unmet.length ? unmet.join(', ') : taken.has(e.id) && !repeatable ? 'taken' : undefined
          return { id: e.id, label: e.name, entity: e, blocked, repeatable, note: uncheckedPrerequisite(pre) }
        })
        .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.label.localeCompare(b.label))
    }
    case 'skill': {
      const ids: string[] = choice.options ?? [...skillIds]
      return ids.map((id) => {
        const prof = sheet.skills[id as keyof Sheet['skills']]?.proficiency ?? 0
        // Expertise needs proficiency first; a new proficiency can't repeat one you have.
        const blocked = chosen.has(id) ? undefined : choice.expertise ? (prof < 1 ? 'notProficient' : prof >= 2 ? 'taken' : undefined) : prof >= 1 ? 'taken' : undefined
        return { id, label: content.get(`skill-${id}`)?.name ?? id, entity: content.get(`skill-${id}`), blocked }
      })
    }
    case 'ability':
    case 'abilityPoints':
      return (choice.options ?? abilities).map((id) => ({ id, label: id.toUpperCase() }))
    case 'weaponMastery': {
      // Weapons with a mastery property the character is proficient with (Barbarian: melee weapons only).
      const prof = new Set(sheet.weaponProficiencies)
      const meleeOnly = ae.entity.id.startsWith('barbarian')
      return content
        .all('item')
        .flatMap((i) => (i.kind === 'weapon' && !i.magic && i.mastery ? [i] : []))
        .map((w) => {
          const proficient = prof.has(w.category) || prof.has(w.id)
          const blocked = chosen.has(w.id) ? undefined : !proficient ? 'notProficient' : meleeOnly && w.range !== 'melee' ? 'melee' : undefined
          return { id: w.id, label: w.name, entity: w as Entity, blocked }
        })
        .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.label.localeCompare(b.label))
    }
    case 'language': {
      // Stored like species languages: "deep-speech"; already known ones are blocked.
      const known = new Set(sheet.languages)
      const slug = (l: string) => l.toLowerCase().replace(/[^a-z]+/g, '-')
      const names = new Map(languages[char.edition].map((l) => [slug(l), l]))
      return (choice.options ?? languages[char.edition]).map((l) => {
        const id = slug(l)
        return { id, label: names.get(id) ?? l, blocked: known.has(id) && !chosen.has(id) ? 'taken' : undefined }
      })
    }
    case 'tool':
      return (choice.options ?? content.all('item').flatMap((i) => (i.kind === 'tool' ? [i.id] : []))).map((id) => ({ id, label: content.get(id)?.name ?? id, entity: content.get(id) }))
    case 'option':
      return (choice.options ?? []).map((o) => ({ id: o, label: o.length <= 3 ? o.toUpperCase() : (content.get(o)?.name ?? o), entity: content.get(o) }))
    case 'subclass':
      return content.all('subclass').filter((s) => s.class === ae.classId).map((s) => ({ id: s.id, label: s.name, entity: s }))
    case 'spell': {
      // No fixed level (Magical Secrets / Discoveries): a cantrip or a level the class has slots for.
      const maxLevel = sheet.spellcasting.casters.find((c) => c.classId === ae.classId)?.maxSpellLevel ?? 9
      const levelOk = (l: number) => (choice.spellLevel === undefined ? l <= maxLevel : l === choice.spellLevel)
      // The list may be fixed by a preset (2024 Sage: Magic Initiate from the Wizard list).
      const lists = choice.classesFromChoice ? selections(char, ae, choice.classesFromChoice) : (choice.spellClasses ?? [])
      const known = choice.knownOnly ? knownSpells(char, sheet) : undefined
      return content
        .all('spell')
        .filter((s) => (choice.options ? choice.options.includes(s.id) : levelOk(s.level) && (!lists.length || s.classes.some((k) => lists.includes(k)) || lists.some((k) => content.getTyped(k, 'class')?.caster?.extraSpells?.includes(s.id)))))
        .filter((s) => (!choice.spellSchools || choice.spellSchools.includes(s.school.toLowerCase())) && (!choice.ritualOnly || s.ritual))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ id: s.id, label: s.name, entity: s, blocked: known && !known.has(s.id) && !chosen.has(s.id) ? 'notKnown' : undefined }))
    }
  }
}

export const choiceLabel = (ae: ActiveEntity, choice: Choice) => (choice.label === ae.entity.name ? choice.label : `${ae.entity.name}: ${choice.label}`)

/** Selections as names: entities, skills, "DEX +2". */
export function valuesLabel(content: ContentIndex, values: string[]): string {
  return values
    .map((v) => {
      const points = /^(str|dex|con|int|wis|cha)\+(\d+)$/.exec(v)
      if (points) return `${points[1].toUpperCase()} +${points[2]}`
      if (/^(str|dex|con|int|wis|cha)$/.test(v)) return v.toUpperCase()
      return content.get(v)?.name ?? content.get(`skill-${v}`)?.name ?? v
    })
    .join(', ')
}

/**
 * History items of one session (the Level up wizard): later changes of the
 * same choice fold into the first one, so the summary shows before → final.
 */
export function mergeItems(items: HistoryItem[], added: HistoryItem[]): HistoryItem[] {
  const out = [...items]
  for (const item of added) {
    const i = item.type === 'choice' || item.type === 'subclass' ? out.findIndex((x) => x.type === item.type && x.params?.what === item.params?.what && x.params?.class === item.params?.class) : -1
    if (i < 0) {
      out.push(item)
      continue
    }
    const merged = { ...out[i], after: item.after }
    if (merged.before === merged.after) out.splice(i, 1)
    else out[i] = merged
  }
  return out
}

/** Set a choice's selections (any kind). */
export function setChoiceValues(char: Character, content: ContentIndex, ae: ActiveEntity, choice: Choice, values: string[]): ActionResult {
  const key = choiceKey(ae.grantKey, choice.id)
  const before = char.choices[key] ?? []
  if (JSON.stringify(before) === JSON.stringify(values)) return { ok: false, error: 'noChange' }
  const choices = { ...char.choices, [key]: values }
  if (!values.length) delete choices[key]
  // Picking one way drops the other (ASI or a feat).
  const other = ae.entity.choices.find((c) => c.alternativeTo === choice.id || c.id === choice.alternativeTo)
  if (other && values.length) delete choices[choiceKey(ae.grantKey, other.id)]
  const next = pruneChoices({ ...char, choices }, content)
  return {
    ok: true,
    character: next,
    items: [{ type: 'choice', params: { what: choiceLabel(ae, choice) }, before: valuesLabel(content, before), after: valuesLabel(content, values) }],
    groupType: 'choices',
    kind: 'sheet',
  }
}

export function setSubclass(char: Character, content: ContentIndex, classId: string, subclassId: string | undefined): ActionResult {
  const entry = char.classes.find((c) => c.classId === classId)
  if (!entry || entry.subclassId === subclassId) return { ok: false, error: 'noChange' }
  const before = entry.subclassId ? content.get(entry.subclassId)?.name : ''
  const next = pruneChoices({ ...char, classes: char.classes.map((c) => (c === entry ? { ...c, subclassId } : c)) }, content)
  return {
    ok: true,
    character: next,
    items: [{ type: 'subclass', params: { class: content.get(classId)?.name ?? classId }, before: before ?? '', after: subclassId ? (content.get(subclassId)?.name ?? subclassId) : '', entity: subclassId }],
    groupType: 'choices',
    kind: 'sheet',
  }
}

/** Drop selections of choices that no longer apply (after a level is removed or a selection changes). */
export function pruneChoices(char: Character, content: ContentIndex): Character {
  let current = char
  for (let i = 0; i < 5; i++) {
    const valid = new Set(collectActive(current, content).flatMap((ae) => ae.entity.choices.map((c) => choiceKey(ae.grantKey, c.id))))
    const kept = Object.fromEntries(Object.entries(current.choices).filter(([k]) => valid.has(k)))
    if (Object.keys(kept).length === Object.keys(current.choices).length) return current
    current = { ...current, choices: kept }
  }
  return current
}

// --- Level up ------------------------------------------------------------------

const characterLevelOf = (char: Character) => char.classes.reduce((s, c) => s + c.level, 0)

/** Unmet multiclass ability requirements of a class ("STR 13"), using the current scores. */
export function multiclassUnmet(cls: Class, sheet: Sheet): string[] {
  const out: string[] = []
  for (const group of cls.multiclass?.prerequisites ?? []) {
    if (!group.some((p) => sheet.scores[p.ability].value >= p.min)) out.push(group.map((p) => `${p.ability.toUpperCase()} ${p.min}`).join(' / '))
  }
  return out
}

export type LevelUpClassOption = { cls: Class; current: number; isNew: boolean; blocked?: string[] }

/**
 * Classes the character can advance in: every current class, and (with the
 * multiclass rule on) any other class whose requirements the character meets
 * together with the requirements of every class it already has.
 */
export function levelUpOptions(char: Character, content: ContentIndex, sheet: Sheet): LevelUpClassOption[] {
  if (characterLevelOf(char) >= MAX_LEVEL) return []
  const out: LevelUpClassOption[] = char.classes.map((e) => ({ cls: content.require(e.classId, 'class'), current: e.level, isNew: false }))
  if (!char.settings.multiclass) return out
  const own = char.classes.map((e) => content.require(e.classId, 'class'))
  const ownUnmet = own.flatMap((c) => multiclassUnmet(c, sheet).map((u) => `${c.name}: ${u}`))
  for (const cls of content.all('class').filter((c) => c.edition === char.edition && !char.classes.some((e) => e.classId === c.id))) {
    const unmet = [...multiclassUnmet(cls, sheet).map((u) => `${cls.name}: ${u}`), ...ownUnmet]
    out.push({ cls, current: 0, isNew: true, blocked: unmet.length ? unmet : undefined })
  }
  return out
}

/**
 * Add one level in a class. `hpRoll` is the rolled Hit Die (null: the fixed
 * average). Current HP goes up by the new maximum's increase.
 */
export function levelUp(char: Character, content: ContentIndex, classId: string, hpRoll: number | null): ActionResult {
  if (characterLevelOf(char) >= MAX_LEVEL) return { ok: false, error: 'maxLevel' }
  const cls = content.require(classId, 'class')
  const before = computeSheet(char, content)
  const existing = char.classes.find((c) => c.classId === classId)
  const classes = existing
    ? char.classes.map((c) => (c === existing ? { ...c, level: c.level + 1, hpRolls: [...c.hpRolls, hpRoll] } : c))
    : [...char.classes, { classId, level: 1, hpRolls: [hpRoll] }]
  const levelOrder = [...(char.levelOrder.length ? char.levelOrder : impliedOrder(char)), classId]
  // Gaining a class level renews that class's "one spell per level" replacements.
  const spellSwaps = Object.fromEntries(Object.entries(char.spellSwaps).filter(([k]) => !(k.startsWith(`${classId}:`) && k.endsWith(':levelUp'))))
  let next: Character = { ...char, classes, levelOrder, spellSwaps }
  const after = computeSheet(next, content)
  const gained = after.hpMax.value - before.hpMax.value
  next = { ...next, hp: { ...next.hp, current: Math.max(0, next.hp.current + gained) } }
  const newLevel = (existing?.level ?? 0) + 1
  const items: HistoryItem[] = [
    { type: 'levelUp', params: { class: cls.name, level: newLevel }, before: before.characterLevel, after: after.characterLevel, entity: cls.id },
    { type: 'hpMax', params: { roll: hpRoll ?? 'avg' }, before: before.hpMax.value, after: after.hpMax.value },
  ]
  const had = new Set(before.active.map((a) => a.grantKey))
  for (const ae of after.active) {
    if (had.has(ae.grantKey) || ae.hidden || ae.entity.type === 'class' || ae.item) continue
    items.push({ type: 'featureGained', params: { name: ae.entity.name }, entity: ae.entity.id })
  }
  return { ok: true, character: next, items, groupType: 'levelUp', kind: 'sheet' }
}

/** Level order for characters made before it was recorded: class after class. */
function impliedOrder(char: Character): string[] {
  return char.classes.flatMap((c) => Array.from({ length: c.level }, () => c.classId))
}

/** Remove the most recent level (the reverse of levelUp); its choices are dropped. */
export function levelDown(char: Character, content: ContentIndex): ActionResult {
  const order = char.levelOrder.length ? char.levelOrder : impliedOrder(char)
  if (characterLevelOf(char) <= 1) return { ok: false, error: 'minLevel' }
  const classId = order[order.length - 1]
  const entry = char.classes.find((c) => c.classId === classId)!
  const cls = content.require(classId, 'class')
  const before = computeSheet(char, content)
  let classes = char.classes.map((c) =>
    c === entry ? { ...c, level: c.level - 1, hpRolls: c.hpRolls.slice(0, -1), subclassId: c.level - 1 >= cls.subclassLevel ? c.subclassId : undefined } : c,
  )
  classes = classes.filter((c) => c.level > 0)
  let next: Character = pruneChoices({ ...char, classes, levelOrder: order.slice(0, -1) }, content)
  if (!classes.some((c) => c.classId === classId)) {
    const spells = { ...next.spells }
    delete spells[classId]
    next = { ...next, spells }
  }
  const after = computeSheet(next, content)
  next = { ...next, hp: { ...next.hp, current: Math.min(next.hp.current, after.hpMax.value) } }
  return {
    ok: true,
    character: next,
    items: [
      { type: 'levelDown', params: { class: cls.name, level: entry.level }, before: before.characterLevel, after: after.characterLevel, entity: cls.id },
      { type: 'hpMax', params: {}, before: before.hpMax.value, after: after.hpMax.value },
    ],
    groupType: 'levelDown',
    kind: 'sheet',
  }
}

/** Multiclassing is an optional rule; on by default, switchable per character. */
export function setMulticlass(char: Character, on: boolean): ActionResult {
  if (char.settings.multiclass === on) return { ok: false, error: 'noChange' }
  return {
    ok: true,
    character: { ...char, settings: { ...char.settings, multiclass: on } },
    items: [{ type: 'multiclassRule', before: String(char.settings.multiclass), after: String(on) }],
    groupType: 'settings',
    kind: 'sheet',
  }
}
