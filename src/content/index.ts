// In-memory lookup over all content available to a character: built-in SRD
// for the edition plus shared official packs and homebrew. Later packs win on
// id clashes, so a homebrew pack can deliberately replace an SRD entity.
//
// Items of the other edition are available too (tables often allow older
// items), under ids prefixed with their edition ("2014:alchemy-jug"). They
// keep their own rules; magic weapons/armor are linked to this edition's base
// items and ammunition kinds where the same item exists.
import type { Edition, Entity, EntityType, Item, Pack } from './schema'

type ByType<T extends EntityType> = Extract<Entity, { type: T }>

/** Ammunition kinds are named differently in the two SRDs. */
const ammoKinds: Record<string, string> = {
  arrow: 'arrows',
  'crossbow-bolt': 'bolts',
  'sling-bullet': 'bullets-sling',
  'blowgun-needle': 'needles',
}
const ammoKindsReverse = Object.fromEntries(Object.entries(ammoKinds).map(([a, b]) => [b, a]))

const normName = (n: string) => n.toLowerCase().replace(/-/g, ' ').replace(/ armor$/, '')

export function foreignId(edition: Edition, id: string) {
  return `${edition}:${id}`
}

export class ContentIndex {
  readonly edition: Edition
  private byId = new Map<string, Entity>()
  private packOf = new Map<string, Pack>()
  private foreign = new Set<string>()

  constructor(edition: Edition, packs: readonly Pack[]) {
    this.edition = edition
    for (const pack of packs) {
      if (pack.edition !== edition) continue
      for (const e of pack.entities) {
        this.byId.set(e.id, e)
        this.packOf.set(e.id, pack)
      }
    }
    // Other-edition items, after this edition's items exist to link them to.
    const local = new Map<string, Item>()
    for (const e of this.byId.values()) if (e.type === 'item' && !e.magic) local.set(normName(e.name), e)
    for (const pack of packs) {
      if (pack.edition === edition) continue
      const byPackId = new Map(pack.entities.map((e) => [e.id, e]))
      const map = (id: string) => {
        const original = byPackId.get(id)
        const same = original && original.type === 'item' && !original.magic ? local.get(normName(original.name)) : undefined
        return same?.id ?? (byPackId.has(id) ? foreignId(pack.edition, id) : id)
      }
      const ammo = (kind: string | undefined) => {
        if (!kind) return kind
        const translated = pack.edition === '2014' ? ammoKinds[kind] : ammoKindsReverse[kind]
        return translated && this.byId.has(translated) ? translated : foreignId(pack.edition, kind)
      }
      for (const e of pack.entities) {
        if (e.type !== 'item') continue
        const copy = { ...e, id: foreignId(pack.edition, e.id), tags: e.tags.map((t) => (t.startsWith('variant-of:') ? `variant-of:${foreignId(pack.edition, t.slice(11))}` : t)) } as Item
        if (copy.kind === 'weapon') copy.ammunition = ammo(copy.ammunition)
        if (copy.kind === 'ammunition') copy.ammoKind = ammo(copy.ammoKind)
        if ('baseOptions' in copy && copy.baseOptions) copy.baseOptions = [...new Set(copy.baseOptions.map(map))]
        this.byId.set(copy.id, copy)
        this.packOf.set(copy.id, pack)
        this.foreign.add(copy.id)
      }
    }
  }

  get(id: string): Entity | undefined {
    return this.byId.get(id)
  }

  getTyped<T extends EntityType>(id: string, type: T): ByType<T> | undefined {
    const e = this.byId.get(id)
    return e && e.type === type ? (e as ByType<T>) : undefined
  }

  /** Like getTyped, but a missing entity is a data error worth surfacing. */
  require<T extends EntityType>(id: string, type: T): ByType<T> {
    const e = this.getTyped(id, type)
    if (!e) throw new Error(`Missing ${type} "${id}" in ${this.edition} content`)
    return e
  }

  item(id: string): Item | undefined {
    return this.getTyped(id, 'item')
  }

  /** All entities of a type; items of the other edition only when asked for. */
  all<T extends EntityType>(type: T, opts: { foreign?: boolean } = {}): ByType<T>[] {
    return [...this.byId.values()].filter((e): e is ByType<T> => e.type === type && (opts.foreign || !this.foreign.has(e.id)))
  }

  /** True for items that come from the other edition. */
  isForeign(id: string): boolean {
    return this.foreign.has(id)
  }

  pack(id: string): Pack | undefined {
    return this.packOf.get(id)
  }

  /**
   * A view with a character's own names, summaries and links applied, so
   * every list, preview and link shows them. Activities and resources named
   * like their entity follow the new name.
   */
  withCustomizations(custom: Record<string, { name?: string; description?: string; url?: string }>): ContentIndex {
    const ids = Object.keys(custom).filter((id) => this.byId.has(id))
    if (!ids.length) return this
    const view = Object.create(ContentIndex.prototype) as ContentIndex
    Object.assign(view, this, { byId: new Map(this.byId), customized: new Set(ids) })
    for (const id of ids) {
      const e = this.byId.get(id)!
      const c = custom[id]
      const name = c.name || e.name
      const rename = (n: string) => (n === e.name ? name : n)
      view.byId.set(id, {
        ...e,
        name,
        description: c.description ?? e.description,
        text: c.description !== undefined ? c.description : e.text,
        source: { ...e.source, url: c.url || e.source.url },
        activities: e.activities.map((a) => ({ ...a, name: rename(a.name) })),
        resources: e.resources.map((r) => ({ ...r, name: rename(r.name) })),
      } as Entity)
    }
    return view
  }

  private customized?: Set<string>

  /** True when the character renamed / re-described / re-linked this entity. */
  isCustomized(id: string): boolean {
    return this.customized?.has(id) ?? false
  }
}
