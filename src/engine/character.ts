// Character state as stored in Firestore (users/{uid}/characters/{id}).
// Only what the player decided or what changes during play is stored;
// everything derived (AC, attack bonuses, maxima) is computed by the engine.
import { z } from 'zod'
import { Ability, Edition, Feature } from '../content/schema'

export const AbilityScores = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
})
export type AbilityScores = z.infer<typeof AbilityScores>

export const ClassEntry = z.object({
  classId: z.string(),
  level: z.number().int().min(1).max(20),
  subclassId: z.string().optional(),
  /** HP gained at each level after the first character level in this class;
   *  null means the fixed average. Index 0 is this class's 2nd level (or its
   *  1st level when it is not the starting class). */
  hpRolls: z.array(z.number().int().nullable()).default([]),
})
export type ClassEntry = z.infer<typeof ClassEntry>

export const InventoryEntry = z.object({
  /** Unique per character, so two longswords can differ (one attuned, one not). */
  uid: z.string(),
  itemId: z.string(),
  quantity: z.number().int().min(0).default(1),
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
  /** Held in two hands (versatile weapons). */
  twoHanded: z.boolean().default(false),
  /** Charges used (items with charges) and rounds loaded (reload weapons). */
  chargesUsed: z.number().int().min(0).default(0),
  loaded: z.number().int().min(0).optional(),
  /** Selected ammunition inventory entry for this weapon. */
  ammoUid: z.string().optional(),
  /** Player's own name / note for this entry. */
  label: z.string().optional(),
  /** For magic weapons/armor/ammunition built on a mundane item: that item's id. */
  baseItemId: z.string().optional(),
})
export type InventoryEntry = z.infer<typeof InventoryEntry>

export const Currency = z.object({
  cp: z.number().int().min(0).default(0),
  sp: z.number().int().min(0).default(0),
  ep: z.number().int().min(0).default(0),
  gp: z.number().int().min(0).default(0),
  pp: z.number().int().min(0).default(0),
})

export const Character = z.object({
  id: z.string(),
  name: z.string(),
  edition: Edition,
  /** Books whose content this character may use (SRD is always available). */
  books: z.array(z.string()).default([]),
  /** Classes in the order they were taken; the first is the starting class. */
  classes: z.array(ClassEntry).min(1),
  /** Class id of every level gained through Level up, in order (for "undo the last level up"). */
  levelOrder: z.array(z.string()).default([]),
  speciesId: z.string(),
  subspeciesId: z.string().optional(),
  backgroundId: z.string(),
  /** Scores before any bonus: rolled, point buy or standard array. */
  baseScores: AbilityScores,
  /**
   * Player selections keyed by "<entity id>/<choice id>" — or
   * "<entity id>@<class id>:<level>/<choice id>" when the entity is granted at
   * several levels (e.g. 2024 Ability Score Improvement). Values are the
   * selected ids; ability point choices use "str+2" style entries.
   */
  choices: z.record(z.string(), z.array(z.string())).default({}),
  /** 2024 background ability increases, e.g. { con: 2, wis: 1 }. 2014 races use fixed data. */
  backgroundBonuses: z.partialRecord(Ability, z.number()).default({}),
  /** Expended uses per resource id. */
  resourcesUsed: z.record(z.string(), z.number().int().min(0)).default({}),
  hp: z.object({
    current: z.number().int().min(0),
    temp: z.number().int().min(0).default(0),
  }),
  /** Spent hit dice per die size, e.g. { "10": 2 }. */
  hitDiceUsed: z.record(z.string(), z.number().int().min(0)).default({}),
  deathSaves: z.object({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) }).default({
    successes: 0,
    failures: 0,
  }),
  conditions: z.array(z.string()).default([]),
  exhaustion: z.number().int().min(0).max(6).default(0),
  /** Effect toggles the player switched on ("condition applies"). */
  toggles: z.array(z.string()).default([]),
  inventory: z.array(InventoryEntry).default([]),
  currency: Currency.default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
  xp: z.number().int().min(0).default(0),
  /**
   * Spells per class: cantrips and spells known (the spellbook for a Wizard)
   * and the prepared ones. Spells from feats, species, subclasses or the DM
   * are granted by those entities and not stored here.
   */
  spells: z.record(z.string(), z.object({ known: z.array(z.string()).default([]), prepared: z.array(z.string()).default([]) })).default({}),
  /**
   * Spells removed since the swap allowance was last renewed, per
   * "<class id>:<cantrips|spells>:<levelUp|longRest>" (Level up and Long Rest renew it).
   */
  spellSwaps: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Spells marked ★: shown in the action list next to weapons and features. */

  favoriteSpells: z.array(z.string()).default([]),
  /** The spell the character is concentrating on. */
  concentration: z.object({ spellId: z.string(), name: z.string() }).optional(),
  /** Ammunition fired since the last "Recover ammunition", per ammunition entry. */
  ammoSpent: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Thrown weapons lying on the battlefield, per weapon entry. */
  thrownOut: z.record(z.string(), z.number().int().min(0)).default({}),
  /**
   * Edit-mode text changes to rules content for this character only, by
   * entity id: own name, summary or link (e.g. a homebrew rename).
   */
  customizations: z
    .record(z.string(), z.object({ name: z.string().optional(), description: z.string().optional(), url: z.string().optional() }))
    .default({}),
  /**
   * Things the character has beyond class, species and background: granted
   * by the DM, from the backstory, or homebrew. Either a rules entity by id
   * or the character's own feature (same format as content packs).
   */
  extras: z
    .array(
      z.object({
        uid: z.string(),
        entityId: z.string().optional(),
        custom: Feature.optional(),
        /** Where it comes from, e.g. "From the DM", "Backstory". */
        note: z.string().optional(),
      }),
    )
    .default([]),
  /** The player's own reminders, shown next to the automatic ones under the vitals. */
  reminders: z.array(z.object({ uid: z.string(), text: z.string() })).default([]),
  /** Manual overrides from edit mode, keyed by derived value path (e.g. "ac", "skill:stealth"). */
  overrides: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  settings: z
    .object({
      multiclass: z.boolean().default(true),
      trackAmmunition: z.boolean().default(true),
    })
    .default({ multiclass: true, trackAmmunition: true }),
  notes: z.string().default(''),
})
export type Character = z.infer<typeof Character>
export type CharacterInput = z.input<typeof Character>
