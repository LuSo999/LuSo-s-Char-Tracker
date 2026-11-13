// Homebrew packs: the player's own content in the same format as the rule packs.
// Stored per user in Firestore (users/{uid}/packs); shared by exporting a file.
import { Entity, Pack, type Edition } from '../content/schema'

/** What the editor can create. */
export const HOMEBREW_TYPES = ['feature', 'subclass', 'feat', 'species', 'subspecies', 'background', 'item', 'spell'] as const
export type HomebrewType = (typeof HOMEBREW_TYPES)[number]

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item'

/** Book id of a homebrew pack: always allowed for the character's content. */
export const homebrewBook = (packId: string) => `homebrew:${packId}`

export function newPack(edition: Edition, name: string): Pack {
  const id = `hb-${slug(name).slice(0, 24)}-${Math.random().toString(36).slice(2, 6)}`
  return Pack.parse({ id, name, edition, version: '1', book: homebrewBook(id), entities: [] })
}

/** A unique id for a new entity in the pack: "<pack id>-<name slug>". */
export function entityId(pack: Pack, name: string): string {
  const base = `${pack.id}-${slug(name)}`
  let id = base
  for (let n = 2; pack.entities.some((e) => e.id === id); n++) id = `${base}-${n}`
  return id
}

/** Minimal valid entity of a type (the schema fills in the defaults). */
export function newEntity(pack: Pack, type: HomebrewType, name: string, extra: Record<string, unknown> = {}): Entity {
  const common = { id: entityId(pack, name), edition: pack.edition, name, description: '', source: { book: pack.book } }
  const byType: Record<HomebrewType, Record<string, unknown>> = {
    feature: {},
    subclass: { class: 'fighter', levels: [{ level: 3, features: [] }] },
    feat: { category: pack.edition === '2024' ? 'general' : undefined, tags: pack.edition === '2024' ? ['general'] : [] },
    species: { size: 'Medium', speed: 30 },
    subspecies: { species: '' },
    background: {},
    item: { kind: 'wondrous', magic: true },
    spell: { level: 1, school: 'evocation', castingTime: '1 action', actionType: 'action', range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous', concentration: false, ritual: false, classes: [] },
  }
  return Entity.parse({ ...common, type, ...byType[type], ...extra })
}

/** Validate one entity (edited in the form or as JSON): the parsed entity, or readable errors. */
export function checkEntity(raw: unknown): { ok: true; entity: Entity } | { ok: false; errors: string[] } {
  const r = Entity.safeParse(raw)
  if (r.success) return { ok: true, entity: r.data }
  // Union errors are long; show the most specific issues first.
  const issues = r.error.issues.flatMap((i) => ('errors' in i && Array.isArray(i.errors) ? (i.errors as { path: PropertyKey[]; message: string }[][]).flat() : [i]))
  const msgs = [...new Set(issues.map((i) => `${i.path.join('.') || '(entity)'}: ${i.message}`))]
  return { ok: false, errors: msgs.slice(0, 12) }
}

/** Read a pack file (export of this app or a hand-written JSON pack). */
export function parsePackFile(text: string): { ok: true; pack: Pack } | { ok: false; errors: string[] } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  const r = Pack.safeParse(json)
  if (!r.success) return { ok: false, errors: r.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`) }
  return { ok: true, pack: r.data }
}

/**
 * References inside a pack that don't resolve: subclass levels, choice
 * options, granted spells, subspecies parents. `known` holds the ids of the
 * rest of the content (SRD + other packs) of the same edition.
 */
export function missingReferences(pack: Pack, known: (id: string) => boolean): string[] {
  const own = new Set(pack.entities.map((e) => e.id))
  const ok = (id: string | undefined) => !id || own.has(id) || known(id)
  const out: string[] = []
  for (const e of pack.entities) {
    if (e.type === 'subclass') {
      if (!ok(e.class)) out.push(`${e.name}: class "${e.class}"`)
      for (const l of e.levels) for (const f of l.features) if (!ok(f)) out.push(`${e.name}: feature "${f}"`)
    }
    if (e.type === 'subspecies' && !ok(e.species)) out.push(`${e.name}: species "${e.species}"`)
    if (e.type === 'species') for (const t of e.traits) if (!ok(t)) out.push(`${e.name}: trait "${t}"`)
    for (const c of e.choices) for (const id of c.from?.ids ?? []) if (!ok(id)) out.push(`${e.name} / ${c.label}: "${id}"`)
    for (const g of e.spells) if (!ok(g.id)) out.push(`${e.name}: spell "${g.id}"`)
  }
  return out
}

/** Copy a pack under a new id (importing a pack you already have). */
export function copyPack(pack: Pack, name = `${pack.name} (copy)`): Pack {
  const fresh = newPack(pack.edition, name)
  const map = new Map(pack.entities.map((e) => [e.id, e.id.startsWith(pack.id) ? fresh.id + e.id.slice(pack.id.length) : e.id]))
  // Every string that is one of the pack's ids (references included) gets the new id.
  const remap = (v: unknown): unknown =>
    typeof v === 'string' ? (map.get(v) ?? v) : Array.isArray(v) ? v.map(remap) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)])) : v
  const entities = (remap(pack.entities) as Entity[]).map((e) => ({ ...e, source: { ...e.source, book: fresh.book } }))
  return Pack.parse({ ...fresh, entities })
}
