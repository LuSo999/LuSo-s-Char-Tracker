// What each help topic points at: where it lands on the sheet and how to find real examples of it
// in the loaded content (SRD, books, the user's own packs).
import type { Entity, EntityType } from '../../../content/schema'
import type { RowKind, Snippet } from '../describe'
import { familyById, parseTarget, type Place } from '../targets'
import type { HelpId } from './text.en'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

/** Rows of one entity that illustrate a topic. */
export type Matcher = (e: Entity) => Snippet[]

export type TopicMeta = { place?: Place; examples?: Matcher }

const rows =
  (kind: RowKind, pred: (row: Raw) => boolean): Matcher =>
  (e) =>
    (((e as Raw)[kind] as Raw[] | undefined) ?? []).filter(pred).map((row) => ({ kind, row }))
const whole =
  (pred: (e: Entity) => boolean): Matcher =>
  (e) =>
    pred(e) ? [{ kind: 'entity' }] : []
const whenList = (w: unknown): unknown[] => (w === undefined ? [] : Array.isArray(w) ? w : [w])
const isFormula = (v: unknown) => typeof v === 'string' && /[a-z]/i.test(v)
const isTable = (v: unknown) => typeof v === 'object' && v !== null && 'byLevel' in v

const ACTIVITY_FIELD: Record<string, (a: Raw) => boolean> = {
  name: () => true,
  actionType: (a) => a.actionType === 'bonusAction',
  cost: (a) => a.cost?.length > 0,
  costAmount: (a) => a.cost?.some((c: Raw) => c.amount > 1),
  roll: (a) => !!a.roll,
  dice: (a) => typeof a.roll?.dice === 'object',
  bonus: (a) => a.roll?.bonus !== undefined,
  saveDc: (a) => a.saveDc !== undefined,
  saveAbility: (a) => a.saveAbility !== undefined,
  spendInput: (a) => !!a.spendInput,
  attack: (a) => !!a.attack,
  summary: (a) => !!a.summary,
  toggle: (a) => !!a.toggle,
  restore: (a) => a.restore?.length > 0,
  perTurn: (a) => a.perTurn !== undefined,
  slotCost: (a) => !!a.slotCost,
  grants: (a) => !!a.grants,
  endsWith: (a) => !!a.endsWith,
  minLevel: (a) => a.minLevel !== undefined,
  costsAttack: (a) => !!a.costsAttack,
}

const RESOURCE_FIELD: Record<string, (r: Raw) => boolean> = {
  name: () => true,
  max: (r) => isFormula(r.max) || isTable(r.max),
  die: (r) => r.die !== undefined,
  recharge: (r) => r.recharge?.some((x: Raw) => x.on === 'dawn' || x.on === 'shortRest'),
  id: () => true,
  hidden: (r) => !!r.hidden,
  resetWith: (r) => !!r.resetWith,
}

const CHOICE_FIELD: Record<string, (c: Raw) => boolean> = {
  label: () => true,
  id: (c) => c.kind === 'option' || c.kind === 'ability',
  count: (c) => isTable(c.count),
  changeable: (c) => c.changeable && c.changeable !== 'never',
  from: (c) => !!c.from?.tags,
  options: (c) => c.options?.length > 0,
}

const SPELL_FIELD: Record<string, (g: Raw) => boolean> = {
  id: (g) => !!g.id,
  fromChoice: (g) => !!g.fromChoice,
  freeCast: (g) => !!g.freeCast,
  minLevel: (g) => g.minLevel !== undefined,
  ability: (g) => !!g.ability || !!g.abilityFromChoice,
  atWill: (g) => !!g.atWill,
}

const COMPANION_FIELD: Record<string, (c: Raw) => boolean> = {
  creatures: (c) => c.creatures?.length > 0,
  filter: (c) => !!c.filter,
  slot: (c) => !!c.slot,
  max: (c) => c.max !== undefined,
  choose: (c) => !!c.choose,
  adjust: (c) => !!c.adjust,
  note: (c) => !!c.note,
  spellClass: (c) => !!c.spellClass,
}

const SECTION: Partial<Record<string, { place: Place; examples: Matcher }>> = {
  effects: { place: 'abilities', examples: rows('effects', () => true) },
  proficiency: { place: 'proficiencies', examples: rows('effects', (x) => String(x.target).startsWith('proficiency:')) },
  defenses: { place: 'senses', examples: rows('effects', (x) => /^(sense|resistance|immunity|conditionImmunity):/.test(String(x.target))) },
  notes: { place: 'reminders', examples: rows('effects', (x) => /^(note|advantage|disadvantage)/.test(String(x.target))) },
  companionEffects: { place: 'companions', examples: rows('companions', (c) => !!c.adjust) },
  allies: { place: 'allies', examples: rows('effects', (x) => String(x.target).startsWith('ally:')) },
  resources: { place: 'resources', examples: rows('resources', () => true) },
  activities: { place: 'actions', examples: rows('activities', () => true) },
  choices: { place: 'choices', examples: rows('choices', () => true) },
  spells: { place: 'spells', examples: rows('spells', () => true) },
  companions: { place: 'companions', examples: rows('companions', () => true) },
  attacks: { place: 'attacks', examples: rows('attacks', () => true) },
  replaces: { place: 'features', examples: whole((e) => (e.replaces?.length ?? 0) > 0) },
  expandedSpells: { place: 'spells', examples: whole((e) => (e.expandedSpells?.length ?? 0) > 0) },
}

const TYPE_OF: Record<string, EntityType> = {
  feature: 'feature',
  subclass: 'subclass',
  class: 'class',
  feat: 'feat',
  species: 'species',
  subspecies: 'subspecies',
  background: 'background',
  item: 'item',
  spell: 'spell',
  creature: 'creature',
  condition: 'condition',
}

/** Where a topic lands and which content illustrates it. */
export function topicMeta(id: HelpId): TopicMeta {
  const [group, a, b] = id.split('.')
  switch (group) {
    case 'target': {
      const fam = familyById.get(a)
      if (!fam) return {}
      if (a === 'companion') return { place: fam.place, examples: (e) => [...rows('effects', (x) => parseTarget(String(x.target)).family?.id === 'companion')(e), ...rows('companions', (c) => !!c.adjust)(e)] }
      return { place: fam.place, examples: rows('effects', (x) => parseTarget(String(x.target)).family?.id === a) }
    }
    case 'op':
      return { examples: rows('effects', (x) => (x.op ?? 'add') === a && !familyById.get(parseTarget(String(x.target)).family?.id ?? '')?.valueless) }
    case 'when':
      if (a === 'always') return {}
      if (a === 'toggle') return { place: 'situational', examples: rows('effects', (x) => whenList(x.when).some((w) => typeof w === 'object')) }
      if (a === 'all') return { examples: rows('effects', (x) => Array.isArray(x.when)) }
      return { examples: rows('effects', (x) => whenList(x.when).includes(a)) }
    case 'section':
      return SECTION[a] ?? {}
    case 'effect':
      if (a === 'max') return { place: 'abilities', examples: rows('effects', (x) => x.max !== undefined) }
      if (a === 'value') return { examples: rows('effects', (x) => isFormula(x.value) || isTable(x.value)) }
      if (a === 'note') return { place: 'reminders', examples: rows('effects', (x) => !!x.note) }
      if (a === 'range') return { place: 'allies', examples: rows('effects', (x) => x.range !== undefined) }
      return {}
    case 'resource':
      return { place: 'resources', examples: RESOURCE_FIELD[a] && rows('resources', RESOURCE_FIELD[a]) }
    case 'activity':
      return { place: a === 'attack' ? 'attacks' : 'actions', examples: ACTIVITY_FIELD[a] && rows('activities', ACTIVITY_FIELD[a]) }
    case 'choice':
      if (a === 'kind') return { place: 'choices', examples: rows('choices', (c) => c.kind === b) }
      return { place: 'choices', examples: CHOICE_FIELD[a] && rows('choices', CHOICE_FIELD[a]) }
    case 'spell':
      return { place: 'spells', examples: SPELL_FIELD[a] && rows('spells', SPELL_FIELD[a]) }
    case 'companion':
      if (a === 'kind') return { place: 'companions', examples: rows('companions', (c) => c.kind === b) }
      return { place: 'companions', examples: COMPANION_FIELD[a] && rows('companions', COMPANION_FIELD[a]) }
    case 'attack':
      return { place: 'attacks', examples: rows('attacks', (x) => (a === 'while' ? !!x.while : a === 'ability' ? !!x.ability : true)) }
    case 'formula':
      return { examples: (e) => [...rows('effects', (x) => isFormula(x.value))(e), ...rows('resources', (x) => isFormula(x.max))(e)] }
    case 'scaled':
      return { examples: (e) => [...rows('effects', (x) => isTable(x.value))(e), ...rows('resources', (x) => isTable(x.max) || isTable(x.die))(e), ...rows('choices', (x) => isTable(x.count))(e)] }
    case 'type':
      if (a === 'option') return { place: 'choices', examples: whole((e) => e.type === 'feature' && !!e.optionOf) }
      return { examples: TYPE_OF[a] ? whole((e) => e.type === TYPE_OF[a]) : undefined }
    case 'option':
      return { place: 'choices', examples: whole((e) => e.type === 'feature' && !!e.optionOf) }
    case 'feat':
      if (a === 'category') return { examples: whole((e) => e.type === 'feat' && !!e.category) }
      if (a === 'repeatable') return { examples: whole((e) => e.type === 'feat' && !!e.repeatable) }
      if (a === 'prerequisite') return { examples: whole((e) => e.type === 'feat' && !!e.prerequisite) }
      return {}
    case 'class':
      return { examples: whole((e) => e.type === 'class' && (a !== 'caster' || !!e.caster) && (a !== 'multiclass' || !!e.multiclass)) }
    case 'creature':
      if (a === 'tags') return { place: 'companions', examples: whole((e) => e.type === 'creature' && (e.tags.includes('summon') || e.tags.includes('companion'))) }
      if (a === 'ac' || a === 'hp') return { place: 'companions', examples: whole((e) => e.type === 'creature' && isFormula(e[a])) }
      if (a === 'actions') return { place: 'companions', examples: whole((e) => e.type === 'creature' && e.actions.some((x) => x.uses || x.save)) }
      return { place: 'companions', examples: whole((e) => e.type === 'creature') }
    default:
      return {}
  }
}
