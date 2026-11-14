// What the desktop app asks the AI (Claude, ChatGPT or Gemini) and how the answers become a
// template / a sheet import. Pure: prompts, JSON schemas for structured outputs (kept to the
// subset all three accept: every property required, no additionalProperties) and the
// conversions. The API calls live in the desktop app (desktop/electron/ai.cjs).
import { abilities } from '../../content/schema'
import type { SheetImport } from '../exchange'
import { phrases, type Widget, type Word } from './analyze'
import type { TemplateField } from './template'

type CatalogueField = { key: string; label: string; kind: 'text' | 'check' | 'multiline' }

/** The catalogue for a prompt: numbered families ("attack.N.name") listed once. */
export function compactCatalogue(fields: CatalogueField[]): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const f of fields) {
    const pattern = f.key.replace(/^(attack|spell)\.\d+\./, '$1.N.').replace(/^cantrip\.\d+$/, 'cantrip.N').replace(/^lvl\.(\d)\.\d+$/, 'lvl.L.N').replace(/^(slots|attuned)\.\d$/, '$1.N')
    if (seen.has(pattern)) continue
    seen.add(pattern)
    const label = pattern === f.key ? f.label : f.label.replace(/\d+/g, '#')
    lines.push(`${pattern} | ${label} | ${f.kind}`)
  }
  return lines.join('\n')
}

const numberedRanges = 'N ranges: attack.N 1–8, spell.N 1–40, cantrip.N 1–12, lvl.L.N L=1–9 (spell level) N=1–14, slots.N N=1–9 (spell level), attuned.N 1–3.'

// --- Character → sheet: where does each value go? -----------------------------------------

export type PageImage = { width: number; height: number }

export const mappingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['formFields', 'boxes', 'marks', 'comment'],
  properties: {
    formFields: {
      type: 'array',
      description: 'Fillable form fields of the PDF and the key each takes (only fields you can tell).',
      items: { type: 'object', additionalProperties: false, required: ['name', 'key'], properties: { name: { type: 'string' }, key: { type: 'string' } } },
    },
    boxes: {
      type: 'array',
      description: 'Empty spaces on the printed sheet where a value is written, in pixels of the page image (origin top left).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['page', 'key', 'x', 'y', 'w', 'h', 'multiline', 'align'],
        properties: {
          page: { type: 'integer' },
          key: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          multiline: { type: 'boolean' },
          align: { type: 'string', enum: ['left', 'center', 'right'] },
        },
      },
    },
    marks: {
      type: 'array',
      description: 'Centres of printed circles / squares to fill for checked values (proficiencies), in pixels of the page image.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['page', 'key', 'x', 'y'],
        properties: { page: { type: 'integer' }, key: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
      },
    },
    comment: { type: 'string', description: 'One or two sentences about the sheet and anything you could not place.' },
  },
} as const

export type AiMapping = {
  formFields: { name: string; key: string }[]
  boxes: { page: number; key: string; x: number; y: number; w: number; h: number; multiline: boolean; align: 'left' | 'center' | 'right' }[]
  marks: { page: number; key: string; x: number; y: number }[]
  comment: string
}

export const mappingSystem = `You map a tabletop RPG character sheet (D&D 5e / 2024 or similar) so a program can fill it in.
You get one image per page, the PDF's fillable form fields (if any) with their positions, and a catalogue of value keys.
- If the sheet has form fields, assign keys to them in "formFields" (use the exact field names). Field names are often meaningless: decide by position and the printed labels around them.
- For values the sheet has room for but no form field (printed / scanned sheets), give "boxes": the empty writing area (not the label), tight, in pixels of that page image. Big areas (features, equipment, notes, spell lists) are multiline.
- For printed proficiency circles / squares (saving throws, skills, armor training), give "marks" at the circle's centre with the matching ".prof" / ".saveProf" / ".expertise" key.
- Use each key at most once. Only use keys from the catalogue; numbered keys replace N / L with numbers. Rows of a table take consecutive numbers top to bottom.
- Prefer the most specific key ("class" for "Class & Level", "className" + "level" when separate; "features.class.1"/".2" for two columns of class features).
- Skip decorations, headers and anything without a matching key. Be precise with coordinates.`

export function mappingPrompt(opts: { pages: { width: number; height: number; image: PageImage }[]; widgets: Widget[]; words: Word[]; catalogue: CatalogueField[] }): string {
  const { pages, widgets } = opts
  const px = (page: number, x: number, y: number, w: number, h: number) => {
    const p = pages[page]
    const sx = p.image.width / p.width
    const sy = p.image.height / p.height
    return [Math.round(x * sx), Math.round((p.height - y - h) * sy), Math.round(w * sx), Math.round(h * sy)]
  }
  const pageLines = pages.map((p, i) => `page ${i}: image ${p.image.width}×${p.image.height} px`).join('\n')
  // Printed labels (when the PDF has a text layer) help to place boxes precisely.
  const labels = phrases(opts.words).slice(0, 900).map((p) => `${p.text} | page ${p.page} | [${px(p.page, p.x, p.y, p.w, p.h).join(', ')}]`).join('\n')
  const fieldLines = widgets.map((w) => `${w.name} | ${w.type}${w.multiline ? ' multiline' : ''} | page ${w.page} | [${px(w.page, w.x, w.y, w.w, w.h).join(', ')}]`).join('\n')
  return [
    `Pages:\n${pageLines}`,
    labels ? `Printed labels (lower case | page | [x, y, w, h] in image pixels):\n${labels}` : '',
    widgets.length ? `Form fields (name | type | page | [x, y, w, h] in image pixels):\n${fieldLines}` : 'The PDF has no form fields: use boxes and marks.',
    `Catalogue (key | meaning | kind; "check" keys are true/false and go to checkboxes or marks):\n${compactCatalogue(opts.catalogue)}\n${numberedRanges}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Claude's mapping as template fields (unknown keys / fields dropped, pixels → PDF points). */
export function mappingToFields(m: AiMapping, pages: { width: number; height: number; image: PageImage }[], keys: Set<string>, widgetNames: Set<string>): TemplateField[] {
  const out: TemplateField[] = []
  const used = new Set<string>()
  const ok = (key: string) => keys.has(key) && !used.has(key) && (used.add(key), true)
  for (const f of m.formFields) if (widgetNames.has(f.name) && ok(f.key)) out.push({ kind: 'form', name: f.name, key: f.key })
  for (const b of m.boxes) {
    const p = pages[b.page]
    if (!p || b.w <= 0 || b.h <= 0 || !ok(b.key)) continue
    const sx = p.width / p.image.width
    const sy = p.height / p.image.height
    out.push({
      kind: 'text', page: b.page, key: b.key,
      x: round(b.x * sx), y: round(p.height - (b.y + b.h) * sy), w: round(b.w * sx), h: round(b.h * sy),
      ...(b.multiline ? { multiline: true } : {}), ...(b.align !== 'left' ? { align: b.align } : {}),
    })
  }
  for (const k of m.marks) {
    const p = pages[k.page]
    if (!p || !ok(k.key)) continue
    out.push({ kind: 'mark', page: k.page, key: k.key, x: round(k.x * (p.width / p.image.width)), y: round(p.height - k.y * (p.height / p.image.height)) })
  }
  return out
}
const round = (n: number) => Math.round(n * 10) / 10

// --- Sheet → character: what is written on it? --------------------------------------------

const strings = { type: 'array', items: { type: 'string' } } as const

export const extractSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['edition', 'name', 'classes', 'species', 'subspecies', 'background', 'abilities', 'hpMax', 'hpCurrent', 'xp', 'skills', 'expertise', 'languages', 'tools', 'cantrips', 'spells', 'feats', 'items', 'currency', 'notes'],
  properties: {
    edition: { type: 'string', enum: ['2014', '2024', 'unknown'], description: '2024 if the sheet says so or uses Species / weapon mastery; 2014 for Race-era sheets.' },
    name: { type: 'string' },
    classes: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'level', 'subclass'], properties: { name: { type: 'string' }, level: { type: 'integer' }, subclass: { type: 'string' } } },
    },
    species: { type: 'string', description: 'Species or race, empty if not written.' },
    subspecies: { type: 'string' },
    background: { type: 'string' },
    abilities: {
      type: 'object',
      additionalProperties: false,
      required: [...abilities],
      properties: Object.fromEntries(abilities.map((a) => [a, { type: 'integer', description: 'Score (not the modifier); 0 if not written.' }])),
    },
    hpMax: { type: 'integer', description: '0 if not written.' },
    hpCurrent: { type: 'integer', description: '0 if not written.' },
    xp: { type: 'integer', description: '0 if not written.' },
    skills: { ...strings, description: 'Skills marked proficient (filled circle / checkbox), by name.' },
    expertise: { ...strings, description: 'Skills marked with expertise (double mark), by name.' },
    languages: strings,
    tools: strings,
    cantrips: strings,
    spells: { ...strings, description: 'Leveled spells (names only).' },
    feats: strings,
    items: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'quantity', 'equipped'], properties: { name: { type: 'string' }, quantity: { type: 'integer' }, equipped: { type: 'boolean' } } },
    },
    currency: {
      type: 'object',
      additionalProperties: false,
      required: ['cp', 'sp', 'ep', 'gp', 'pp'],
      properties: Object.fromEntries(['cp', 'sp', 'ep', 'gp', 'pp'].map((c) => [c, { type: 'integer' }])),
    },
    notes: { type: 'string', description: 'Everything else worth keeping (features, personality, backstory, allies), as plain text.' },
  },
} as const

export const extractSystem = `You read a filled-in tabletop RPG character sheet (D&D 5e 2014 / 2024 or similar) and transcribe it.
Copy what is written; do not invent or compute missing values (use empty strings, empty lists and 0).
Names as printed in the official rules where the handwriting allows (e.g. "Magic Missile", "Longsword").
Ability scores are the big numbers (3–20 usually), not the modifiers. Skills count as proficient only when their mark is filled.
Items: one entry per item with its quantity; money goes to currency, not items.`

export type AiExtract = {
  edition: '2014' | '2024' | 'unknown'
  name: string
  classes: { name: string; level: number; subclass: string }[]
  species: string
  subspecies: string
  background: string
  abilities: Record<(typeof abilities)[number], number>
  hpMax: number
  hpCurrent: number
  xp: number
  skills: string[]
  expertise: string[]
  languages: string[]
  tools: string[]
  cantrips: string[]
  spells: string[]
  feats: string[]
  items: { name: string; quantity: number; equipped: boolean }[]
  currency: Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>
  notes: string
}

/** Claude's transcription as a sheet import (blanks and zeros left out). */
export function extractToImport(e: AiExtract): SheetImport {
  const clean = (l: string[]) => l.map((s) => s.trim()).filter(Boolean)
  const scores: SheetImport['abilities'] = {}
  for (const a of abilities) if (e.abilities[a] >= 1 && e.abilities[a] <= 30) scores[a] = e.abilities[a]
  const currency: SheetImport['currency'] = {}
  for (const c of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) if (e.currency[c] > 0) currency[c] = e.currency[c]
  return {
    format: 'luso-sheet-import',
    version: 1,
    ...(e.edition !== 'unknown' ? { edition: e.edition } : {}),
    name: e.name.trim(),
    classes: e.classes.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), level: Math.min(20, Math.max(1, c.level || 1)), ...(c.subclass.trim() ? { subclass: c.subclass.trim() } : {}) })),
    ...(e.species.trim() ? { species: e.species.trim() } : {}),
    ...(e.subspecies.trim() ? { subspecies: e.subspecies.trim() } : {}),
    ...(e.background.trim() ? { background: e.background.trim() } : {}),
    abilities: scores,
    ...(e.hpMax > 0 ? { hpMax: e.hpMax } : {}),
    ...(e.hpCurrent > 0 ? { hpCurrent: e.hpCurrent } : {}),
    ...(e.xp > 0 ? { xp: e.xp } : {}),
    skills: clean(e.skills),
    expertise: clean(e.expertise),
    languages: clean(e.languages),
    tools: clean(e.tools),
    cantrips: clean(e.cantrips),
    spells: clean(e.spells),
    feats: clean(e.feats),
    items: e.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: Math.max(1, i.quantity || 1), ...(i.equipped ? { equipped: true } : {}) })),
    currency,
    notes: e.notes.trim(),
  }
}
