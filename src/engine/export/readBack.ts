// The way back: values read off a filled sheet (by catalogue key, e.g. from its form fields)
// become a sheet import (names only; the web app matches them against its content).
import { abilities, skills, type Skill } from '../../content/schema'
import type { SheetImport } from '../exchange'

type Values = Record<string, string | boolean | undefined>

const str = (v: Values[string]) => (typeof v === 'string' ? v.trim() : '')
const int = (v: Values[string]) => {
  const m = str(v).replace(/[ ,.](?=\d{3}\b)/g, '').match(/-?\d+/)
  return m ? Number(m[0]) : undefined
}
/** A list from a text box: one per line, or separated by commas / semicolons. */
export const splitList = (text: string) =>
  text
    .split(/\r?\n|;|,(?![^()]*\))/)
    .map((s) => s.replace(/^[\s•\-–*]+/, '').trim())
    .filter(Boolean)

/** "Fighter 5 / Wizard 2", "Rogue 3", "Cleric (Life) 4" → classes. */
export function parseClasses(text: string, subclassText = ''): SheetImport['classes'] {
  const subs = subclassText.split(/\s*\/\s*/).filter(Boolean)
  const out: SheetImport['classes'] = []
  for (const part of text.split(/\s*[/,&+]\s*/)) {
    const m = part.match(/^\s*([\p{L}][\p{L} '’-]*?)\s*(?:\(([^)]*)\))?\s*(\d{1,2})?\s*$/u)
    if (!m) continue
    const level = Math.min(20, Math.max(1, Number(m[3] ?? 1)))
    const sub = m[2]?.trim() || subs[out.length]
    out.push({ name: m[1].trim(), level, ...(sub ? { subclass: sub } : {}) })
  }
  return out
}

/** "2× Dagger (equipped)", "Rope x2", "Arrows (20)" → an item. */
export function parseItem(line: string): SheetImport['items'][number] {
  let name = line.trim()
  let quantity = 1
  const equipped = /\((equipped|worn|wielded)\)/i.test(name)
  name = name.replace(/\((equipped|worn|wielded)\)/gi, '').trim()
  const lead = name.match(/^(\d+)\s*[×x]?\s+(.+)$/i)
  const trail = name.match(/^(.+?)\s*(?:[×x]\s*(\d+)|\((\d+)\))$/i)
  if (lead) {
    quantity = Number(lead[1])
    name = lead[2]
  } else if (trail) {
    quantity = Number(trail[2] ?? trail[3])
    name = trail[1]
  }
  return { name: name.trim(), quantity, ...(equipped ? { equipped } : {}) }
}

/** A sheet import from export values (whatever of them the sheet had). */
export function importFromValues(v: Values, edition?: '2014' | '2024'): SheetImport {
  const classes = parseClasses(str(v.class) || [str(v.className), str(v.level)].filter(Boolean).join(' '), str(v.subclass))
  const abilityScores: SheetImport['abilities'] = {}
  for (const a of abilities) {
    const n = int(v[`${a}.score`])
    if (n !== undefined && n >= 1 && n <= 30) abilityScores[a] = n
  }
  const skillName = (s: Skill) => s.replace(/-/g, ' ')
  const skillList = (Object.keys(skills) as Skill[]).filter((s) => v[`skill.${s}.prof`] === true || v[`skill.${s}.expertise`] === true)
  const expertise = (Object.keys(skills) as Skill[]).filter((s) => v[`skill.${s}.expertise`] === true)

  // Spells: per-row fields first, then the lists.
  const numbered = (prefix: (n: number) => string, max: number) =>
    Array.from({ length: max }, (_, i) => str(v[prefix(i + 1)])).filter(Boolean)
  const rowSpells = Array.from({ length: 40 }, (_, i) => ({ name: str(v[`spell.${i + 1}.name`]), level: str(v[`spell.${i + 1}.level`]) })).filter((r) => r.name)
  const cantrips = new Set([
    ...numbered((n) => `cantrip.${n}`, 12),
    ...rowSpells.filter((r) => /^(c|0|cantrip)$/i.test(r.level)).map((r) => r.name),
    ...splitList(str(v.cantrips)),
  ])
  const clean = (s: string) => s.replace(/^L\d\s+/, '').replace(/\s*\((C|R)\)/g, '').trim()
  const spells = new Set(
    [
      ...Array.from({ length: 9 }, (_, l) => numbered((n) => `lvl.${l + 1}.${n}`, 14)).flat(),
      ...rowSpells.filter((r) => !/^(c|0|cantrip)$/i.test(r.level)).map((r) => r.name),
      ...splitList(str(v.spells)),
    ]
      .map(clean)
      .filter((s) => s && !cantrips.has(s)),
  )

  const currency: SheetImport['currency'] = {}
  for (const c of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) {
    const n = int(v[`coins.${c}`])
    if (n !== undefined && n >= 0) currency[c] = n
  }
  const notes = [
    str(v.features) && !str(v['features.class']) ? `Features: ${str(v.features)}` : '',
    str(v['features.class']) || [str(v['features.class.1']), str(v['features.class.2'])].filter(Boolean).join('\n'),
    str(v['features.species']),
    str(v.notes),
  ]
    .filter(Boolean)
    .join('\n\n')
  const species = str(v.species).split(/\s+[–-]\s+/)
  return {
    format: 'luso-sheet-import',
    version: 1,
    ...(edition ? { edition } : {}),
    name: str(v.name),
    classes,
    ...(species[0] ? { species: species[0] } : {}),
    ...(species[1] ? { subspecies: species[1] } : {}),
    ...(str(v.background) ? { background: str(v.background) } : {}),
    abilities: abilityScores,
    ...(int(v['hp.max']) !== undefined ? { hpMax: int(v['hp.max']) } : {}),
    ...(int(v['hp.current']) !== undefined ? { hpCurrent: int(v['hp.current']) } : {}),
    ...(int(v.xp) !== undefined ? { xp: int(v.xp) } : {}),
    skills: skillList.map(skillName),
    expertise: expertise.map(skillName),
    languages: splitList(str(v.languages)),
    tools: splitList(str(v['prof.tools'])),
    cantrips: [...cantrips],
    spells: [...spells],
    // "Name: what it does" per line, or a plain list of names.
    feats: str(v.feats)
      .split(/\r?\n/)
      .flatMap((l) => (l.includes(':') ? [l.split(':')[0]] : splitList(l)))
      .map((f) => f.replace(/^[\s•\-–*]+/, '').trim())
      .filter(Boolean),
    items: splitList(str(v.equipment)).map(parseItem).filter((i) => i.name),
    currency,
    notes,
  }
}
