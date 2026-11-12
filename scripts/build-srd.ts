// Converts SRD data from 5e-bits/5e-srd-api into this app's content format.
//
//   node scripts/build-srd.ts
//
// Source data is pinned to one commit and cached in scripts/.cache. Output:
// src/data/srd/<edition>.json, validated against src/content/schema.ts.
// Hand-written mechanics (uses, recharge, effects) come from srd-overlay.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pack, skills, type Ability, type Edition, type Entity } from '../src/content/schema.ts'
import { applyOverlay } from './srd-overlay.ts'

const SOURCE_REPO = '5e-bits/5e-srd-api'
const SOURCE_COMMIT = 'dff09cc6f6764734d20fdba65a07a041613697ca'
const FILES = [
  'Classes', 'Subclasses', 'Features', 'Levels', 'Feats', 'Traits', 'Backgrounds', 'Equipment',
  'Magic-Items', 'Spells', 'Conditions', 'Proficiencies',
]
const EDITION_FILES: Record<Edition, string[]> = {
  '2014': [...FILES, 'Races', 'Subraces'],
  '2024': [...FILES, 'Species', 'Subspecies', 'Weapon-Mastery-Properties'],
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, 'scripts', '.cache', SOURCE_COMMIT)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

async function load(edition: Edition, name: string): Promise<Raw[]> {
  const file = join(cacheDir, edition, `5e-SRD-${name}.json`)
  if (!existsSync(file)) {
    const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}/packages/5e-database/src/${edition}/en/5e-SRD-${name}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, await res.text())
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

// --- Helpers -----------------------------------------------------------------

const textOf = (x: Raw): string => {
  const d = x.desc ?? x.description ?? ''
  return (Array.isArray(d) ? d.join('\n\n') : String(d)).trim()
}

/** First sentence (or two short ones) as the list summary. */
function summarize(text: string): string {
  const plain = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? [plain]
  let out = ''
  for (const s of sentences) {
    if (out && (out + s).length > 220) break
    out += s
  }
  return out.trim().slice(0, 300)
}

const abilityOf = (index: string) => index.toLowerCase() as Ability

const armorProf: Record<string, string[]> = {
  'all-armor': ['light', 'medium', 'heavy'],
  'light-armor': ['light'],
  'medium-armor': ['medium'],
  'heavy-armor': ['heavy'],
  shields: ['shield'],
}

/** Split 5e-bits proficiency references into armor / weapons / tools. */
function splitProficiencies(list: Raw[], proficiencyType: Map<string, string>) {
  const out = { armor: [] as string[], weapons: [] as string[], tools: [] as string[] }
  for (const p of list ?? []) {
    const i: string = p.index
    if (i.startsWith('saving-throw-') || i.startsWith('skill-')) continue
    if (armorProf[i]) out.armor.push(...armorProf[i])
    else if (i === 'simple-weapons') out.weapons.push('simple')
    else if (i === 'martial-weapons') out.weapons.push('martial')
    else if (proficiencyType.get(i) === 'Weapons') out.weapons.push(i.replace(/s$/, ''))
    else out.tools.push(i.replace(/^tool-/, ''))
  }
  return out
}

function skillOptions(choice: Raw): string[] {
  const opts: Raw[] = choice?.from?.options ?? []
  return opts
    .map((o) => o.item?.index as string | undefined)
    .filter((i): i is string => !!i && i.startsWith('skill-'))
    .map((i) => i.replace(/^skill-/, ''))
    .filter((s) => s in skills)
}

const spellcastingByClass: Record<string, 'full' | 'half' | 'pact' | 'none'> = {
  bard: 'full', cleric: 'full', druid: 'full', sorcerer: 'full', wizard: 'full',
  paladin: 'half', ranger: 'half', warlock: 'pact',
}

/**
 * How each class casts. 2014 (SRD 5.1): Bard, Ranger, Sorcerer and Warlock know
 * a fixed number of spells; Cleric, Druid, Paladin and Wizard prepare
 * "ability + level" (Paladin: half level) from their list; Bard, Cleric,
 * Druid cast prepared/known rituals, the Wizard any ritual in the spellbook.
 * 2024 (SRD 5.2.1): every class prepares the number in its table; rituals
 * need the spell prepared (Rules Glossary), the Wizard's Ritual Adept allows
 * any ritual in the spellbook.
 */
function casterInfo(edition: Edition, classId: string, ability: string | undefined) {
  if (!ability || !spellcastingByClass[classId]) return undefined
  const known2014 = ['bard', 'ranger', 'sorcerer', 'warlock'].includes(classId)
  const formula2014: Record<string, string> = { cleric: 'wis + level', druid: 'wis + level', wizard: 'int + level', paladin: 'cha + floor(level / 2)' }
  const ritual2014: Record<string, string> = { bard: 'prepared', cleric: 'prepared', druid: 'prepared', wizard: 'book' }
  return {
    ability,
    mode: edition === '2014' && known2014 ? 'known' : 'prepared',
    spellbook: classId === 'wizard',
    preparedFormula: edition === '2014' ? formula2014[classId] : undefined,
    ritual: classId === 'wizard' ? 'book' : edition === '2014' ? (ritual2014[classId] ?? 'none') : 'prepared',
  }
}

function actionTypeOf(castingTime: string): 'action' | 'bonusAction' | 'reaction' | 'other' {
  const t = castingTime.toLowerCase()
  if (t.includes('bonus action')) return 'bonusAction'
  if (t.includes('reaction')) return 'reaction'
  if (t === '1 action' || t === 'action' || t.startsWith('action')) return 'action'
  return 'other'
}

/** 5e 2014 data has no ammunition link on weapons; the SRD names it in the text. */
const ammo2014: Record<string, string> = {
  longbow: 'arrow', shortbow: 'arrow', 'crossbow-light': 'crossbow-bolt', 'crossbow-heavy': 'crossbow-bolt',
  'crossbow-hand': 'crossbow-bolt', sling: 'sling-bullet', blowgun: 'blowgun-needle',
}

// --- Magic items -----------------------------------------------------------------

const abilityWord: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

/** Mundane items a magic weapon/armor may be built on, from its "Weapon (any sword)" header line. */
function baseFor(header: string, kind: 'weapon' | 'armor', mundane: Raw[]): { baseKind: string; baseOptions: string[]; unknown: string[] } {
  const h = header.toLowerCase().replace(/^any /, 'any ')
  const weapons = mundane.filter((e) => e.kind === 'weapon')
  const armor = mundane.filter((e) => e.kind === 'armor' && e.category !== 'shield')
  // Names compare without hyphens and a trailing " armor" ("Half-Plate Armor" = "half plate").
  const norm = (n: string) => n.toLowerCase().replace(/-/g, ' ').replace(/ armor$/, '')
  const byName = (pool: Raw[], name: string) => pool.find((e) => norm(e.name) === norm(name))
  const isSword = (e: Raw) => /sword|rapier|scimitar/i.test(e.name)
  const isAxe = (e: Raw) => /axe/i.test(e.name) && !/pickaxe/i.test(e.name)
  if (kind === 'weapon') {
    if (h === 'any ammunition') return { baseKind: 'ammunition', baseOptions: mundane.filter((e) => e.kind === 'ammunition').map((e) => e.id), unknown: [] }
    let pool: Raw[] | undefined
    if (h === 'any' || h === 'any simple or martial') pool = weapons
    else if (h === 'any melee weapon') pool = weapons.filter((e) => e.range === 'melee')
    else if (h === 'any sword') pool = weapons.filter(isSword)
    else if (h === 'any sword that deals slashing damage') pool = weapons.filter((e) => isSword(e) && e.damage?.type === 'slashing')
    else if (h === 'any axe') pool = weapons.filter(isAxe)
    else if (h === 'any axe or sword') pool = weapons.filter((e) => isAxe(e) || isSword(e))
    if (pool) return { baseKind: 'weapon', baseOptions: pool.map((e) => e.id), unknown: [] }
    const names = h.split(/,\s*|\s+or\s+/).map((n) => n.replace(/^or\s+/, '').trim()).filter(Boolean)
    // "Weapon (arrow)": a single piece of magic ammunition.
    const ammo = mundane.filter((e) => e.kind === 'ammunition')
    const asAmmo = names.map((n) => byName(ammo, n))
    if (asAmmo.every(Boolean)) return { baseKind: 'ammunition', baseOptions: asAmmo.map((e) => e!.id), unknown: [] }
    const found = names.map((n) => byName(weapons, n))
    return { baseKind: 'weapon', baseOptions: found.filter(Boolean).map((e) => e!.id), unknown: names.filter((_, i) => !found[i]) }
  }
  if (h === 'shield') return { baseKind: 'shield', baseOptions: mundane.filter((e) => e.kind === 'armor' && e.category === 'shield').map((e) => e.id), unknown: [] }
  if (/light, medium, or heavy/.test(h)) return { baseKind: 'armor', baseOptions: armor.map((e) => e.id), unknown: [] }
  if (/medium or heavy/.test(h)) {
    const noHide = /not hide|except hide/.test(h)
    return { baseKind: 'armor', baseOptions: armor.filter((e) => ['medium', 'heavy'].includes(e.category) && !(noHide && /^hide/i.test(e.name))).map((e) => e.id), unknown: [] }
  }
  const names = h.split(/,\s*|\s+or\s+/).map((n) => n.trim()).filter(Boolean)
  const found = names.map((n) => byName(armor, n) ?? byName(armor, `${n} armor`))
  return { baseKind: 'armor', baseOptions: found.filter(Boolean).map((e) => e!.id), unknown: names.filter((_, i) => !found[i]) }
}

/**
 * Numeric effects, base items and charges of magic items, read from the SRD
 * text with fixed patterns. Conditional bonuses ("against ranged attacks",
 * Defender's transferable bonus) are deliberately left as text.
 */
function magicItemMechanics(entities: Raw[], problems: string[]) {
  const mundane = entities.filter((e) => e.type === 'item' && !e.magic)
  const skip = new Set(['defender', 'rod-of-alertness', 'ioun-stone', 'arrow-catching-shield'])
  for (const e of entities) {
    if (e.type !== 'item' || !e.magic) continue
    const text: string = e.text ?? ''
    const effects: Raw[] = []

    // Base item from the header line, e.g. "Weapon (any sword), rare" / "Armor (Plate Armor)".
    const head = /^\s*(Weapon|Armor)\s*\(([^)]*)\)/i.exec(text)
    if (head && !e.tags.includes('variant-group')) {
      const kind = head[1].toLowerCase() as 'weapon' | 'armor'
      // 2024 magic ammunition variants name only their rarity in the header.
      const header = /^ammunition/.test(e.id) ? 'any ammunition' : head[2]
      const b = baseFor(header, kind, mundane)
      e.baseKind = b.baseKind
      e.baseOptions = b.baseOptions
      if (b.unknown.length) problems.push(`${e.id}: unknown base item(s) ${b.unknown.join(', ')}`)
    }

    if (!skip.has(e.id) && !e.consumable) {
      const atk = /\+(\d) bonus to attack (?:rolls )?and damage rolls/.exec(text)
      if (atk) effects.push({ target: 'attack', value: Number(atk[1]) }, { target: 'damage', value: Number(atk[1]) })
      const ac = /\+(\d) bonus to (?:AC|Armor Class)(?! against)/.exec(text)
      if (ac && e.id !== 'bracers-of-defense') effects.push({ target: 'ac', value: Number(ac[1]) })
      const save = /\+(\d) bonus to (?:[^.]*?(?:AC|Armor Class),? and |ability checks and |[^.]*?, )?saving throws(?! against)/.exec(text)
      if (save) effects.push({ target: 'save:all', value: Number(save[1]) })
      const checks = /\+(\d) bonus to ability checks/.exec(text)
      if (checks) effects.push({ target: 'check:all', value: Number(checks[1]) })
      const score = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?: score)? (?:is|changes to(?: a)?) (\d+)/.exec(text)
      if (score) effects.push({ target: `score:${abilityWord[score[1].toLowerCase()]}`, op: 'set', value: Number(score[2]) })
      const inc = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score increases by (\d), to a maximum of (\d+)/.exec(text)
      if (inc) effects.push({ target: `score:${abilityWord[inc[1].toLowerCase()]}`, value: Number(inc[2]), max: Number(inc[3]) })
      if (/proficiency bonus increases by 1/i.test(text)) effects.push({ target: 'pb', value: 1 })
      const robe = /base (?:AC|Armor Class) is (\d+) (?:\+|plus) your Dexterity modifier/.exec(text)
      if (robe) effects.push({ target: 'unarmoredAc', op: 'set', value: `${robe[1]} + dex` })
    }
    if (e.id === 'bracers-of-defense') effects.push({ target: 'ac', value: 2, when: 'noArmorNoShield' })
    // 2024 magic ammunition: the bonus follows the rarity (+1 uncommon, +2 rare, +3 very rare).
    const ammo = /^ammunition-(\d)$/.exec(e.id)
    if (ammo && !effects.length) effects.push({ target: 'attack', value: Number(ammo[1]) }, { target: 'damage', value: Number(ammo[1]) })
    if (effects.length) e.effects = [...(e.effects ?? []), ...effects]

    // Charges: "has 7 charges" … "regains 1d6 + 1 expended charges daily at dawn".
    const charges = /has (\d+) charges/.exec(text)
    if (charges && !e.tags.includes('variant-group')) {
      const regain = /regains (all|\d+d\d+(?:\s*\+\s*\d+)?) (?:of its )?expended charges(?: daily)? at dawn/i.exec(text)
      const recharge = regain
        ? [regain[1].toLowerCase() === 'all' ? { on: 'dawn', amount: 'all' } : { on: 'dawn', amount: 0, dice: regain[1].replace(/\s+/g, '') }]
        : []
      e.charges = { id: 'charges', name: 'Charges', max: Number(charges[1]), recharge }
    }
  }
}

// --- Conversion ----------------------------------------------------------------

async function build(edition: Edition) {
  const book = edition === '2014' ? 'srd-5.1' : 'srd-5.2'
  const source = { book }
  const files: Record<string, Raw[]> = {}
  for (const f of EDITION_FILES[edition]) files[f] = await load(edition, f)
  const entities: Raw[] = []
  const problems: string[] = []
  const base = (x: Raw) => {
    const text = textOf(x)
    return { id: x.index, edition, name: x.name, description: summarize(text), text: text || undefined, source }
  }
  const proficiencyType = new Map<string, string>(files.Proficiencies.map((p) => [p.index, p.type]))

  // Classes and their level tables.
  const levels = files.Levels
  for (const c of files.Classes) {
    const own = levels.filter((l) => l.class?.index === c.index && !l.subclass).sort((a, b) => a.level - b.level)
    const subLevels = levels.filter((l) => l.class?.index === c.index && l.subclass)
    const progression: Record<string, Record<string, number>> = {}
    for (const l of own) {
      for (const [k, v] of Object.entries(l.class_specific ?? {})) {
        if (typeof v === 'number') (progression[k] ??= {})[l.level] = v
      }
    }
    const skillChoice = (c.proficiency_choices ?? []).find((pc: Raw) => skillOptions(pc).length > 0)
    const mc = c.multi_classing ?? {}
    const prerequisites: { ability: Ability; min: number }[][] = []
    if (mc.prerequisite_options) {
      prerequisites.push(mc.prerequisite_options.from.options.map((o: Raw) => ({ ability: abilityOf(o.ability_score.index), min: o.minimum_score })))
    }
    for (const p of mc.prerequisites ?? []) prerequisites.push([{ ability: abilityOf(p.ability_score.index), min: p.minimum_score }])
    const mcSkillChoice = (mc.proficiency_choices ?? []).find((pc: Raw) => skillOptions(pc).length > 0)
    const choices: Raw[] = []
    if (skillChoice) choices.push({ id: 'skills', label: 'Skill proficiencies', kind: 'skill', count: skillChoice.choose, options: skillOptions(skillChoice) })
    if (mcSkillChoice) choices.push({ id: 'multiclass-skills', label: 'Skill proficiency (multiclass)', kind: 'skill', count: mcSkillChoice.choose, options: skillOptions(mcSkillChoice) })

    entities.push({
      ...base(c),
      description: `${c.name} class, hit die d${c.hit_die}.`,
      type: 'class',
      hitDie: c.hit_die,
      primaryAbility: (c.primary_ability?.ability_score_options?.from?.options ?? []).map((o: Raw) => abilityOf(o.item.index)),
      savingThrows: c.saving_throws.map((s: Raw) => abilityOf(s.index)),
      proficiencies: splitProficiencies(c.proficiencies, proficiencyType),
      skillChoice: { count: skillChoice?.choose ?? 0, options: skillChoice ? skillOptions(skillChoice) : [] },
      multiclass: {
        prerequisites,
        proficiencies: { ...splitProficiencies(mc.proficiencies ?? [], proficiencyType), skills: mcSkillChoice?.choose ?? 0 },
      },
      subclassLevel: Math.min(...subLevels.map((l) => l.level)),
      levels: own.map((l) => ({ level: l.level, features: (l.features ?? []).map((f: Raw) => f.index) })),
      progression,
      spellcasting: spellcastingByClass[c.index] ?? 'none',
      caster: casterInfo(edition, c.index, c.spellcasting?.spellcasting_ability?.index),
      spellTable: Object.fromEntries(
        own
          .filter((l) => l.spellcasting)
          .map((l) => {
            const sc = l.spellcasting
            return [
              l.level,
              {
                cantrips: sc.cantrips_known ?? 0,
                known: sc.spells_known,
                prepared: sc.prepared_spells,
                slots: Array.from({ length: 9 }, (_, i) => sc[`spell_slots_level_${i + 1}`] ?? 0),
              },
            ]
          }),
      ),
      choices,
    })
  }

  for (const s of files.Subclasses) {
    const own = levels.filter((l) => l.subclass?.index === s.index).sort((a, b) => a.level - b.level)
    entities.push({
      ...base(s),
      type: 'subclass',
      class: s.class.index,
      levels: own.map((l) => ({ level: l.level, features: (l.features ?? []).map((f: Raw) => f.index) })),
    })
  }

  for (const f of files.Features) {
    const options: string[] = (f.feature_specific?.subfeature_options?.from?.options ?? []).map((o: Raw) => o.item.index)
    entities.push({
      ...base(f),
      type: 'feature',
      parent: f.subclass?.index ?? f.class?.index,
      optionOf: f.parent?.index,
      choices: options.length
        ? [{ id: 'option', label: f.name, kind: 'entity', count: f.feature_specific.subfeature_options.choose, from: { ids: options } }]
        : [],
    })
  }

  for (const f of files.Feats) {
    // 2014: list of ability minimums. 2024: { minimum_level, feature_named }.
    const prereqs: Raw[] = Array.isArray(f.prerequisites) ? f.prerequisites : []
    const level: number | undefined = Array.isArray(f.prerequisites) ? undefined : f.prerequisites?.minimum_level
    const featureNamed: string | undefined = Array.isArray(f.prerequisites) ? undefined : f.prerequisites?.feature_named
    const abilitiesReq = prereqs.filter((p) => p.ability_score).map((p) => ({ ability: abilityOf(p.ability_score.index), min: p.minimum_score }))
    entities.push({
      ...base(f),
      type: 'feat',
      category: f.type,
      tags: f.type ? [f.type] : [],
      prerequisite:
        level || featureNamed || abilitiesReq.length
          ? { level, abilities: abilitiesReq.length ? abilitiesReq : undefined, text: featureNamed && `${featureNamed} feature` }
          : undefined,
    })
  }

  for (const t of files.Traits) {
    const effects = (t.proficiencies ?? [])
      .filter((p: Raw) => p.index.startsWith('skill-'))
      .map((p: Raw) => ({ target: `proficiency:skill:${p.index.replace(/^skill-/, '')}`, op: 'add', value: 1 }))
    entities.push({ ...base(t), type: 'trait', effects })
  }

  if (edition === '2014') {
    for (const r of files.Races) {
      const choices: Raw[] = []
      if (r.ability_bonus_options) {
        choices.push({
          id: 'ability-bonus', label: 'Ability score increase', kind: 'abilityPoints',
          points: r.ability_bonus_options.choose, perOption: 1, scoreCap: 20,
          options: r.ability_bonus_options.from.options.map((o: Raw) => abilityOf(o.ability_score.index)),
        })
      }
      const skillChoice = (r.starting_proficiency_options ? [r.starting_proficiency_options] : []).find((pc: Raw) => skillOptions(pc).length)
      if (skillChoice) choices.push({ id: 'skills', label: 'Skill proficiencies', kind: 'skill', count: skillChoice.choose, options: skillOptions(skillChoice) })
      entities.push({
        ...base(r),
        text: [r.age, r.size_description, r.language_desc].filter(Boolean).join('\n\n') || undefined,
        description: `${r.name}: ${r.size}, speed ${r.speed} ft.`,
        type: 'species',
        size: r.size,
        speed: r.speed,
        traits: (r.traits ?? []).map((t: Raw) => t.index),
        subspecies: (r.subraces ?? []).map((s: Raw) => s.index),
        abilityBonuses: (r.ability_bonuses ?? []).map((b: Raw) => ({ ability: abilityOf(b.ability_score.index), bonus: b.bonus })),
        languages: (r.languages ?? []).map((l: Raw) => l.index),
        choices,
      })
    }
    for (const s of files.Subraces) {
      entities.push({
        ...base(s),
        type: 'subspecies',
        species: s.race.index,
        traits: (s.racial_traits ?? []).map((t: Raw) => t.index),
        abilityBonuses: (s.ability_bonuses ?? []).map((b: Raw) => ({ ability: abilityOf(b.ability_score.index), bonus: b.bonus })),
      })
    }
  } else {
    for (const s of files.Species) {
      entities.push({
        ...base(s),
        description: `${s.name}: ${s.size ?? 'varies'}, speed ${s.speed} ft.`,
        type: 'species',
        size: s.size ?? 'Medium',
        speed: s.speed,
        traits: (s.traits ?? []).map((t: Raw) => t.index),
        subspecies: (s.subspecies ?? []).map((x: Raw) => x.index),
      })
    }
    for (const s of files.Subspecies) {
      entities.push({
        ...base(s),
        type: 'subspecies',
        species: s.species.index,
        traits: (s.traits ?? []).map((t: Raw) => t.index),
      })
    }
  }

  for (const b of files.Backgrounds) {
    const profs: Raw[] = b.starting_proficiencies ?? b.proficiencies ?? []
    const features: string[] = []
    if (b.feature) {
      const id = `${b.index}-feature`
      const text = (b.feature.desc ?? []).join('\n\n')
      entities.push({ id, edition, name: b.feature.name, description: summarize(text), text, source, type: 'feature', parent: b.index })
      features.push(id)
    }
    entities.push({
      ...base(b),
      description: `${b.name} background.`,
      type: 'background',
      skills: profs.filter((p) => p.index.startsWith('skill-')).map((p) => p.index.replace(/^skill-/, '')),
      tools: profs.filter((p) => p.index.startsWith('tool-')).map((p) => p.index.replace(/^tool-/, '')),
      abilityOptions: (b.ability_scores ?? []).map((a: Raw) => abilityOf(a.index)),
      feat: b.feat?.index,
      features,
    })
  }

  // Equipment.
  for (const e of files.Equipment) {
    const cats = new Set<string>((e.equipment_categories ?? []).map((c: Raw) => c.index))
    const common = {
      ...base(e),
      type: 'item',
      weight: e.weight ?? 0,
      cost: e.cost ? { amount: e.cost.quantity, unit: e.cost.unit } : undefined,
    }
    if (e.damage || cats.has('weapon') || cats.has('weapons')) {
      const ranged = e.weapon_range ? e.weapon_range === 'Ranged' : cats.has('ranged-weapons')
      const props: string[] = (e.properties ?? []).map((p: Raw) => p.index).filter((p: string) => p !== 'monk')
      const distance = ranged ? e.range : e.throw_range
      entities.push({
        ...common,
        description: [e.damage && `${e.damage.damage_dice} ${e.damage.damage_type.name.toLowerCase()}`, props.join(', ')].filter(Boolean).join('; '),
        kind: 'weapon',
        category: (e.weapon_category ?? (cats.has('martial-weapons') ? 'Martial' : 'Simple')).toLowerCase(),
        range: ranged ? 'ranged' : 'melee',
        damage: e.damage ? { dice: e.damage.damage_dice, type: e.damage.damage_type.index } : undefined,
        versatileDamage: e.two_handed_damage?.damage_dice,
        properties: props,
        distance: distance?.normal ? { normal: distance.normal, long: distance.long } : undefined,
        mastery: e.mastery?.index,
        ammunition: e.ammunition?.index ?? ammo2014[e.index],
      })
    } else if (e.armor_class) {
      const category = cats.has('shields') ? 'shield' : cats.has('heavy-armor') ? 'heavy' : cats.has('medium-armor') ? 'medium' : 'light'
      const ac = e.armor_class
      entities.push({
        ...common,
        description: category === 'shield' ? `+${ac.base} AC` : `AC ${ac.base}${ac.dex_bonus ? (ac.max_bonus ? ` + Dex (max ${ac.max_bonus})` : ' + Dex') : ''}`,
        kind: 'armor',
        category,
        ac: { base: ac.base, dex: !!ac.dex_bonus, maxDex: ac.dex_bonus && ac.max_bonus ? ac.max_bonus : undefined },
        strMin: e.str_minimum ?? 0,
        stealthDisadvantage: !!e.stealth_disadvantage,
      })
    } else if (cats.has('ammunition')) {
      entities.push({
        ...common,
        kind: 'ammunition',
        bundle: e.quantity,
        // Both SRDs: after a fight, recover half of the expended ammunition.
        recoverable: true,
        ammoKind: e.index,
      })
    } else {
      const kind = cats.has('tools') || cats.has('artisans-tools') || cats.has('gaming-sets') || cats.has('musical-instruments') || cats.has('other-tools') || cats.has('kits')
        ? 'tool'
        : cats.has('equipment-packs') ? 'pack' : 'gear'
      entities.push({ ...common, kind })
    }
  }

  // Magic items. Weapons and armor become wondrous entries for now; inventory
  // (milestone 5) maps them onto a base weapon or armor.
  const miKind: Record<string, string> = {
    potion: 'potion', potions: 'potion', ring: 'ring', rings: 'ring', rod: 'rod', staff: 'staff', staffs: 'staff',
    wand: 'wand', wands: 'wand', scroll: 'scroll',
  }
  for (const m of files['Magic-Items']) {
    const text = textOf(m)
    const head: string = Array.isArray(m.desc) ? m.desc[0] : ''
    const cat: string = m.equipment_category?.index ?? ''
    const tags: string[] = []
    if (cat === 'weapon' || cat === 'weapons') tags.push('magic-weapon')
    if (cat === 'armor') tags.push('magic-armor')
    if (m.variants?.length) tags.push('variant-group')
    const group = files['Magic-Items'].find((g: Raw) => g.variants?.some((v: Raw) => v.index === m.index))
    if (group) tags.push(`variant-of:${group.index}`)
    const kind = miKind[cat] ?? 'wondrous'
    entities.push({
      ...base(m),
      // Skip the "Wondrous item, rare (requires attunement)" header line in the summary.
      description: summarize(Array.isArray(m.desc) ? m.desc.slice(1).join(' ') : text),
      type: 'item',
      kind,
      magic: true,
      rarity: m.rarity?.name,
      attunement: m.attunement ?? /requires attunement/i.test(head),
      consumable: kind === 'potion' || kind === 'scroll',
      tags,
    })
  }

  magicItemMechanics(entities, problems)

  for (const s of files.Spells) {
    const text = textOf(s)
    // 2014 data names the save and attack; 2024 only has them in the text.
    const save = s.dc?.dc_type?.index ?? /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(text)?.[1]
    const attack = s.attack_type ?? /(melee|ranged) spell attack/i.exec(text)?.[1]?.toLowerCase()
    const dmg = Array.isArray(s.damage) ? s.damage[0] : s.damage
    let dmgBy: 'character' | 'slot' | undefined = dmg?.damage_at_character_level ? 'character' : dmg?.damage_at_slot_level ? 'slot' : undefined
    let dmgDice: Record<string, string> | undefined = dmgBy === 'character' ? dmg.damage_at_character_level : dmg?.damage_at_slot_level
    let heal: Record<string, string> | undefined = s.heal_at_slot_level
    // 2024 data lists only the base dice; scaling is in the text.
    if (edition === '2024' && dmgDice) {
      const base = Object.values(dmgDice)[0]
      const m = /^(\d+)d(\d+)$/.exec(base)
      if (s.level === 0 && m && /Cantrip Upgrade/i.test(text)) {
        // "The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10)."
        dmgBy = 'character'
        dmgDice = Object.fromEntries([1, 5, 11, 17].map((lvl, i) => [lvl, `${Number(m[1]) * (i + 1)}d${m[2]}`]))
      } else if (s.level > 0 && m) {
        const step = /increases by (\d+)d(\d+) for each spell slot level above (\d)/.exec(text + ' ' + (s.higher_level ?? ''))
        if (step && step[2] === m[2]) {
          dmgDice = Object.fromEntries(Array.from({ length: 10 - s.level }, (_, i) => [s.level + i, `${Number(m[1]) + Number(step[1]) * i}d${m[2]}`]))
        }
      }
    }
    if (edition === '2024' && !heal) {
      const h = /regains? (?:a number of )?Hit Points equal to (\d+)d(\d+) plus your spellcasting ability modifier/.exec(text)
      if (h) {
        const step = /healing increases by (\d+)d(\d+) for each spell slot level above (\d)/.exec(text)
        heal = Object.fromEntries(Array.from({ length: 10 - s.level }, (_, i) => [s.level + i, `${Number(h[1]) + (step ? Number(step[1]) * i : 0)}d${h[2]} + MOD`]))
      }
    }
    entities.push({
      ...base(s),
      save: save ? abilityOf(save.slice(0, 3)) : undefined,
      attack,
      damage: dmgBy && dmg.damage_type && dmgDice ? { type: dmg.damage_type.index, by: dmgBy, dice: dmgDice } : undefined,
      heal,
      type: 'spell',
      level: s.level,
      school: s.school.index,
      castingTime: s.casting_time,
      actionType: actionTypeOf(s.casting_time),
      range: s.range,
      components: s.components ?? [],
      material: s.material,
      duration: s.duration,
      concentration: !!s.concentration,
      ritual: !!s.ritual,
      classes: (s.classes ?? []).map((c: Raw) => c.index),
      higherLevels: Array.isArray(s.higher_level) ? s.higher_level.join('\n\n') || undefined : s.higher_level,
    })
  }

  for (const c of files.Conditions) entities.push({ ...base(c), type: 'condition' })
  for (const m of files['Weapon-Mastery-Properties'] ?? []) entities.push({ ...base(m), type: 'weaponMastery' })

  // De-duplicate ids across files (5e-bits reuses a few indexes between types).
  // A clashing trait is renamed and the `traits` lists that point to it are
  // updated; spells and magic items are never referenced by id from the data.
  const seen = new Map<string, Raw>()
  const renamedTraits = new Map<string, string>()
  for (const e of entities) {
    const prev = seen.get(e.id)
    if (prev) {
      const trait = prev.type === 'trait' ? prev : e.type === 'trait' ? e : undefined
      if (trait) {
        renamedTraits.set(trait.id, `${trait.id}-trait`)
        seen.delete(trait.id)
        trait.id = `${trait.id}-trait`
        seen.set(trait.id, trait)
        if (trait === e) continue
      } else if (prev.type === 'spell' && e.type !== 'spell') {
        seen.delete(prev.id)
        prev.id = `spell-${prev.id}`
        seen.set(prev.id, prev)
      } else if (e.type === 'spell' && prev.type !== 'spell') e.id = `spell-${e.id}`
      else if (e.magic && !prev.magic) e.id = `magic-${e.id}`
      else throw new Error(`Duplicate id ${e.id} (${prev.type}, ${e.type})`)
    }
    seen.set(e.id, e)
  }
  for (const e of entities) {
    if (Array.isArray(e.traits)) e.traits = e.traits.map((t: string) => renamedTraits.get(t) ?? t)
  }

  const byId = new Map<string, Raw>(entities.map((e) => [e.id, e]))
  problems.push(...applyOverlay(edition, byId))

  const pack = Pack.parse({
    id: `srd-${edition}`,
    name: edition === '2014' ? 'System Reference Document 5.1' : 'System Reference Document 5.2',
    edition,
    version: SOURCE_COMMIT.slice(0, 7),
    book,
    entities: [...byId.values()] as Entity[],
  })

  const outDir = join(root, 'src', 'data', 'srd')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, `${edition}.json`), JSON.stringify(pack))
  const counts = new Map<string, number>()
  for (const e of pack.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  console.log(`${edition}: ${pack.entities.length} entities`, Object.fromEntries(counts))
  for (const p of problems) console.warn(`  ! ${p}`)
}

await build('2014')
await build('2024')
