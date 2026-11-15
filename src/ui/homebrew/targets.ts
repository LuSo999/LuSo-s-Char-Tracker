// The vocabulary of effect targets ("ac", "save:wis", "proficiency:skill:stealth", "companion@summon:ac"…):
// which families exist, what their parameters are, where on the sheet they land. Shared by the
// target picker, the sentences describing a row and the Ctrl help.
import { abilities, skills } from '../../content/schema'

/** Where something shows up on the character sheet. */
export const PLACES = [
  'ac',
  'hp',
  'speed',
  'initiative',
  'abilities',
  'saves',
  'skills',
  'senses',
  'proficiencies',
  'attacks',
  'actions',
  'resources',
  'spells',
  'reminders',
  'situational',
  'features',
  'companions',
  'shape',
  'allies',
  'conditions',
  'inventory',
  'choices',
] as const
export type Place = (typeof PLACES)[number]

export type Param =
  | 'ability'
  | 'abilityAll'
  | 'skill'
  | 'damage'
  | 'sense'
  | 'speedMode'
  | 'classOpt'
  | 'spell'
  | 'condition'
  | 'creature'
  | 'creatureType'
  | 'weapon'
  | 'profKind'
  | 'profId'
  | 'text'
  | 'companionStat'
  | 'target'

export const CATEGORIES = ['numbers', 'abilities', 'attacks', 'spells', 'proficiency', 'defenses', 'shape', 'companions', 'allies', 'notes'] as const
export type Category = (typeof CATEGORIES)[number]

export type Op = 'add' | 'set' | 'min' | 'max'

export type Family = {
  id: string
  category: Category
  /** Fixed beginning of the target; parameters follow, separated by ":". */
  prefix: string
  params: Param[]
  place: Place
  /** The op that makes sense by default. */
  op?: Op
  /** Resistances, notes…: the value doesn't matter. */
  valueless?: boolean
  /** Feet. */
  unit?: 'ft'
  /** Not offered in the picker (still recognised and described). */
  hidden?: boolean
}

export const FAMILIES: Family[] = [
  { id: 'ac', category: 'numbers', prefix: 'ac', params: [], place: 'ac' },
  { id: 'unarmoredAc', category: 'numbers', prefix: 'unarmoredAc', params: [], place: 'ac', op: 'set' },
  { id: 'hpMax', category: 'numbers', prefix: 'hpMax', params: [], place: 'hp' },
  { id: 'hpPerLevel', category: 'numbers', prefix: 'hpPerLevel', params: [], place: 'hp' },
  { id: 'speed', category: 'numbers', prefix: 'speed', params: [], place: 'speed', unit: 'ft' },
  { id: 'speedMode', category: 'numbers', prefix: 'speed', params: ['speedMode'], place: 'speed', op: 'max', unit: 'ft' },
  { id: 'initiative', category: 'numbers', prefix: 'initiative', params: [], place: 'initiative' },
  { id: 'pb', category: 'numbers', prefix: 'pb', params: [], place: 'abilities' },
  { id: 'carrySize', category: 'numbers', prefix: 'carrySize', params: [], place: 'inventory' },
  { id: 'attunementSlots', category: 'numbers', prefix: 'attunementSlots', params: [], place: 'inventory' },

  { id: 'score', category: 'abilities', prefix: 'score', params: ['ability'], place: 'abilities' },
  { id: 'save', category: 'abilities', prefix: 'save', params: ['abilityAll'], place: 'saves' },
  { id: 'check', category: 'abilities', prefix: 'check', params: ['abilityAll'], place: 'skills' },
  { id: 'skill', category: 'abilities', prefix: 'skill', params: ['skill'], place: 'skills' },
  { id: 'passive', category: 'abilities', prefix: 'passive', params: ['skill'], place: 'skills' },

  { id: 'attack', category: 'attacks', prefix: 'attack', params: [], place: 'attacks' },
  { id: 'damage', category: 'attacks', prefix: 'damage', params: [], place: 'attacks' },
  { id: 'critRange', category: 'attacks', prefix: 'critRange', params: [], place: 'attacks', op: 'min' },
  { id: 'attacksPerAction', category: 'attacks', prefix: 'attacksPerAction', params: [], place: 'attacks', op: 'max' },
  { id: 'attackAbility', category: 'attacks', prefix: 'attackAbility', params: ['ability'], place: 'attacks', op: 'max' },
  { id: 'reach', category: 'attacks', prefix: 'reach', params: [], place: 'attacks', unit: 'ft' },
  { id: 'offhandAbilityMod', category: 'attacks', prefix: 'offhandAbilityMod', params: [], place: 'attacks', op: 'max' },
  { id: 'unarmedDamage', category: 'attacks', prefix: 'unarmedDamage', params: [], place: 'attacks', op: 'max' },
  { id: 'martialArts', category: 'attacks', prefix: 'martialArts', params: [], place: 'attacks', op: 'max' },
  { id: 'martialArtsDie', category: 'attacks', prefix: 'martialArtsDie', params: [], place: 'attacks', op: 'max' },
  { id: 'monkWeapon', category: 'attacks', prefix: 'monkWeapon', params: ['weapon'], place: 'attacks', valueless: true },

  { id: 'spellDc', category: 'spells', prefix: 'spellDc', params: ['classOpt'], place: 'spells' },
  { id: 'spellAttack', category: 'spells', prefix: 'spellAttack', params: ['classOpt'], place: 'spells' },
  { id: 'spellDamage', category: 'spells', prefix: 'spellDamage', params: ['spell'], place: 'spells' },
  { id: 'spellNote', category: 'spells', prefix: 'spellNote', params: ['spell'], place: 'spells', valueless: true },

  { id: 'proficiency', category: 'proficiency', prefix: 'proficiency', params: ['profKind', 'profId'], place: 'proficiencies', op: 'max' },

  { id: 'resistance', category: 'defenses', prefix: 'resistance', params: ['damage'], place: 'senses', valueless: true },
  { id: 'immunity', category: 'defenses', prefix: 'immunity', params: ['damage'], place: 'senses', valueless: true },
  { id: 'conditionImmunity', category: 'defenses', prefix: 'conditionImmunity', params: ['condition'], place: 'senses', valueless: true },
  { id: 'sense', category: 'defenses', prefix: 'sense', params: ['sense'], place: 'senses', op: 'max', unit: 'ft' },

  { id: 'shapeMaxCr', category: 'shape', prefix: 'shape:maxCr', params: [], place: 'shape', op: 'max' },
  { id: 'shapeFly', category: 'shape', prefix: 'shape:fly', params: [], place: 'shape', op: 'max' },
  { id: 'shapeSwim', category: 'shape', prefix: 'shape:swim', params: [], place: 'shape', op: 'max' },
  { id: 'shapeForms', category: 'shape', prefix: 'shape:forms', params: [], place: 'shape', op: 'max' },
  { id: 'shapeAc', category: 'shape', prefix: 'shape:ac', params: [], place: 'shape', op: 'max' },
  { id: 'shapeCreature', category: 'shape', prefix: 'shape:creature', params: ['creature'], place: 'shape', valueless: true },
  { id: 'shapeType', category: 'shape', prefix: 'shape:type', params: ['creatureType'], place: 'shape', valueless: true },

  { id: 'companion', category: 'companions', prefix: 'companion', params: ['companionStat'], place: 'companions' },

  { id: 'ally', category: 'allies', prefix: 'ally', params: ['target'], place: 'allies' },

  { id: 'note', category: 'notes', prefix: 'note', params: [], place: 'reminders', valueless: true },
  { id: 'advantage', category: 'notes', prefix: 'advantage', params: ['text'], place: 'reminders', valueless: true },
  { id: 'disadvantage', category: 'notes', prefix: 'disadvantage', params: ['text'], place: 'reminders', valueless: true },
]

export const familyById = new Map(FAMILIES.map((f) => [f.id, f]))

export const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']
export const SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight']
export const SPEED_MODES = ['fly', 'swim', 'climb', 'burrow']
export const CONDITIONS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious']
export const PROF_KINDS = ['skill', 'save', 'armor', 'weapon', 'tool', 'language'] as const
export const ARMOR_PROFS = ['light', 'medium', 'heavy', 'shields']
export const WEAPON_PROFS = ['simple', 'martial']
export const CREATURE_TYPES = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead']
export const COMPANION_KINDS = ['familiar', 'steed', 'companion', 'summon'] as const
/** What an effect may change on the character's own creatures (companion:<stat>). */
export const COMPANION_STATS = ['ac', 'attack', 'damage', 'hp', 'hpPerDie', 'tempHp', 'speed', 'speed:<mode>', 'save:<ability>', 'skill:<skill>', 'sense:<sense>', 'resistance:<damage>', 'immunity:<damage>', 'conditionImmunity:<condition>', 'note'] as const

export type ParsedTarget = {
  family: Family | undefined
  args: string[]
  /** shape@<group>: another shapechange; companion@<filter>: only some companions. */
  group?: string
  raw: string
}

const byPrefixLength = [...FAMILIES].sort((a, b) => b.prefix.length - a.prefix.length || a.params.length - b.params.length)

/** Split a target into its family and parameters ("save:wis" → save, [wis]). */
export function parseTarget(raw: string): ParsedTarget {
  let rest = raw.trim()
  let group: string | undefined
  const grouped = /^(shape|companion)@([^:]+):(.*)$/.exec(rest)
  if (grouped) {
    group = grouped[2]
    rest = `${grouped[1]}:${grouped[3]}`
  }
  for (const f of byPrefixLength) {
    if (f.params.length === 0) {
      if (rest === f.prefix) return { family: f, args: [], group, raw }
      continue
    }
    if (!rest.startsWith(`${f.prefix}:`)) continue
    const tail = rest.slice(f.prefix.length + 1)
    // The last parameter takes the rest (nested targets, companion stats, ids with colons).
    const args = f.params.length === 1 ? [tail] : [tail.split(':')[0], tail.split(':').slice(1).join(':')]
    return { family: f, args, group, raw }
  }
  // "spellDc" / "spellAttack" with no class.
  const bare = FAMILIES.find((f) => f.params[0] === 'classOpt' && rest === f.prefix)
  if (bare) return { family: bare, args: [], group, raw }
  return { family: undefined, args: [], group, raw }
}

/** Build a target string from a family and parameters. */
export function formatTarget(familyId: string, args: string[] = [], group?: string): string {
  const f = familyById.get(familyId)
  if (!f) return args[0] ?? ''
  const filled = args.filter((a) => a !== '' && a !== undefined)
  const body = [f.prefix, ...filled].join(':')
  if (group && (f.category === 'shape' || f.id === 'companion')) {
    const [head, ...tail] = body.split(':')
    return `${head}@${group}:${tail.join(':')}`
  }
  return body
}

/** Values a parameter can take (empty: free text). */
export function paramOptions(p: Param, profKind?: string): string[] {
  switch (p) {
    case 'ability':
      return [...abilities]
    case 'abilityAll':
      return ['all', ...abilities]
    case 'skill':
      return Object.keys(skills)
    case 'damage':
      return DAMAGE_TYPES
    case 'sense':
      return SENSES
    case 'speedMode':
      return SPEED_MODES
    case 'condition':
      return CONDITIONS
    case 'creatureType':
      return CREATURE_TYPES
    case 'profKind':
      return [...PROF_KINDS]
    case 'profId':
      return profKind === 'skill' ? Object.keys(skills) : profKind === 'save' ? [...abilities] : profKind === 'armor' ? ARMOR_PROFS : profKind === 'weapon' ? WEAPON_PROFS : []
    case 'companionStat':
      return COMPANION_STATS.flatMap((s) => {
        const m = /^(.*):<(\w+)>$/.exec(s)
        if (!m) return [s]
        const sub = m[2] === 'mode' ? SPEED_MODES : m[2] === 'ability' ? ['all', ...abilities] : m[2] === 'skill' ? Object.keys(skills) : m[2] === 'sense' ? SENSES : m[2] === 'damage' ? DAMAGE_TYPES : CONDITIONS
        return sub.map((x) => `${m[1]}:${x}`)
      })
    default:
      return []
  }
}

/** The family a companion stat behaves like (companion:resistance:fire → resistance). */
export function companionStatFamily(stat: string): Family | undefined {
  if (stat === 'hp' || stat === 'hpPerDie' || stat === 'tempHp') return familyById.get('hpMax')
  return parseTarget(stat).family
}

/** Where an effect lands on the sheet. */
export function effectPlace(target: string): Place | undefined {
  return parseTarget(target).family?.place
}
