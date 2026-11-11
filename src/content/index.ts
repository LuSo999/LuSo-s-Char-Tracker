// In-memory lookup over all content available to a character: built-in SRD
// for the edition plus shared official packs and homebrew. Later packs win on
// id clashes, so a homebrew pack can deliberately replace an SRD entity.
import type { Edition, Entity, EntityType, Item, Pack } from './schema'

type ByType<T extends EntityType> = Extract<Entity, { type: T }>

export class ContentIndex {
  readonly edition: Edition
  private byId = new Map<string, Entity>()
  private packOf = new Map<string, Pack>()

  constructor(edition: Edition, packs: readonly Pack[]) {
    this.edition = edition
    for (const pack of packs) {
      if (pack.edition !== edition) continue
      for (const e of pack.entities) {
        this.byId.set(e.id, e)
        this.packOf.set(e.id, pack)
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

  all<T extends EntityType>(type: T): ByType<T>[] {
    return [...this.byId.values()].filter((e): e is ByType<T> => e.type === type)
  }

  pack(id: string): Pack | undefined {
    return this.packOf.get(id)
  }
}
