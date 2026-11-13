// Content (rules) format shared by built-in SRD data, shared official packs
// and homebrew packs. Every entity has the same base fields; type-specific
// fields follow. Mechanics are data: the engine never special-cases an id.
import { z } from 'zod'

export const editions = ['2014', '2024'] as const
export const Edition = z.enum(editions)
export type Edition = z.infer<typeof Edition>

export const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export const Ability = z.enum(abilities)
export type Ability = z.infer<typeof Ability>

export const skills = {
  acrobatics: 'dex',
  'animal-handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight-of-hand': 'dex',
  stealth: 'dex',
  survival: 'wis',
} as const satisfies Record<string, Ability>
export type Skill = keyof typeof skills
export const Skill = z.enum(Object.keys(skills) as [Skill, ...Skill[]])

export const ActionType = z.enum(['action', 'bonusAction', 'reaction', 'other'])
export type ActionType = z.infer<typeof ActionType>

/**
 * A number that may depend on the character. Either a constant, a formula
 * string (see engine/formula.ts, e.g. "pb", "1 + floor(level / 2)", "con"),
 * or a step table by level: { "1": 2, "4": 3, "10": 4 } means 2 from level 1,
 * 3 from level 4, 4 from level 10. `per` selects which level the table reads:
 * the owning class level (default) or total character level.
 */
export const Scaled = z.union([
  z.number(),
  z.string(),
  z.object({
    byLevel: z.record(z.string().regex(/^\d+$/), z.union([z.number(), z.string()])),
    per: z.enum(['classLevel', 'characterLevel']).optional(),
  }),
])
export type Scaled = z.infer<typeof Scaled>

/** Dice expression; count and die may scale, e.g. superiority dice d8 → d10 → d12. */
export const Dice = z.union([
  z.string().regex(/^\d+d\d+$/),
  z.object({ count: Scaled, die: Scaled }),
])
export type Dice = z.infer<typeof Dice>

export const Source = z.object({
  /** Short book id, e.g. "srd-5.2", "phb-2024", "homebrew". */
  book: z.string(),
  /** Optional page or section for humans. */
  page: z.string().optional(),
  /** Link opened by Ctrl+click. Omitted → built from the user's link-site setting. */
  url: z.string().url().optional(),
})
export type Source = z.infer<typeof Source>

/** Condition under which an effect applies. Automatic ones are evaluated by the
 * engine; `toggle` effects are applied only when the player switches them on. */
const WhenSingle = z.union([
  z.enum([
    'wearingArmor',
    'wearingHeavyArmor',
    'noArmor',
    'noShield',
    'wieldingShield',
    'rangedWeapon',
    'meleeWeapon',
    'weaponAttack',
    'bloodied',
    /** No armor and no shield (Bracers of Defense). */
    'noArmorNoShield',
    /** Checks / skills that don't already add the proficiency bonus. */
    'notProficient',
    /** Attack or damage roll that uses Strength (Rage). */
    'strengthAttack',
    /** Not wearing Heavy armor (Fast Movement). */
    'notHeavyArmor',
    /** Unarmed Strike or a Monk weapon (Martial Arts). */
    'martialArts',
    /** Attack with a Heavy / Thrown weapon (Great Weapon Master, Thrown Weapon Fighting). */
    'heavyWeapon',
    'thrownWeapon',
    /** No weapon and no shield equipped (Unarmed Fighting d8). */
    'emptyHands',
    /** Wearing Medium armor (Medium Armor Master). */
    'wearingMediumArmor',
    /** No Medium or Heavy armor (Aarakocra / Harengon flight, Aasimar wings). */
    'noMediumOrHeavyArmor',
    /** Attack with a magic weapon (Battle Smith: Battle Ready). */
    'magicWeapon',
  ]),
  z.object({ toggle: z.string() }),
])
/** One condition, or several that must all hold (e.g. Raging and a Strength attack). */
export const EffectWhen = z.union([WhenSingle, z.array(WhenSingle)])
export type EffectWhen = z.infer<typeof EffectWhen>

/**
 * A modifier an entity adds while it is active (feature gained, item equipped
 * and attuned if required). Targets:
 *   ac, initiative, speed, hpMax, hpPerLevel, pb,
 *   attack, damage (weapon attacks; narrow with `when`),
 *   save:<ability>, save:all, check:<ability>, skill:<skill>, passive:<skill>,
 *   score:<ability> (raises an ability score, `max` caps it),
 *   critRange (lowest d20 roll that crits; op "min"),
 *   attacksPerAction (op "max"),
 *   unarmoredAc:<formula> (alternative AC base, op "set"),
 *   proficiency:<kind>:<id> (grant a proficiency; value 1 or 2 for expertise),
 *   advantage:<target> / disadvantage:<target> (shown as notes),
 *   martialArtsDie (die size of Unarmed Strikes and Monk weapons, op "max"),
 *   martialArts (1 = Dex may replace Str for those attacks),
 *   unarmedDamage (flat damage die size for Unarmed Strike, op "max"),
 *   monkWeapon:<weapon id> (counts as a Monk weapon; "monkWeapon:@weapons" for picked ones),
 *   reach (extra melee reach in feet, Bugbear Long-Limbed),
 *   spellDc:<class id> / spellAttack:<class id> (only that class's spells: Rod of the Pact Keeper → warlock),
 *   attackAbility:<ability> (weapon attacks may use it when higher; narrow with when / a toggle),
 *   sense:<darkvision|blindsight|tremorsense|truesight> (feet; op "max", or "add" to extend),
 *   speed:<fly|swim|climb|burrow> (feet; value "walk" = equal to Speed),
 *   shape:maxCr / shape:fly / shape:swim / shape:forms / shape:ac (Wild Shape limits; op max),
 *   shape:creature:<creature id> (that creature is also a Wild Shape form: elementals),
 *   resistance:<damage type>, immunity:<damage type>, conditionImmunity:<condition>,
 *   note (a reminder line in the notes; text in `note`).
 */
export const Effect = z.object({
  target: z.string(),
  op: z.enum(['add', 'set', 'min', 'max']).default('add'),
  value: Scaled.default(0),
  /** Upper limit for score:<ability> increases (e.g. 20). */
  max: z.number().optional(),
  when: EffectWhen.optional(),
  /** Human-readable note shown where the effect matters. */
  note: z.string().optional(),
})
export type Effect = z.infer<typeof Effect>

export const RechargeOn = z.enum(['shortRest', 'longRest', 'dawn', 'turnStart'])
export type RechargeOn = z.infer<typeof RechargeOn>

/** A pool of uses or dice a feature or item provides. */
export const Resource = z.object({
  id: z.string(),
  name: z.string(),
  max: Scaled,
  /** For dice pools: the die size, e.g. 8 for d8 (may scale with level). */
  die: Scaled.optional(),
  /** Bookkeeping only (e.g. how often Relentless Rage was used): not listed in the Resources panel. */
  hidden: z.boolean().optional(),
  /** Comes back when this state ends ("once per Rage": "Raging"). */
  resetWith: z.string().optional(),
  /** What each rest restores. "all", or a (scaled) number of uses. */
  /** What each rest restores: "all", a (scaled) number, or dice the player rolls (e.g. a wand's "1d6+1" at dawn). */
  recharge: z.array(z.object({ on: RechargeOn, amount: z.union([z.literal('all'), Scaled]), dice: z.string().optional() })).default([]),
})
export type Resource = z.infer<typeof Resource>

/** Something the character can do that appears in the action list. */
export const Activity = z.object({
  id: z.string(),
  name: z.string(),
  actionType: ActionType,
  /** Resource spent per use; `resource` refers to a Resource id on any active entity. */
  cost: z.array(z.object({ resource: z.string(), amount: z.number().default(1) })).default([]),
  /** Short rules summary shown in the row. */
  summary: z.string().optional(),
  /** Healing or damage roll, e.g. Second Wind "1d10 + level". */
  roll: z.object({ dice: Dice.optional(), bonus: Scaled.optional(), kind: z.enum(['heal', 'temp', 'damage', 'other']) }).optional(),
  /** Save DC for the activity, e.g. "8 + pb + str". */
  saveDc: Scaled.optional(),
  saveAbility: Ability.optional(),
  /** Character level from which the activity is available (e.g. Large Form at 5). */
  minLevel: z.number().optional(),
  /** Turn economy: using it grants another action this turn (Action Surge). */
  grants: z.enum(['action']).optional(),
  /** Visual flavor when used: weapon-like, spell-like, or a burst of inner power. */
  fx: z.enum(['physical', 'magic', 'power']).optional(),
  /** Takes the place of one attack of the Attack action (Grapple, Shove, Commander's Strike). */
  costsAttack: z.boolean().default(false),
  /** How many times per turn it can be used (e.g. 1 for Cleave). */
  perTurn: z.number().int().min(1).optional(),
  /** At most one activity of this group per attack (e.g. "maneuver"). */
  perAttack: z.string().optional(),
  /** Resources the activity gives back: "all", a number, or (upTo) refill until you have that many. Slots as "slot:<n>" / "pact". */
  restore: z.array(z.object({ resource: z.string(), amount: z.union([z.literal('all'), Scaled]), upTo: z.boolean().default(false) })).default([]),
  /** Also expends one spell slot of the player's choice (Font of Inspiration, Primeval Awareness, Wild Resurgence). */
  slotCost: z.boolean().default(false),
  /** With slotCost: the lowest slot level allowed (Mantle of Majesty: 3). */
  slotMin: z.number().int().optional(),
  /** With slotCost: refills a resource by this much per slot level (Arcane Ward: 2 HP per level). */
  restorePerSlotLevel: z.object({ resource: z.string(), amount: z.number() }).optional(),
  /** Recover spell slots with this combined level, none above level 5 (Arcane Recovery, Natural Recovery). */
  recoverSlots: Scaled.optional(),
  /** The state of this activity also ends when that state ends (Frenzied ends with Raging). */
  endsWith: z.string().optional(),
  /** What happens when its state ends (2014 Frenzy: one level of Exhaustion). */
  onEnd: z.object({ exhaustion: z.number().int() }).optional(),
  /** Font of Magic: turn Sorcery Points into a spell slot ("create") or a slot into points ("convert"). */
  fontOfMagic: z.enum(['create', 'convert']).optional(),
  /** Pool features (Lay on Hands): the player enters how many points to spend; with a heal roll that many HP are restored. */
  spendInput: z.boolean().default(false),
  /** With spendInput: the points are dice (Healing Light d6s): the player then rolls that many and the roll heals. */
  spendDice: z.number().int().optional(),
  /** An attack or a rider on a hit (Flurry of Blows, Sneak Attack): listed with the attacks. */
  attack: z.boolean().default(false),
  /** Using it switches on this toggle of the same entity (Rage → "Raging"); rests switch it off. */
  toggle: z.string().optional(),
})
export type Activity = z.infer<typeof Activity>

/**
 * A choice the player makes when gaining an entity, e.g. a fighting style,
 * skills, or the ability increases of a feat. `from` lists entity ids or a
 * filter the UI resolves against available content.
 */
export const Choice = z.object({
  id: z.string(),
  label: z.string(),
  count: Scaled.default(1),
  kind: z.enum(['entity', 'skill', 'ability', 'abilityPoints', 'weaponMastery', 'language', 'tool', 'subclass', 'spell', 'option']),
  /** For kind "entity": allowed ids or filter by type/tags. */
  from: z
    .object({
      ids: z.array(z.string()).optional(),
      type: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  /** For skill/ability/tool: allowed options. */
  options: z.array(z.string()).optional(),
  /** For abilityPoints: total points and per-ability limit (e.g. ASI 2 points, 2 per ability). */
  points: z.number().optional(),
  perOption: z.number().optional(),
  scoreCap: z.number().optional(),
  /** When the selection may be changed later. */
  changeable: z.enum(['never', 'levelUp', 'shortRest', 'longRest']).default('never'),
  /** For kind "spell": spell level and class lists to pick from (or the lists picked in another choice). */
  spellLevel: z.number().int().min(0).max(9).optional(),
  spellClasses: z.array(z.string()).optional(),
  classesFromChoice: z.string().optional(),
  /** For kind "skill": grants expertise instead of proficiency. */
  expertise: z.boolean().optional(),
  /** For kind "spell": only spells the character already knows may be picked. */
  knownOnly: z.boolean().optional(),
  /** For kind "spell": only these schools (Fey Touched: divination, enchantment) / only Ritual spells (Ritual Caster). */
  spellSchools: z.array(z.string()).optional(),
  ritualOnly: z.boolean().optional(),
  /** On a class: only for the starting class, not when multiclassing into it (tool choice). */
  startingClassOnly: z.boolean().optional(),
  /** Either this choice or the named one is made (2014: a feat instead of the Ability Score Improvement). */
  alternativeTo: z.string().optional(),
})
export type Choice = z.infer<typeof Choice>

/**
 * Spells an entity grants outside the class spell lists (Magic Initiate,
 * species traits, subclass spells, a spell from the DM): always prepared,
 * never counted against the class limits.
 */
export const GrantedSpell = z.object({
  /** A fixed spell, or every spell selected in one of the entity's choices. */
  id: z.string().optional(),
  fromChoice: z.string().optional(),
  /** Class level (or character level for non-class entities) from which it is granted. */
  minLevel: z.number().optional(),
  /** Spellcasting ability: fixed, or picked in a choice ("ability" kind). */
  ability: Ability.optional(),
  abilityFromChoice: z.string().optional(),
  /** Resource id for casting it without a slot (e.g. once per Long Rest). */
  freeCast: z.string().optional(),
  /** Cast without a slot as often as you like (Eldritch Invocations: Armor of Shadows, Mask of Many Faces…). */
  atWill: z.boolean().optional(),
  /** Casting it (with a slot) also needs one use of this resource (2014 invocations: once per Long Rest with a Warlock slot). */
  limit: z.string().optional(),
  /** Spell level of the free cast (2014 Infernal Legacy: Hellish Rebuke as a 2nd-level spell). */
  freeLevel: z.number().int().optional(),
  /** Can only be cast as a Ritual (Animal Speaker, Ritual Caster outside the free cast). */
  ritualOnly: z.boolean().optional(),
  /** Only the free cast, never with spell slots (2014 Drow Magic; spells from items are always like this). */
  freeOnly: z.boolean().optional(),
  /** Uses of the freeCast resource one cast takes (Staff of Healing: Mass Cure Wounds for 5 charges). */
  freeCost: z.number().int().optional(),
})
export type GrantedSpell = z.infer<typeof GrantedSpell>

/**
 * Creatures an entity lets the character have: a familiar or steed from a spell, a beast
 * companion, a summoned spirit. Either a fixed list of creature ids or a filter over the
 * creatures in the content (tag, type, highest CR). Scaled stat blocks read `slot` (the
 * spell level it was cast with) and the owner's numbers (pb, level, spellAttack, spellDc…).
 */
export const CompanionGrant = z.object({
  id: z.string(),
  kind: z.enum(['familiar', 'steed', 'companion', 'summon']),
  creatures: z.array(z.string()).default([]),
  filter: z.object({ tag: z.string().optional(), creatureType: z.string().optional(), maxCr: z.number().optional() }).optional(),
  /** Cast with a spell slot: the companion remembers the slot level (scaled stat blocks). */
  slot: z.boolean().default(false),
  /** Class whose spell attack / DC the stat block uses (default: the entity's own class, else the best). */
  spellClass: z.string().optional(),
  /** Short rules reminder shown with the companion. */
  note: z.string().optional(),
  /**
   * Changes to the stat block (2014 Ranger's Companion: + pb to AC, attacks and damage; HP at least 4 × level).
   * Formulas see the owner's numbers.
   */
  adjust: z
    .object({
      ac: Scaled.optional(),
      attack: Scaled.optional(),
      damage: Scaled.optional(),
      hpBonus: Scaled.optional(),
      hpMin: Scaled.optional(),
      /** Extra HP per Hit Die of the stat block (Mighty Summoner: 2). */
      hpPerDie: Scaled.optional(),
      /** Temporary HP it arrives with (Hound of Ill Omen: half the class level). */
      tempHp: Scaled.optional(),
    })
    .optional(),
})
export type CompanionGrant = z.infer<typeof CompanionGrant>

const base = {
  id: z.string(),
  edition: Edition,
  name: z.string(),
  /** Short summary for lists and the quick preview. */
  description: z.string().default(''),
  /** Full rules text when we may store it (SRD); shown in the preview. */
  text: z.string().optional(),
  source: Source,
  /** False when the mechanics were written from memory and need checking against the book. */
  verified: z.boolean().default(true),
  /** Marks content from recently released books (shown as a small "new" tag). */
  isNew: z.boolean().optional(),
  /** Homebrew: when the entity was last changed (ms), so characters using it can note the change. */
  updatedAt: z.number().optional(),
  effects: z.array(Effect).default([]),
  resources: z.array(Resource).default([]),
  activities: z.array(Activity).default([]),
  choices: z.array(Choice).default([]),
  spells: z.array(GrantedSpell).default([]),
  /** Spells added to the class list the entity belongs to, to learn or prepare (2014 Fiend: Expanded Spell List). */
  expandedSpells: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  companions: z.array(CompanionGrant).default([]),
  /** Features this one replaces while it applies (Tasha's Favored Foe → Favored Enemy; a subclass's own smite). */
  replaces: z.array(z.string()).default([]),
  /**
   * Attacks the entity gives that aren't items: natural weapons (claws, horns,
   * hooves), Psychic Blades, a conjured weapon. Listed with the weapon attacks.
   */
  attacks: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        range: z.enum(['melee', 'ranged']).default('melee'),
        damage: z.object({ dice: z.string(), type: z.string() }),
        properties: z.array(z.string()).default([]),
        distance: z.object({ normal: z.number(), long: z.number().optional() }).optional(),
        mastery: z.string().optional(),
        /** Ability for attack and damage; default Str (Dex with finesse / ranged). */
        ability: Ability.optional(),
        /** Damage dice by level of the owning class (Armorer: { 3: '1d6', 15: '1d8' }); overrides damage.dice. */
        diceByLevel: z.record(z.string(), z.string()).optional(),
        /** Extra to hit / damage (magic +1 at a level…). */
        attackBonus: Scaled.optional(),
        damageBonus: Scaled.optional(),
        /** Class level / character level from which it's available. */
        minLevel: z.number().optional(),
        /** Only while this toggle / state is on (e.g. "Raging", "Pact weapon summoned"). */
        while: z.string().optional(),
      }),
    )
    .default([]),
}

/**
 * What a feat or an option (Eldritch Invocation…) needs before it can be
 * picked. `level` is the character level for feats and the level in the
 * owning class for class options. The app checks everything except `text`.
 */
export const Prerequisite: z.ZodType<Prerequisite> = z.object({
  level: z.number().optional(),
  abilities: z.array(z.object({ ability: Ability, min: z.number() })).optional(),
  /** Every one of these entities must already apply to the character (Pact of the Blade…). */
  features: z.array(z.string()).optional(),
  /** At least one of these spells must be known (a damaging Warlock cantrip…). */
  spells: z.array(z.string()).optional(),
  /** Needs an entity with one of these tags (Greater Mark: "dragonmark"); or must not have one (a second Dragonmark). */
  anyTag: z.array(z.string()).optional(),
  noTag: z.array(z.string()).optional(),
  /** Proficiency with one of these weapon categories / weapons ("martial"). */
  weaponProficiency: z.array(z.string()).optional(),
  /** Species or subspecies ids, one of which the character must be (racial feats). */
  species: z.array(z.string()).optional(),
  /** Shown to the player; a requirement the app can't check, or the wording of the ones it does. */
  text: z.string().optional(),
  /** At least one of these must be met as well (a feat OR Martial weapon training). */
  anyOf: z.array(z.lazy(() => Prerequisite)).optional(),
})
export type Prerequisite = {
  level?: number
  abilities?: { ability: Ability; min: number }[]
  features?: string[]
  spells?: string[]
  anyTag?: string[]
  noTag?: string[]
  weaponProficiency?: string[]
  species?: string[]
  text?: string
  anyOf?: Prerequisite[]
}

export const Feature = z.object({
  ...base,
  type: z.literal('feature'),
  /** Owning class / subclass / species / background id. */
  parent: z.string().optional(),
  /** This feature is an upgrade of another (e.g. "Action Surge (2 uses)"); the
   *  UI shows them merged and the base feature's resource scales instead. */
  upgradeOf: z.string().optional(),
  /** Options of a parent choice (fighting styles in 5e 2014) are not granted on their own. */
  optionOf: z.string().optional(),
  actionType: ActionType.optional(),
  prerequisite: Prerequisite.optional(),
  /** Can be picked more than once in a choice (2024 Agonizing Blast, for another cantrip). */
  repeatable: z.boolean().optional(),
})
export type Feature = z.infer<typeof Feature>

export const ClassLevel = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()).default([]),
})

/**
 * Starting equipment: each choice offers options (A, B, …); an option gives
 * items, lets the player pick some from a category, and/or gives coins.
 */
export const EquipmentOption = z.object({
  items: z.array(z.object({ id: z.string(), count: z.number().int().default(1) })).default([]),
  picks: z.array(z.object({ label: z.string(), from: z.array(z.string()), count: z.number().int().default(1) })).default([]),
  gp: z.number().default(0),
})
export type EquipmentOption = z.infer<typeof EquipmentOption>
export const EquipmentChoice = z.object({ label: z.string(), options: z.array(EquipmentOption) })
export type EquipmentChoice = z.infer<typeof EquipmentChoice>
const startingEquipment = {
  /** Always given (2014: the Wizard's spellbook, a background's clothes and pouch). */
  startingItems: z.array(z.object({ id: z.string(), count: z.number().int().default(1) })).default([]),
  startingGold: z.number().default(0),
  startingEquipment: z.array(EquipmentChoice).default([]),
}

export const SwapRule = z.enum(['none', 'levelUp', 'longRestOne', 'longRestAll'])
export type SwapRule = z.infer<typeof SwapRule>

/** How a class (or a subclass: Eldritch Knight, Arcane Trickster) casts spells. */
export const CasterInfo = z.object({
  ability: Ability,
  /** "known": a fixed list (5e Bard…); "prepared": chosen from the class list (count from the table or formula). */
  mode: z.enum(['known', 'prepared']),
  spellbook: z.boolean().default(false),
  /** 5e prepared casters: number of prepared spells as a formula (e.g. "int + level"). */
  preparedFormula: z.string().optional(),
  /** Which spells can be cast as rituals: prepared/known ones, any in the spellbook, or none. */
  ritual: z.enum(['none', 'prepared', 'book']),
  /**
   * When spells may be replaced: never, one per class level gained, one
   * per Long Rest, or any after a Long Rest. Adding up to the limits is
   * always fine; this governs removing one.
   */
  swap: z
    .object({ cantrips: SwapRule, spells: SwapRule })
    .default({ cantrips: 'none', spells: 'longRestAll' }),
  /** Spell list to learn from when it isn't the class's own (Eldritch Knight, Arcane Trickster: "wizard"). */
  spellList: z.string().optional(),
  /** Spells on the class list besides those whose `classes` name it (a book class using SRD spells: Artificer). */
  extraSpells: z.array(z.string()).optional(),
  /** 2014 Eldritch Knight / Arcane Trickster: leveled spells only from these schools… */
  schools: z.array(z.string()).optional(),
  /** …except this many (by class level) from any school. */
  anySchool: Scaled.optional(),
})
export type CasterInfo = z.infer<typeof CasterInfo>

export const SpellcastingProgression = z.enum(['none', 'full', 'half', 'third', 'pact'])

export const Class = z.object({
  ...base,
  type: z.literal('class'),
  hitDie: z.number(),
  primaryAbility: z.array(Ability).default([]),
  savingThrows: z.array(Ability),
  proficiencies: z.object({
    armor: z.array(z.string()).default([]),
    weapons: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
  }),
  skillChoice: z.object({ count: z.number(), options: z.array(Skill) }),
  multiclass: z
    .object({
      /** Every group must be satisfied; within a group any one ability suffices. */
      prerequisites: z.array(z.array(z.object({ ability: Ability, min: z.number() }))),
      proficiencies: z.object({
        armor: z.array(z.string()).default([]),
        weapons: z.array(z.string()).default([]),
        tools: z.array(z.string()).default([]),
        skills: z.number().default(0),
      }),
    })
    .optional(),
  subclassLevel: z.number(),
  levels: z.array(ClassLevel),
  /** Extra class-table columns (e.g. second_wind_uses), for display and cross-checks. */
  progression: z.record(z.string(), z.record(z.string(), z.number())).default({}),
  spellcasting: SpellcastingProgression.default('none'),
  /** How the class casts: ability, prepared vs known spells, spellbook, rituals. */
  caster: CasterInfo    .optional(),
  ...startingEquipment,
  /** Per class level: cantrips known, spells known/prepared, slots of levels 1–9 (Pact Magic: slots of one level). */
  spellTable: z.record(z.string(), z.object({ cantrips: z.number(), known: z.number().optional(), prepared: z.number().optional(), slots: z.array(z.number()) })).default({}),
})
export type Class = z.infer<typeof Class>

export const Subclass = z.object({
  ...base,
  type: z.literal('subclass'),
  class: z.string(),
  levels: z.array(ClassLevel),
  /** Who may take it (Path of the Battlerager: dwarves only). */
  prerequisite: Prerequisite.optional(),
  /** Subclasses that cast spells for a non-caster class (Eldritch Knight, Arcane Trickster: "third"). */
  spellcasting: SpellcastingProgression.default('none'),
  caster: CasterInfo.optional(),
  spellTable: z.record(z.string(), z.object({ cantrips: z.number(), known: z.number().optional(), prepared: z.number().optional(), slots: z.array(z.number()) })).default({}),
})
export type Subclass = z.infer<typeof Subclass>

export const Feat = z.object({
  ...base,
  type: z.literal('feat'),
  /** 2024 categories: origin, general, fighting-style, epic-boon. */
  category: z.string().optional(),
  prerequisite: Prerequisite.optional(),
  repeatable: z.boolean().default(false),
})
export type Feat = z.infer<typeof Feat>

export const Species = z.object({
  ...base,
  type: z.literal('species'),
  size: z.string(),
  speed: z.number(),
  traits: z.array(z.string()).default([]),
  subspecies: z.array(z.string()).default([]),
  /** 5e 2014 races give fixed ability bonuses. */
  abilityBonuses: z.array(z.object({ ability: Ability, bonus: z.number() })).default([]),
  languages: z.array(z.string()).default([]),
})
export type Species = z.infer<typeof Species>

export const Subspecies = z.object({
  ...base,
  type: z.literal('subspecies'),
  species: z.string(),
  traits: z.array(z.string()).default([]),
  abilityBonuses: z.array(z.object({ ability: Ability, bonus: z.number() })).default([]),
})
export type Subspecies = z.infer<typeof Subspecies>

export const Background = z.object({
  ...base,
  type: z.literal('background'),
  skills: z.array(Skill).default([]),
  tools: z.array(z.string()).default([]),
  /** 2024: the three abilities the background may raise (+2/+1 or +1/+1/+1). */
  abilityOptions: z.array(Ability).default([]),
  /** 2024 origin feat id. */
  feat: z.string().optional(),
  /** Fixed selections of the origin feat's choices (Sage: Magic Initiate from the Wizard list). */
  featPresets: z.record(z.string(), z.array(z.string())).optional(),
  ...startingEquipment,
  features: z.array(z.string()).default([]),
})
export type Background = z.infer<typeof Background>

export const Trait = z.object({
  ...base,
  type: z.literal('trait'),
  actionType: ActionType.optional(),
})
export type Trait = z.infer<typeof Trait>

export const Cost = z.object({ amount: z.number(), unit: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']) })

const itemBase = {
  ...base,
  type: z.literal('item'),
  weight: z.number().default(0),
  cost: Cost.optional(),
  /** Magic items: rarity and attunement. */
  magic: z.boolean().default(false),
  rarity: z.string().optional(),
  attunement: z.boolean().default(false),
  /** Item with its own charges (wand, ring). */
  charges: Resource.optional(),
  /** Consumable item used from the action list (potion). */
  consumable: z.boolean().default(false),
}

export const Weapon = z.object({
  ...itemBase,
  kind: z.literal('weapon'),
  category: z.enum(['simple', 'martial']),
  range: z.enum(['melee', 'ranged']),
  damage: z.object({ dice: z.string(), type: z.string() }).optional(),
  versatileDamage: z.string().optional(),
  /** Weapon properties: ammunition, finesse, heavy, light, loading, reach, thrown, two-handed, versatile, reload… */
  properties: z.array(z.string()).default([]),
  /** What a property the app doesn't know does (homebrew "misfire", "burst fire"): shown as a note on the attack. */
  propertyNotes: z.record(z.string(), z.string()).optional(),
  /** Normal / long range in feet (ranged weapons, or throw range for thrown). */
  distance: z.object({ normal: z.number(), long: z.number().optional() }).optional(),
  /** 2024 weapon mastery property id. */
  mastery: z.string().optional(),
  /** Ammunition item kind consumed (e.g. "arrows"). */
  ammunition: z.string().optional(),
  /** Magazine size for the reload property. */
  reload: z.number().optional(),
  /** Base weapon for magic weapons (+1 longsword → "longsword"). */
  baseItem: z.string().optional(),
})
export type Weapon = z.infer<typeof Weapon>

export const Armor = z.object({
  ...itemBase,
  kind: z.literal('armor'),
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  ac: z.object({ base: z.number(), dex: z.boolean(), maxDex: z.number().optional() }),
  strMin: z.number().default(0),
  stealthDisadvantage: z.boolean().default(false),
  baseItem: z.string().optional(),
})
export type Armor = z.infer<typeof Armor>

export const Gear = z.object({
  ...itemBase,
  kind: z.enum(['gear', 'ammunition', 'tool', 'pack', 'wondrous', 'potion', 'ring', 'rod', 'staff', 'wand', 'scroll']),
  /** Ammunition: units per bundle and whether it can be recovered after combat. */
  bundle: z.number().optional(),
  recoverable: z.boolean().optional(),
  /** Ammunition kind id this item provides (e.g. "arrows"). */
  ammoKind: z.string().optional(),
  /** Magic weapons/armor/ammunition built on a mundane item ("Weapon +1" → a longsword):
   *  the kind of base item and which ones are allowed. */
  baseKind: z.enum(['weapon', 'armor', 'shield', 'ammunition']).optional(),
  baseOptions: z.array(z.string()).optional(),
})
export type Gear = z.infer<typeof Gear>

export const Item = z.discriminatedUnion('kind', [Weapon, Armor, Gear])
export type Item = z.infer<typeof Item>

export const Spell = z.object({
  ...base,
  type: z.literal('spell'),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  actionType: ActionType,
  range: z.string(),
  components: z.array(z.enum(['V', 'S', 'M'])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  classes: z.array(z.string()).default([]),
  higherLevels: z.string().optional(),
  /** Spell attack (melee/ranged) or the saving throw the target makes. */
  attack: z.enum(['melee', 'ranged']).optional(),
  save: Ability.optional(),
  /** Damage dice by slot level or by character level (cantrips). */
  damage: z.object({ type: z.string(), by: z.enum(['slot', 'character']), dice: z.record(z.string(), z.string()) }).optional(),
  heal: z.record(z.string(), z.string()).optional(),
  /** Cheat-sheet style one-line effect (dice the app computes are left out). */
  brief: z.string().optional(),
})
export type Spell = z.infer<typeof Spell>

export const ConditionDef = z.object({
  ...base,
  type: z.literal('condition'),
})
export type ConditionDef = z.infer<typeof ConditionDef>

export const WeaponMastery = z.object({
  ...base,
  type: z.literal('weaponMastery'),
})
export type WeaponMastery = z.infer<typeof WeaponMastery>

/** Rules terms for Ctrl+hover / Ctrl+click: glossary terms, weapon properties, skills. */
export const RuleDef = z.object({
  ...base,
  type: z.literal('rule'),
  category: z.enum(['glossary', 'weaponProperty', 'skill']).default('glossary'),
})
export type RuleDef = z.infer<typeof RuleDef>

/** One action, bonus action or reaction in a creature's stat block. Numbers may be formulas (scaled stat blocks). */
export const CreatureAction = z.object({
  name: z.string(),
  description: z.string().default(''),
  actionType: ActionType.default('action'),
  /** Attack roll bonus and reach / range text ("reach 5 ft.", "range 80/320 ft."). */
  attack: z.object({ bonus: Scaled, range: z.string().optional() }).optional(),
  /**
   * Damage parts: dice plus a (scaled) flat bonus, e.g. { dice: '1d8', bonus: '3 + slot', type: 'piercing' }.
   * Dice may scale: { count: { byLevel: { 7: 1, 15: 2 } }, die: 6 } (level of the granting class).
   */
  damage: z.array(z.object({ dice: z.union([z.string(), z.object({ count: Scaled, die: Scaled })]).default(''), bonus: Scaled.default(0), type: z.string() })).default([]),
  save: z.object({ ability: Ability, dc: Scaled }).optional(),
})
export type CreatureAction = z.infer<typeof CreatureAction>

/** A stat block: Wild Shape forms, familiars, steeds, companions and summons. */
export const Creature = z.object({
  ...base,
  type: z.literal('creature'),
  size: z.string(),
  creatureType: z.string(),
  /** Challenge rating as a number (0.125, 0.25, 0.5, 1…). */
  cr: z.number().default(0),
  ac: Scaled,
  hp: Scaled,
  hitDice: z.string().optional(),
  /** Speeds in feet: walk, fly, swim, climb, burrow (may scale). */
  speed: z.record(z.string(), Scaled),
  scores: z.object({ str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number() }),
  /** Bonuses may be formulas (Steel Defender: '1 + pb'). */
  saves: z.partialRecord(Ability, Scaled).default({}),
  skills: z.partialRecord(Skill, Scaled).default({}),
  senses: z.record(z.string(), Scaled).default({}),
  passivePerception: Scaled.optional(),
  languages: z.string().default(''),
  resistances: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),
  conditionImmunities: z.array(z.string()).default([]),
  traits: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
  actions: z.array(CreatureAction).default([]),
})
export type Creature = z.infer<typeof Creature>

export const Entity = z.union([
  Class,
  Subclass,
  Feature,
  Feat,
  Species,
  Subspecies,
  Background,
  Trait,
  Item,
  Spell,
  ConditionDef,
  WeaponMastery,
  RuleDef,
  Creature,
])
export type Entity = z.infer<typeof Entity>
export type EntityType = Entity['type']

/** A content pack: built-in SRD per edition, an official book, or homebrew. */
export const Pack = z.object({
  id: z.string(),
  name: z.string(),
  edition: Edition,
  version: z.string().default('1'),
  /** Book id items default to. */
  book: z.string(),
  /** Template for links when an item has no own url: {type}, {slug}, {id}. */
  linkTemplate: z.string().optional(),
  /** Short label shown next to content from this book ("PHB'24", "XGtE"). */
  abbr: z.string().optional(),
  /** Unofficial or playtest material (Plane Shift, Unearthed Arcana): off unless a character enables it. */
  defaultOff: z.boolean().optional(),
  entities: z.array(Entity),
})
export type Pack = z.infer<typeof Pack>

/** The file the admin uploads: all official (non-SRD) packs, one version stamp. */
export const OfficialContent = z.object({
  version: z.string(),
  packs: z.array(Pack),
})
export type OfficialContent = z.infer<typeof OfficialContent>
