// Automatic analysis of a character sheet PDF: from the printed words and the form fields
// (positions only), guess which export value each field takes. A best effort: the player
// checks and corrects the result in the mapping editor.
import { abilities, skills, type Skill } from '../../content/schema'
import { MAX_ATTACKS, MAX_SPELLS } from './values'
import type { TemplateField } from './template'

export type Word = { page: number; x: number; y: number; w: number; h: number; text: string }
export type Widget = { page: number; name: string; type: 'text' | 'check'; multiline?: boolean; x: number; y: number; w: number; h: number }
type Phrase = { page: number; x: number; y: number; w: number; h: number; text: string }

const abilityNames = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' } as const
const norm = (s: string) => s.toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9&/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Words on one line close together become phrases ("Sleight of Hand", "Armor Class"). */
export function phrases(words: Word[]): Phrase[] {
  const sorted = [...words].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  const out: Phrase[] = []
  for (const w of sorted) {
    const last = out[out.length - 1]
    const sameLine = last && last.page === w.page && Math.abs(last.y - w.y) < Math.max(2, w.h * 0.35)
    const close = last && w.x - (last.x + last.w) < Math.max(3, w.h * 0.45) && w.x >= last.x
    if (sameLine && close) {
      last.text += ` ${w.text}`
      last.w = w.x + w.w - last.x
      last.h = Math.max(last.h, w.h)
    } else out.push({ ...w })
  }
  return out.map((p) => ({ ...p, text: norm(p.text) })).filter((p) => p.text)
}

const overlapX = (a: { x: number; w: number }, b: { x: number; w: number }) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
const overlapY = (a: { y: number; h: number }, b: { y: number; h: number }) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)

/** Neighbouring labels of one field. */
function around(w: Widget, ps: Phrase[]) {
  const same = ps.filter((p) => p.page === w.page)
  const right = same.filter((p) => overlapY(p, w) > Math.min(p.h, w.h) * 0.3 && p.x >= w.x + w.w - 2 && p.x - (w.x + w.w) < 40).sort((a, b) => a.x - b.x)[0]
  const left = same.filter((p) => overlapY(p, w) > Math.min(p.h, w.h) * 0.3 && p.x + p.w <= w.x + 2 && w.x - (p.x + p.w) < 40).sort((a, b) => b.x - a.x)[0]
  const below = same.filter((p) => overlapX(p, w) > Math.min(p.w, w.w) * 0.3 && p.y + p.h <= w.y + 3 && w.y - (p.y + p.h) < 12).sort((a, b) => b.y - a.y)[0]
  const above = same.filter((p) => overlapX(p, w) > Math.min(p.w, w.w) * 0.3 && p.y >= w.y + w.h - 3 && p.y - (w.y + w.h) < 16).sort((a, b) => a.y - b.y)[0]
  // The section heading: the nearest label above that overlaps the field's column.
  const headings = same.filter((p) => p.y > w.y + w.h && p.y - (w.y + w.h) < 200 && overlapX(p, { x: w.x - 30, w: w.w + 60 }) > 0).sort((a, b) => a.y - b.y)
  return { right, left, below, above, headings }
}

const skillByName = new Map((Object.keys(skills) as Skill[]).map((s) => [s.replace(/-/g, ' '), s]))
const findAbility = (text: string) => abilities.find((a) => text.includes(abilityNames[a]))

/** Direct labels → keys (text fields), matched on the whole phrase or its start. */
const labels: [RegExp, string][] = [
  [/^character name|^name$/, 'name'],
  [/^class & level|^class and level/, 'class'],
  [/^class$/, 'className'],
  [/^subclass/, 'subclass'],
  [/^level$/, 'level'],
  [/^species|^race/, 'species'],
  [/^background/, 'background'],
  [/^xp|^experience/, 'xp'],
  [/^size$/, 'size'],
  [/^proficiency bonus/, 'pb'],
  [/^armou?r class|^ac$/, 'ac'],
  [/^initiative/, 'initiative'],
  [/^speed/, 'speed'],
  [/^passive (wisdom|perception)/, 'passivePerception'],
  [/^passive insight/, 'passiveInsight'],
  [/^passive investigation/, 'passiveInvestigation'],
  [/^(hit point )?max(imum)?$|^hit point maximum/, 'hp.max'],
  [/^spellcasting ability/, 'spell.ability'],
  [/^spellcasting class/, 'spell.class'],
  [/^spellcasting modifier|^spellcasting$/, 'spell.mod'],
  [/^spell save dc/, 'spell.dc'],
  [/^spell attack/, 'spell.attack'],
  [/^cp$/, 'coins.cp'],
  [/^sp$/, 'coins.sp'],
  [/^ep$/, 'coins.ep'],
  [/^gp$/, 'coins.gp'],
  [/^pp$/, 'coins.pp'],
  [/^weapons$/, 'prof.weapons'],
  [/^tools$/, 'prof.tools'],
  [/^languages/, 'languages'],
  [/^equipment$/, 'equipment'],
  [/^class features/, 'features.class'],
  [/^species traits|^racial traits/, 'features.species'],
  [/^feats$/, 'feats'],
  [/^features & traits|^features and traits/, 'features'],
  [/^(other )?proficiencies & languages/, 'proficiencies'],
  [/^cantrips/, 'cantrips'],
  [/^senses/, 'senses'],
]
const labelKey = (text: string | undefined) => (text ? labels.find(([re]) => re.test(text))?.[1] : undefined)

export type Proposal = { field: Widget; key?: string; reason?: string }

/** A key for every form field the analysis understands. */
export function analyzeFields(widgets: Widget[], words: Word[]): Proposal[] {
  const ps = phrases(words)
  const out: Proposal[] = []
  const taken = new Set<string>()
  const take = (w: Widget, key: string | undefined, reason: string) => {
    if (!key || taken.has(key)) return out.push({ field: w })
    taken.add(key)
    out.push({ field: w, key, reason })
  }
  // Tables: rows of fields under column headers (weapons, spells); handled after the rest.
  const rows: { w: Widget; col: string; table: 'attack' | 'spell' }[] = []
  for (const w of widgets) {
    const { right, left, below, above, headings } = around(w, ps)
    const heading = headings.find((h) => findAbility(h.text) || /weapons|attacks|spells|cantrips/.test(h.text))
    const ability = heading && findAbility(heading.text)
    const local = [below, above, right, left].map((p) => p?.text ?? '')
    // Skills: the name right (or left) of a checkbox / small field.
    const skill = [right, left].map((p) => (p ? skillByName.get(p.text.replace(/ (dex|wis|int|str|cha|con)$/, '')) : undefined)).find(Boolean)
    if (skill) {
      take(w, w.type === 'check' ? (taken.has(`skill.${skill}.prof`) ? `skill.${skill}.expertise` : `skill.${skill}.prof`) : `skill.${skill}`, 'skill name next to it')
      continue
    }
    // Saving throws: "Saving Throw" next to it under an ability heading, or an ability name next to it in a saves list.
    const saveLabel = local.some((t) => /^saving throw/.test(t))
    const saveAbility = saveLabel ? ability : headings.some((h) => /saving throws?/.test(h.text)) ? [right, left].map((p) => p && findAbility(p.text)).find(Boolean) : undefined
    if (saveAbility) {
      take(w, w.type === 'check' ? `${saveAbility}.saveProf` : `${saveAbility}.save`, 'saving throw')
      continue
    }
    // Ability blocks: "Modifier" / "Score" next to it under the ability name.
    if (ability && w.type === 'text') {
      if (local.some((t) => /^mod(ifier)?$/.test(t))) {
        take(w, `${ability}.mod`, 'modifier under the ability')
        continue
      }
      if (local.some((t) => /^score$/.test(t))) {
        take(w, `${ability}.score`, 'score under the ability')
        continue
      }
    }
    // Armor training checkboxes.
    if (w.type === 'check') {
      const t = right?.text ?? ''
      const armor = /^light/.test(t) ? 'light' : /^medium/.test(t) ? 'medium' : /^heavy/.test(t) ? 'heavy' : /^shields?/.test(t) ? 'shields' : undefined
      if (armor) {
        take(w, `prof.armor.${armor}`, 'armor training')
        continue
      }
    }
    // Table columns.
    const tableHead = headings.find((h) => /^(name|atk bonus|attack bonus|bonus|damage|notes|level|casting time|time|range)/.test(h.text))
    const tableTitle = headings.find((h) => /weapons|attacks|cantrips|spells/.test(h.text))
    if (tableHead && tableTitle && w.type === 'text' && !w.multiline) {
      // "Weapons & Damage Cantrips" is the attack table: weapons / attacks win over spell words.
      rows.push({ w, col: tableHead.text, table: /weapon|attack/.test(tableTitle.text) ? 'attack' : 'spell' })
      continue
    }
    // Plain labels: below (official sheet), above, left; big boxes take their section heading.
    const key = labelKey(below?.text) ?? labelKey(above?.text) ?? labelKey(left?.text) ?? (w.multiline || w.h > 40 ? labelKey(headings[0]?.text) : undefined)
    take(w, key, 'label next to it')
  }
  // Rows: order each column top to bottom.
  for (const table of ['attack', 'spell'] as const) {
    const cols = new Map<string, Widget[]>()
    for (const r of rows.filter((x) => x.table === table)) cols.set(r.col, [...(cols.get(r.col) ?? []), r.w])
    for (const [col, ws] of cols) {
      const sub = table === 'attack'
        ? /^name/.test(col) ? 'name' : /bonus|dc/.test(col) ? 'bonus' : /damage/.test(col) ? 'damage' : /notes/.test(col) ? 'notes' : undefined
        : /^level/.test(col) ? 'level' : /^name/.test(col) ? 'name' : /time|casting/.test(col) ? 'time' : /^range/.test(col) ? 'range' : /notes/.test(col) ? 'notes' : undefined
      const sorted = [...ws].sort((a, b) => a.page - b.page || b.y - a.y)
      sorted.forEach((w, i) => {
        const n = i + 1
        if (!sub || n > (table === 'attack' ? MAX_ATTACKS : MAX_SPELLS)) return out.push({ field: w })
        out.push({ field: w, key: `${table}.${n}.${sub}`, reason: `table column "${col}"` })
      })
    }
  }
  return out
}

/** Proposals as template fields (only the understood ones). */
export const proposalsToFields = (ps: Proposal[]): TemplateField[] => ps.filter((p) => p.key).map((p) => ({ kind: 'form', name: p.field.name, key: p.key! }))
