// What a character sheet PDF can be filled with: one catalogue of fields (with words that
// help find them on a page) and the values of one character. Pure; used by the PDF export.
import type { ContentIndex } from '../../content'
import { abilities, skills, type Ability, type Skill } from '../../content/schema'
import type { Character } from '../character'
import type { Sheet } from '../derive'

export type ExportKind = 'text' | 'check' | 'multiline'
export type ExportField = {
  key: string
  label: string
  kind: ExportKind
  group: string
  /** Words printed next to such a field on sheets (lower case), for the automatic analysis. */
  hints: string[]
}

const abilityNames: Record<Ability, string> = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }
const skillName = (s: Skill) => s.replace(/-/g, ' ')
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export const MAX_ATTACKS = 8
export const MAX_SPELLS = 40

/** Every field the export knows, in a stable order (groups for the mapping editor). */
export function exportCatalogue(): ExportField[] {
  const f: ExportField[] = []
  const add = (key: string, label: string, group: string, hints: string[], kind: ExportKind = 'text') => f.push({ key, label, kind, group, hints })
  add('name', 'Character name', 'identity', ['character name', 'name'])
  add('class', 'Class & level', 'identity', ['class & level', 'class and level', 'class'])
  add('className', 'Class', 'identity', ['class'])
  add('level', 'Level', 'identity', ['level'])
  add('subclass', 'Subclass', 'identity', ['subclass', 'archetype'])
  add('species', 'Species / race', 'identity', ['species', 'race', 'lineage'])
  add('background', 'Background', 'identity', ['background'])
  add('xp', 'Experience points', 'identity', ['xp', 'experience points', 'experience'])
  add('size', 'Size', 'identity', ['size'])
  for (const a of abilities) {
    const n = abilityNames[a]
    add(`${a}.score`, `${cap(n)} score`, 'abilities', [n, a, 'score'])
    add(`${a}.mod`, `${cap(n)} modifier`, 'abilities', [n, a, 'modifier', 'mod'])
    add(`${a}.save`, `${cap(n)} saving throw`, 'saves', [n, a, 'saving throw', 'save'])
    add(`${a}.saveProf`, `${cap(n)} save proficiency`, 'saves', [n, a, 'saving throw', 'save'], 'check')
  }
  for (const s of Object.keys(skills) as Skill[]) {
    add(`skill.${s}`, cap(skillName(s)), 'skills', [skillName(s)])
    add(`skill.${s}.prof`, `${cap(skillName(s))} proficiency`, 'skills', [skillName(s)], 'check')
    add(`skill.${s}.expertise`, `${cap(skillName(s))} expertise`, 'skills', [skillName(s), 'expertise'], 'check')
  }
  add('pb', 'Proficiency bonus', 'combat', ['proficiency bonus', 'proficiency'])
  add('ac', 'Armor class', 'combat', ['armor class', 'armour class', 'ac'])
  add('initiative', 'Initiative', 'combat', ['initiative'])
  add('speed', 'Speed', 'combat', ['speed'])
  add('passivePerception', 'Passive Perception', 'combat', ['passive perception', 'passive wisdom'])
  add('passiveInsight', 'Passive Insight', 'combat', ['passive insight'])
  add('passiveInvestigation', 'Passive Investigation', 'combat', ['passive investigation'])
  add('hp.max', 'Hit point maximum', 'combat', ['hit point maximum', 'max', 'maximum', 'hit points'])
  add('hitDice', 'Hit dice (total)', 'combat', ['hit dice', 'total'])
  add('senses', 'Senses', 'combat', ['senses'])
  for (let i = 1; i <= MAX_ATTACKS; i++) {
    add(`attack.${i}.name`, `Attack ${i}: name`, 'attacks', ['name', 'weapon', 'attack'])
    add(`attack.${i}.bonus`, `Attack ${i}: bonus / DC`, 'attacks', ['atk bonus', 'attack bonus', 'bonus', 'dc'])
    add(`attack.${i}.damage`, `Attack ${i}: damage & type`, 'attacks', ['damage', 'damage & type', 'damage/type'])
    add(`attack.${i}.notes`, `Attack ${i}: notes`, 'attacks', ['notes', 'properties'])
  }
  add('attacks', 'Attacks (all, one per line)', 'attacks', ['attacks', 'weapons', 'attacks & spellcasting'], 'multiline')
  add('spell.class', 'Spellcasting class', 'spells', ['spellcasting class'])
  add('spell.ability', 'Spellcasting ability', 'spells', ['spellcasting ability'])
  add('spell.mod', 'Spellcasting modifier', 'spells', ['spellcasting modifier'])
  add('spell.dc', 'Spell save DC', 'spells', ['spell save dc', 'save dc'])
  add('spell.attack', 'Spell attack bonus', 'spells', ['spell attack bonus', 'spell attack'])
  for (let l = 1; l <= 9; l++) add(`slots.${l}`, `Level ${l} slots`, 'spells', [`level ${l}`, 'slots', 'total'])
  add('cantrips', 'Cantrips (one per line)', 'spells', ['cantrips'], 'multiline')
  add('spells', 'Spells (one per line)', 'spells', ['spells', 'prepared spells', 'spells known'], 'multiline')
  for (let i = 1; i <= MAX_SPELLS; i++) {
    add(`spell.${i}.level`, `Spell ${i}: level`, 'spellList', ['level', 'lvl'])
    add(`spell.${i}.name`, `Spell ${i}: name`, 'spellList', ['name', 'spell'])
    add(`spell.${i}.time`, `Spell ${i}: casting time`, 'spellList', ['casting time', 'time'])
    add(`spell.${i}.range`, `Spell ${i}: range`, 'spellList', ['range'])
    add(`spell.${i}.conc`, `Spell ${i}: concentration`, 'spellList', ['c', 'concentration'], 'check')
    add(`spell.${i}.ritual`, `Spell ${i}: ritual`, 'spellList', ['r', 'ritual'], 'check')
    add(`spell.${i}.material`, `Spell ${i}: material`, 'spellList', ['m', 'material'], 'check')
    add(`spell.${i}.notes`, `Spell ${i}: notes`, 'spellList', ['notes'])
  }
  for (let i = 1; i <= 12; i++) add(`cantrip.${i}`, `Cantrip ${i}`, 'spellsByLevel', ['cantrips'])
  for (let l = 1; l <= 9; l++) for (let i = 1; i <= 14; i++) add(`lvl.${l}.${i}`, `Level ${l} spell ${i}`, 'spellsByLevel', [`level ${l}`])
  add('features.class', 'Class features', 'features', ['class features', 'features'], 'multiline')
  add('features.other', 'Species traits and feats', 'features', ['additional features', 'other features'], 'multiline')
  add('features.class.1', 'Class features (first half)', 'features', ['class features'], 'multiline')
  add('features.class.2', 'Class features (second half)', 'features', [], 'multiline')
  add('features.species', 'Species traits', 'features', ['species traits', 'racial traits', 'traits'], 'multiline')
  add('feats', 'Feats', 'features', ['feats'], 'multiline')
  add('features', 'Features & traits (all)', 'features', ['features & traits', 'features and traits', 'features'], 'multiline')
  add('prof.armor.light', 'Armor training: light', 'proficiencies', ['light'], 'check')
  add('prof.armor.medium', 'Armor training: medium', 'proficiencies', ['medium'], 'check')
  add('prof.armor.heavy', 'Armor training: heavy', 'proficiencies', ['heavy'], 'check')
  add('prof.armor.shields', 'Armor training: shields', 'proficiencies', ['shields', 'shield'], 'check')
  add('prof.armor', 'Armor proficiencies', 'proficiencies', ['armor'])
  add('prof.weapons', 'Weapon proficiencies', 'proficiencies', ['weapons'], 'multiline')
  add('prof.tools', 'Tool proficiencies', 'proficiencies', ['tools'], 'multiline')
  add('languages', 'Languages', 'proficiencies', ['languages'], 'multiline')
  add('proficiencies', 'Proficiencies & languages (all)', 'proficiencies', ['proficiencies & languages', 'other proficiencies & languages', 'proficiencies'], 'multiline')
  add('equipment', 'Equipment', 'equipment', ['equipment', 'inventory'], 'multiline')
  for (const c of ['cp', 'sp', 'ep', 'gp', 'pp']) add(`coins.${c}`, c.toUpperCase(), 'equipment', [c])
  for (let i = 1; i <= 3; i++) add(`attuned.${i}`, `Attuned item ${i}`, 'equipment', ['attunement', 'attuned'])
  add('notes', 'Notes', 'other', ['notes'], 'multiline')
  return f
}

/** The values of one character for every catalogue key (empty ones left out). */
export function exportValues(char: Character, sheet: Sheet, content: ContentIndex): Record<string, string | boolean> {
  const v: Record<string, string | boolean> = {}
  const name = (id: string | undefined) => (id ? (content.get(id)?.name ?? id) : '')
  const classes = char.classes.map((c) => ({ name: name(c.classId), level: c.level, sub: name(c.subclassId) }))
  v.name = char.name
  v.class = classes.map((c) => `${c.name} ${c.level}`).join(' / ')
  v.className = classes.map((c) => c.name).join(' / ')
  v.level = String(sheet.characterLevel)
  v.subclass = classes.map((c) => c.sub).filter(Boolean).join(' / ')
  v.species = [name(char.speciesId), name(char.subspeciesId)].filter(Boolean).join(' – ')
  v.background = name(char.backgroundId)
  if (char.xp) v.xp = String(char.xp)
  const species = content.getTyped(char.speciesId, 'species')
  if (species) v.size = species.size
  for (const a of abilities) {
    v[`${a}.score`] = String(sheet.scores[a].value)
    v[`${a}.mod`] = signed(sheet.mods[a])
    v[`${a}.save`] = signed(sheet.saves[a].value)
    v[`${a}.saveProf`] = sheet.saves[a].proficient
  }
  for (const s of Object.keys(skills) as Skill[]) {
    const sk = sheet.skills[s]
    v[`skill.${s}`] = signed(sk.value)
    v[`skill.${s}.prof`] = sk.proficiency > 0
    v[`skill.${s}.expertise`] = sk.proficiency >= 2
  }
  v.pb = signed(sheet.pb.value)
  v.ac = String(sheet.ac.value)
  v.initiative = signed(sheet.initiative.value)
  v.speed = [`${sheet.speed.value} ft`, ...Object.entries(sheet.speeds).map(([k, ft]) => `${k} ${ft} ft`)].join(', ')
  v.passivePerception = String(sheet.passivePerception.value)
  v.passiveInsight = String(10 + sheet.skills.insight.value)
  v.passiveInvestigation = String(10 + sheet.skills.investigation.value)
  v['hp.max'] = String(sheet.hpMax.value)
  v.hitDice = sheet.hitDice.map((p) => `${p.total}d${p.die}`).join(' + ')
  const senses = Object.entries(sheet.senses).map(([k, ft]) => `${cap(k)} ${ft} ft`)
  if (senses.length) v.senses = senses.join(', ')

  // Attacks: weapons first, then spell attacks marked ★ would need more room; weapons only here.
  const attackLines: string[] = []
  sheet.attacks.slice(0, MAX_ATTACKS).forEach((a, i) => {
    const n = i + 1
    const dmg = `${a.damageDice === '1' ? Math.max(1, 1 + a.damage.value) : a.damageDice}${a.damageDice !== '1' && a.damage.value ? signed(a.damage.value) : ''} ${a.damageType}`.trim()
    const notes = [a.range ? `${a.range.normal}/${a.range.long ?? a.range.normal} ft` : a.reach && a.reach > 5 ? `reach ${a.reach} ft` : '', a.properties.join(', '), a.mastery ? `Mastery: ${name(a.mastery)}` : ''].filter(Boolean).join('; ')
    v[`attack.${n}.name`] = a.name
    v[`attack.${n}.bonus`] = signed(a.attack.value)
    v[`attack.${n}.damage`] = dmg
    if (notes) v[`attack.${n}.notes`] = notes
    attackLines.push(`${a.name}: ${signed(a.attack.value)}, ${dmg}${notes ? ` (${notes})` : ''}`)
  })
  if (attackLines.length) v.attacks = attackLines.join('\n')

  // Spellcasting: the first casting class (most sheets have room for one).
  const caster = sheet.spellcasting.casters[0]
  if (caster) {
    v['spell.class'] = sheet.spellcasting.casters.map((c) => c.name).join(' / ')
    v['spell.ability'] = caster.ability.toUpperCase()
    v['spell.mod'] = signed(sheet.mods[caster.ability])
    v['spell.dc'] = String(caster.dc)
    v['spell.attack'] = signed(caster.attack)
  }
  for (const s of sheet.spellcasting.slots) v[`slots.${s.level}`] = String(sheet.resources.find((r) => r.key === s.key)?.max ?? s.max)
  if (sheet.spellcasting.pact) v[`slots.${sheet.spellcasting.pact.level}`] = `${sheet.spellcasting.pact.max} (Pact)`
  const rows = [...new Map(sheet.spellcasting.rows.filter((r) => r.castable || r.canRitual).map((r) => [r.spell.id, r])).values()].sort(
    (a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name),
  )
  const cantrips = rows.filter((r) => r.spell.level === 0)
  const leveled = rows.filter((r) => r.spell.level > 0)
  if (cantrips.length) v.cantrips = cantrips.map((r) => r.spell.name).join('\n')
  if (leveled.length) v.spells = leveled.map((r) => `L${r.spell.level} ${r.spell.name}${r.spell.concentration ? ' (C)' : ''}${r.spell.ritual ? ' (R)' : ''}`).join('\n')
  // By level, one per line (sheets that list spells per level).
  cantrips.slice(0, 12).forEach((r, i) => (v[`cantrip.${i + 1}`] = r.spell.name))
  for (let l = 1; l <= 9; l++) leveled.filter((r) => r.spell.level === l).slice(0, 14).forEach((r, i) => (v[`lvl.${l}.${i + 1}`] = r.spell.name))
  rows.slice(0, MAX_SPELLS).forEach((r, i) => {
    const n = i + 1
    const s = r.spell
    v[`spell.${n}.level`] = s.level === 0 ? 'C' : String(s.level)
    v[`spell.${n}.name`] = s.name
    v[`spell.${n}.time`] = s.castingTime
    v[`spell.${n}.range`] = s.range
    v[`spell.${n}.conc`] = s.concentration
    v[`spell.${n}.ritual`] = s.ritual
    v[`spell.${n}.material`] = s.components.includes('M')
    const note = s.brief ?? ''
    if (note) v[`spell.${n}.notes`] = note.length > 60 ? `${note.slice(0, 57)}…` : note
  })

  // Features by where they come from (upgrades folded into their base).
  const line = (e: { name: string; description: string }) => (e.description ? `${e.name}: ${e.description}` : e.name)
  const shown = sheet.active.filter((ae) => !ae.hidden && !ae.item)
  const byType = (pred: (t: string, parent?: string) => boolean) =>
    shown.filter((ae) => pred(ae.entity.type, ae.entity.type === 'feature' ? ae.entity.parent : undefined)).map((ae) => ae.entity)
  const classFeatures = byType((t) => t === 'feature').filter((e) => e.type === 'feature' && !e.tags.includes('core'))
  const traits = byType((t) => t === 'trait')
  const feats = byType((t) => t === 'feat')
  if (classFeatures.length) {
    v['features.class'] = classFeatures.map(line).join('\n')
    // Two columns on some sheets: split by length so both halves get about the same amount of text.
    const lines = classFeatures.map(line)
    // Weigh by wrapped lines (each feature starts a new line), not characters.
    const weight = (l: string) => Math.ceil(l.length / 55)
    const total = lines.reduce((s, l) => s + weight(l), 0)
    let acc = 0
    const cut = Math.max(1, lines.findIndex((l) => (acc += weight(l)) > total / 2))
    v['features.class.1'] = lines.slice(0, cut).join('\n')
    if (lines.length > cut) v['features.class.2'] = lines.slice(cut).join('\n')
  }
  if (traits.length) v['features.species'] = traits.map(line).join('\n')
  if (feats.length) v.feats = feats.map(line).join('\n')
  if (traits.length || feats.length) v['features.other'] = [...traits, ...feats].map(line).join('\n')
  const all = [...classFeatures, ...traits, ...feats]
  if (all.length) v.features = all.map((e) => e.name).join(', ')

  const armor = new Set(sheet.armorProficiencies)
  v['prof.armor.light'] = armor.has('light') || armor.has('all')
  v['prof.armor.medium'] = armor.has('medium') || armor.has('all')
  v['prof.armor.heavy'] = armor.has('heavy') || armor.has('all')
  v['prof.armor.shields'] = armor.has('shield') || armor.has('shields') || armor.has('all')
  const list = (ids: string[]) => ids.map((id) => (content.get(id)?.name ?? cap(id.replace(/-/g, ' ')))).join(', ')
  if (armor.size) v['prof.armor'] = list([...armor])
  if (sheet.weaponProficiencies.length) v['prof.weapons'] = list(sheet.weaponProficiencies)
  if (sheet.toolProficiencies.length) v['prof.tools'] = list(sheet.toolProficiencies)
  if (sheet.languages.length) v.languages = list(sheet.languages)
  v.proficiencies = [
    v['prof.armor'] && `Armor: ${v['prof.armor']}`,
    v['prof.weapons'] && `Weapons: ${v['prof.weapons']}`,
    v['prof.tools'] && `Tools: ${v['prof.tools']}`,
    v.languages && `Languages: ${v.languages}`,
  ]
    .filter(Boolean)
    .join('\n')

  const items = sheet.items.map((r) => `${r.entry.quantity > 1 ? `${r.entry.quantity}× ` : ''}${r.entry.label ?? r.name}${r.entry.equipped ? ' (equipped)' : ''}`)
  if (items.length) v.equipment = items.join('\n')
  for (const c of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) if (char.currency[c]) v[`coins.${c}`] = String(char.currency[c])
  sheet.items.filter((r) => r.entry.attuned).slice(0, 3).forEach((r, i) => (v[`attuned.${i + 1}`] = r.entry.label ?? r.name))
  if (char.notes) v.notes = char.notes
  for (const [k, val] of Object.entries(v)) if (val === '') delete v[k]
  return v
}
