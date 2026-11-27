// Finds rules terms (conditions and glossary rules) inside free text such as a spell's
// description, so they can be Ctrl+hovered like any other term on the sheet.
import type { ContentIndex } from '../../content'

/** `strict`: only in its rules form, "Wisdom (Perception)" or "Perception check" (skills are also plain words: "nature spirits"). */
export type GlossaryEntry = { id: string; name: string; strict?: boolean }
export type Glossary = { regex: RegExp | undefined; byKey: Map<string, string> }
export type TermSegment = string | { id: string; text: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// "Hit Points" and "hit point", "Saving Throw" and "saving throws" are the same term.
const stem = (name: string) => name.toLowerCase().replace(/s$/, '')

/** Builds the matcher once per content index: longest names first, so "Temporary Hit Points" beats "Hit Points". */
export function buildGlossary(entries: readonly GlossaryEntry[]): Glossary {
  const byKey = new Map<string, string>()
  const strict = new Set<string>()
  for (const e of entries) {
    if (!e.name.trim()) continue
    byKey.set(stem(e.name.trim()), e.id)
    if (e.strict) strict.add(stem(e.name.trim()))
  }
  const stems = [...byKey.keys()].sort((a, b) => b.length - a.length)
  const alternatives = stems.map((s) => {
    // Spaces in a name match any run of whitespace (descriptions wrap lines).
    const name = `${escape(s).replace(/ /g, '\\s+')}s?`
    return strict.has(s) ? `(?<=\\()${name}(?=\\))|${name}(?=\\s+checks?\\b)` : name
  })
  const regex = alternatives.length ? new RegExp(`\\b(${alternatives.join('|')})\\b`, 'gi') : undefined
  return { regex, byKey }
}

/** Splits text into plain parts and terms. `skip` leaves one term unlinked (the entity being shown). */
export function splitTerms(text: string, glossary: Glossary, skip?: string): TermSegment[] {
  if (!glossary.regex || !text) return [text]
  const out: TermSegment[] = []
  let last = 0
  for (const m of text.matchAll(glossary.regex)) {
    const key = m[0].toLowerCase().replace(/\s+/g, ' ')
    const id = glossary.byKey.get(stem(key)) ?? glossary.byKey.get(key)
    if (!id || id === skip) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push({ id, text: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length ? out : [text]
}

// Too generic to link in running text ("as an action", "the weapon's range"): plain
// Action and the weapon properties stay unlinked; they have their own terms elsewhere.
const UNLINKED = new Set(['rule-action'])

const cache = new WeakMap<ContentIndex, Glossary>()

/** Conditions and glossary rules of this content (its edition, renamed ones by their new name). */
export function glossaryOf(content: ContentIndex): Glossary {
  let glossary = cache.get(content)
  if (!glossary) {
    const entries = [...content.all('condition'), ...content.all('rule')]
      .filter((e) => !UNLINKED.has(e.id) && !e.id.startsWith('property-'))
      .map((e) => ({ id: e.id, name: e.name, strict: e.id.startsWith('skill-') }))
    glossary = buildGlossary(entries)
    cache.set(content, glossary)
  }
  return glossary
}
