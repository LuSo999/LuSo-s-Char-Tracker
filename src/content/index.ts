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

  /** Packs of the other edition (for legacy subclasses). */
  private otherPacks: Pack[] = []

  constructor(edition: Edition, packs: readonly Pack[]) {
    this.edition = edition
    this.otherPacks = packs.filter((p) => p.edition !== edition)
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

  /**
   * All entities of a type the character may choose from: items of the other
   * edition only when asked for, and only books the character allows
   * (see withBooks). `get` still finds everything, so existing picks resolve.
   */
  all<T extends EntityType>(type: T, opts: { foreign?: boolean } = {}): ByType<T>[] {
    return [...this.byId.values()].filter((e): e is ByType<T> => e.type === type && (opts.foreign || !this.foreign.has(e.id)) && this.bookAllowed(e))
  }

  /** The book an entity comes from (its own source, else its pack's). */
  bookOf(e: Entity): string {
    return e.source.book || this.packOf.get(e.id)?.book || ''
  }

  /** Books (non-SRD packs) of this edition (and the 2014 ones a legacy view uses), for the "allowed books" setting. */
  books(): { id: string; name: string; abbr?: string; defaultOff: boolean }[] {
    const seen = new Map<string, { id: string; name: string; abbr?: string; defaultOff: boolean }>()
    for (const pack of new Set(this.packOf.values())) {
      if ((pack.edition !== this.edition && !this.legacy) || pack.book.startsWith('srd') || seen.has(pack.book)) continue
      seen.set(pack.book, { id: pack.book, name: pack.name, abbr: pack.abbr, defaultOff: !!pack.defaultOff })
    }
    return [...seen.values()]
  }

  private legacy = false

  /**
   * 2014 subclasses for a 2024 character (the 2024 rules allow older
   * subclasses): copied under "2014:<id>", features before level 3 move to
   * level 3, Ki becomes Focus Points, spells map to this edition's spell of
   * the same name when there is one.
   */
  withLegacySubclasses(on: boolean): ContentIndex {
    if (!on || this.edition !== '2024' || this.legacy) return this
    const view = Object.create(ContentIndex.prototype) as ContentIndex
    Object.assign(view, this, { byId: new Map(this.byId), packOf: new Map(this.packOf), legacy: true })
    const old = new Map<string, { e: Entity; pack: Pack }>()
    for (const pack of this.otherPacks) if (pack.edition === '2014') for (const e of pack.entities) old.set(e.id, { e, pack })
    const localSpell = new Map<string, string>()
    for (const e of this.byId.values()) if (e.type === 'spell') localSpell.set(e.name.toLowerCase(), e.id)
    // Everything a 2014 subclass of a class this edition has pulls in: features, their options, spells.
    const take = new Set<string>()
    // Only these fields hold references to other entities (resource ids, toggles, effect targets don't).
    const refs = (e: Entity): string[] => {
      const out: string[] = []
      const x = e as Entity & { levels?: { features: string[] }[]; optionOf?: string; upgradeOf?: string }
      for (const l of x.levels ?? []) out.push(...l.features)
      if (x.optionOf) out.push(x.optionOf)
      if (x.upgradeOf) out.push(x.upgradeOf)
      for (const c of e.choices) out.push(...(c.from?.ids ?? []), ...(c.kind === 'spell' || c.kind === 'entity' ? (c.options ?? []) : []))
      for (const g of e.spells) if (g.id) out.push(g.id)
      out.push(...(e.expandedSpells ?? []))
      return out
    }
    const visit = (id: string) => {
      const o = old.get(id)
      if (!o || take.has(id)) return
      if (o.e.type === 'spell' && localSpell.has(o.e.name.toLowerCase())) return
      // Class features the subclass refers to stay this edition's (Channel Divinity…).
      if (o.e.type === 'class' || (o.e.type === 'feature' && old.get(o.e.parent ?? '')?.e.type === 'class' && this.byId.has(id))) return
      take.add(id)
      refs(o.e).forEach(visit)
    }
    for (const { e } of old.values()) if (e.type === 'subclass' && this.byId.get(e.class)?.type === 'class') visit(e.id)
    const mapId = (id: string): string => {
      const o = old.get(id)
      if (!o) return id
      if (o.e.type === 'spell') return localSpell.get(o.e.name.toLowerCase()) ?? (take.has(id) ? `2014:${id}` : id)
      return take.has(id) ? `2014:${id}` : id
    }
    const ki = (v: string) => v.replace(/\bused_ki\b/g, 'used_focus').replace(/\bmax_ki\b/g, 'max_focus')
    const convert = (e: Entity): Entity => {
      const c = structuredClone(e) as Entity & { levels?: { level: number; features: string[] }[]; optionOf?: string; upgradeOf?: string; parent?: string }
      if (c.levels) c.levels = c.levels.map((l) => ({ ...l, features: l.features.map(mapId) }))
      if (c.optionOf) c.optionOf = mapId(c.optionOf)
      if (c.upgradeOf) c.upgradeOf = mapId(c.upgradeOf)
      if (c.parent) c.parent = mapId(c.parent)
      c.choices = c.choices.map((ch) => ({
        ...ch,
        ...(ch.from?.ids ? { from: { ...ch.from, ids: ch.from.ids.map(mapId) } } : {}),
        ...(ch.options && (ch.kind === 'spell' || ch.kind === 'entity') ? { options: ch.options.map(mapId) } : {}),
      }))
      c.spells = c.spells.map((g) => (g.id ? { ...g, id: mapId(g.id) } : g))
      c.expandedSpells = (c.expandedSpells ?? []).map(mapId)
      // 2014 Ki is the 2024 Monk's Focus Points.
      c.activities = c.activities.map((a) => ({
        ...a,
        cost: a.cost.map((x) => (x.resource === 'ki' ? { ...x, resource: 'focus' } : x)),
        restore: a.restore.map((x) => (x.resource === 'ki' ? { ...x, resource: 'focus' } : x)),
        ...(typeof a.saveDc === 'string' ? { saveDc: ki(a.saveDc) } : {}),
      }))
      return c
    }
    for (const id of take) {
      const { e, pack } = old.get(id)!
      const copy = convert(e) as Entity & { levels?: { level: number; features: string[] }[] }
      copy.id = `2014:${id}`
      ;(copy as { edition: Edition }).edition = this.edition
      copy.tags = [...e.tags, 'legacy-2014']
      if (e.type === 'subclass') {
        copy.name = `${e.name} (2014)`
        // 2024 classes gain their subclass at level 3: earlier features come at 3.
        const levels = new Map<number, string[]>()
        for (const l of copy.levels ?? []) {
          const at = Math.max(3, l.level)
          levels.set(at, [...(levels.get(at) ?? []), ...l.features])
        }
        copy.levels = [...levels].sort((a, b) => a[0] - b[0]).map(([level, features]) => ({ level, features }))
      }
      view.byId.set(copy.id, copy)
      view.packOf.set(copy.id, pack)
    }
    return view
  }

  private allowedBooks?: Set<string>
  private offBooks?: Set<string>

  private bookAllowed(e: Entity): boolean {
    const book = this.bookOf(e)
    if (!book || book.startsWith('srd') || book === 'homebrew') return true
    if (this.allowedBooks) return this.allowedBooks.has(book)
    return !this.offBooks?.has(book)
  }

  /**
   * A view that offers only the character's allowed books. An empty list
   * means every official book except the ones that are off by default.
   */
  withBooks(books: readonly string[]): ContentIndex {
    const view = Object.create(ContentIndex.prototype) as ContentIndex
    const off = new Set([...new Set(this.packOf.values())].filter((p) => p.defaultOff).map((p) => p.book))
    Object.assign(view, this, books.length ? { allowedBooks: new Set(books) } : { offBooks: off })
    return view
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
