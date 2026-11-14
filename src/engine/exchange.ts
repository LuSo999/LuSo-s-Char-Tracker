// Files exchanged with the desktop app (desktop/): a character export (the character with every
// computed value, for filling any sheet PDF) and a sheet import (a character read off a filled
// sheet, by names, resolved here against the content the user has).
import { z } from 'zod'
import type { ContentIndex } from '../content'
import { abilities, Ability, skills, type Entity, type Skill } from '../content/schema'
import type { Character, CharacterInput } from './character'
import type { Sheet } from './derive'
import { exportCatalogue, exportValues } from './export/values'

// --- Export: web → desktop -------------------------------------------------------------

export const CharacterExport = z.object({
  format: z.literal('luso-character-export'),
  version: z.literal(1),
  exportedAt: z.string(),
  name: z.string(),
  /** The character itself (can be imported back as it is). */
  character: z.record(z.string(), z.unknown()),
  /** Every value a sheet can show, by catalogue key ("str.score", "skill.arcana.prof"…). */
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  /** The catalogue: what each key means (for the analysis that places them on a sheet). */
  fields: z.array(z.object({ key: z.string(), label: z.string(), kind: z.enum(['text', 'check', 'multiline']), group: z.string() })),
})
export type CharacterExport = z.infer<typeof CharacterExport>

export function makeCharacterExport(char: Character, sheet: Sheet, content: ContentIndex, now = new Date()): CharacterExport {
  return {
    format: 'luso-character-export',
    version: 1,
    exportedAt: now.toISOString(),
    name: char.name,
    character: JSON.parse(JSON.stringify({ ...char, id: undefined })),
    values: exportValues(char, sheet, content),
    fields: exportCatalogue().map(({ key, label, kind, group }) => ({ key, label, kind, group })),
  }
}

// --- Import: desktop → web -----------------------------------------------------------------

export const SheetImport = z.object({
  format: z.literal('luso-sheet-import'),
  version: z.literal(1),
  edition: z.enum(['2014', '2024']).optional(),
  name: z.string().default(''),
  classes: z.array(z.object({ name: z.string(), level: z.number().int().min(1).max(20), subclass: z.string().optional() })).default([]),
  species: z.string().optional(),
  subspecies: z.string().optional(),
  background: z.string().optional(),
  /** Ability scores as printed on the sheet (all bonuses included). */
  abilities: z.partialRecord(Ability, z.number().int().min(1).max(30)).default({}),
  hpMax: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  xp: z.number().int().optional(),
  /** Skills marked proficient / with expertise (names). */
  skills: z.array(z.string()).default([]),
  expertise: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  cantrips: z.array(z.string()).default([]),
  spells: z.array(z.string()).default([]),
  feats: z.array(z.string()).default([]),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int().min(0).default(1), equipped: z.boolean().optional() })).default([]),
  currency: z.partialRecord(z.enum(['cp', 'sp', 'ep', 'gp', 'pp']), z.number().int().min(0)).default({}),
  notes: z.string().default(''),
})
export type SheetImport = z.infer<typeof SheetImport>

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** An entity of one type by its (printed) name; plural / "of" variants tolerated. */
function byName<T extends Entity>(list: T[], name: string | undefined): T | undefined {
  if (!name) return undefined
  const n = norm(name)
  if (!n) return undefined
  return (
    list.find((e) => norm(e.name) === n) ??
    list.find((e) => norm(e.name).replace(/s$/, '') === n.replace(/s$/, '')) ??
    list.find((e) => norm(e.name).startsWith(n) || n.startsWith(norm(e.name)))
  )
}

export type ImportReport = {
  matched: { what: string; from: string; to: string }[]
  unmatched: { what: string; name: string }[]
  notes: string[]
}

/** A character from a sheet import, with what could and couldn't be matched to the content. */
export function resolveSheetImport(data: SheetImport, content: ContentIndex): { character: Omit<CharacterInput, 'id'>; report: ImportReport } {
  const report: ImportReport = { matched: [], unmatched: [], notes: [] }
  const hit = <T extends Entity>(what: string, list: T[], name: string | undefined): T | undefined => {
    if (!name) return undefined
    const e = byName(list, name)
    if (e) report.matched.push({ what, from: name, to: e.name })
    else report.unmatched.push({ what, name })
    return e
  }
  const edition = data.edition ?? content.edition
  const classes = data.classes.flatMap((c) => {
    const cls = hit('class', content.all('class'), c.name)
    if (!cls) return []
    const sub = c.subclass ? hit('subclass', content.all('subclass').filter((s) => s.class === cls.id), c.subclass) : undefined
    return [{ classId: cls.id, level: c.level, subclassId: sub?.id, hpRolls: [] }]
  })
  if (!classes.length) {
    report.notes.push('No class matched: the character starts as a level 1 Fighter; fix it in edit mode.')
    classes.push({ classId: content.all('class')[0]?.id ?? 'fighter', level: 1, subclassId: undefined, hpRolls: [] })
  }
  const species = hit('species', content.all('species'), data.species) ?? content.all('species')[0]
  const subspecies = data.subspecies ? hit('subspecies', content.all('subspecies').filter((s) => s.species === species?.id), data.subspecies) : undefined
  const background = hit('background', content.all('background'), data.background) ?? content.all('background')[0]

  const baseScores = Object.fromEntries(abilities.map((a) => [a, data.abilities[a] ?? 10])) as Record<Ability, number>
  if (Object.keys(data.abilities).length) report.notes.push('Ability scores are taken as printed (bonuses included); species / background increases left at 0.')

  // Skills, languages and tools from the sheet: one feature of the character's own, so nothing is lost.
  const skillId = (name: string) => (Object.keys(skills) as Skill[]).find((s) => norm(s.replace(/-/g, ' ')) === norm(name))
  const effects: { target: string; value: number }[] = []
  for (const s of data.skills) {
    const id = skillId(s)
    if (id) effects.push({ target: `proficiency:skill:${id}`, value: data.expertise.some((e) => skillId(e) === id) ? 2 : 1 })
    else report.unmatched.push({ what: 'skill', name: s })
  }
  const languages = data.languages.filter((l) => l.trim())
  const tools = data.tools.filter((x) => x.trim())

  // Spells into the first casting class (known and prepared); cantrips too.
  const spellList = content.all('spell')
  const spellIds = [...data.cantrips, ...data.spells].flatMap((n) => {
    const s = hit('spell', spellList, n)
    return s ? [s.id] : []
  })
  const casterClass = classes.find((c) => content.getTyped(c.classId, 'class')?.caster)?.classId
  const spells = casterClass && spellIds.length ? { [casterClass]: { known: [...new Set(spellIds)], prepared: [...new Set(spellIds)] } } : {}
  if (!casterClass && spellIds.length) report.notes.push('Spells found but no spellcasting class: they are listed in the notes.')

  // Items by name; the rest goes to the notes.
  const items = content.all('item')
  const inventory = data.items.flatMap((it, i) => {
    const item = hit('item', items, it.name)
    return item ? [{ uid: `imp${i}`, itemId: item.id, quantity: Math.max(1, it.quantity), equipped: !!it.equipped }] : []
  })
  const extras = data.feats.flatMap((f, i) => {
    const feat = hit('feat', content.all('feat'), f)
    return feat ? [{ uid: `impfeat${i}`, entityId: feat.id, note: 'From the imported sheet' }] : []
  })
  if (effects.length || languages.length || tools.length) {
    extras.push({
      uid: 'impsheet',
      note: 'From the imported sheet',
      custom: {
        id: 'imported-sheet', edition, name: 'From the imported sheet', type: 'feature', source: { book: 'homebrew' },
        description: [languages.length && `Languages: ${languages.join(', ')}`, tools.length && `Tools: ${tools.join(', ')}`].filter(Boolean).join('. '),
        effects,
      },
    } as never)
  }

  const unmatchedText = report.unmatched.map((u) => `${u.what}: ${u.name}`)
  const notes = [data.notes, unmatchedText.length ? `Not found in the content (from the imported sheet):\n${unmatchedText.join('\n')}` : ''].filter(Boolean).join('\n\n')
  const character: Omit<CharacterInput, 'id'> = {
    name: data.name || 'Imported character',
    edition,
    classes,
    speciesId: species?.id ?? 'human',
    subspeciesId: subspecies?.id,
    backgroundId: background?.id ?? 'acolyte',
    baseScores,
    hp: { current: data.hpCurrent ?? data.hpMax ?? 10 },
    xp: data.xp ?? 0,
    spells,
    inventory,
    extras: extras as CharacterInput['extras'],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...data.currency },
    notes,
  }
  return { character, report }
}

export function parseSheetImport(text: string): { ok: true; value: SheetImport } | { ok: false; errors: string[] } {
  try {
    const r = SheetImport.safeParse(JSON.parse(text))
    return r.success ? { ok: true, value: r.data } : { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] }
  }
}
