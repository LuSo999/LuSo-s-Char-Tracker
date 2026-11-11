// External rule links for Ctrl+click. An entity's own `source.url` always
// wins; otherwise the link is built from the user's chosen site. Patterns for
// the wikidot sites were checked against the live sites; pages that don't
// exist for a type fall back to the site's search.
import type { ContentIndex } from '.'
import type { Edition, Entity } from './schema'

export const linkSites = ['wikidot', 'open5e', 'dandwiki', 'roll20'] as const
export type LinkSite = (typeof linkSites)[number]

export const linkSiteLabels: Record<LinkSite, Record<Edition, string>> = {
  wikidot: { '2014': 'dnd5e.wikidot.com', '2024': 'dnd2024.wikidot.com' },
  open5e: { '2014': 'open5e.com', '2024': 'open5e.com' },
  dandwiki: { '2014': 'dandwiki.com', '2024': 'dandwiki.com' },
  roll20: { '2014': 'roll20.net', '2024': 'roll20.net' },
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Wikidot pages whose slug isn't the subclass name. */
const wikidotSubclassSlug: Record<string, string> = { '2014:draconic': 'draconic-bloodline' }

/** The SRD drops wizard names from some spells; the wikis keep them (2024 spells as "bigby-s-hand"). */
const srdSpellNames: Record<string, [string, string]> = {
  'acid-arrow': ['melfs-acid-arrow', 'melfs-acid-arrow'],
  'arcane-hand': ['bigbys-hand', 'bigby-s-hand'],
  'arcane-sword': ['mordenkainens-sword', 'mordenkainen-s-sword'],
  'black-tentacles': ['evards-black-tentacles', 'evard-s-black-tentacles'],
  'faithful-hound': ['mordenkainens-faithful-hound', 'mordenkainen-s-faithful-hound'],
  'floating-disk': ['tensers-floating-disk', 'tenser-s-floating-disk'],
  'freezing-sphere': ['otilukes-freezing-sphere', 'otiluke-s-freezing-sphere'],
  'hideous-laughter': ['tashas-hideous-laughter', 'tasha-s-hideous-laughter'],
  'instant-summons': ['drawmijs-instant-summons', 'drawmij-s-instant-summons'],
  'irresistible-dance': ['ottos-irresistible-dance', 'otto-s-irresistible-dance'],
  'magnificent-mansion': ['mordenkainens-magnificent-mansion', 'mordenkainen-s-magnificent-mansion'],
  'private-sanctum': ['mordenkainens-private-sanctum', 'mordenkainen-s-private-sanctum'],
  'resilient-sphere': ['otilukes-resilient-sphere', 'otilukes-resilient-sphere'],
  'secret-chest': ['leomunds-secret-chest', 'leomunds-secret-chest'],
  'telepathic-bond': ['rarys-telepathic-bond', 'rary-s-telepathic-bond'],
  'tiny-hut': ['leomunds-tiny-hut', 'leomund-s-tiny-hut'],
  'arcanists-magic-aura': ['nystuls-magic-aura', 'nystul-s-magic-aura'],
}

/** Magic item pages named differently from the SRD group. */
const wikidotItemSlug: Record<string, string> = {
  '2014:iron-bands-of-binding': 'iron-bands-of-bilarro',
  '2024:potions-of-healing': 'potion-of-healing',
}

/** Magic item variants (Red Dragon Scale Mail) live on their group's page. */
function itemGroup(entity: Entity, content: ContentIndex): Entity {
  const tag = entity.tags.find((t) => t.startsWith('variant-of:'))
  return (tag && content.get(tag.slice('variant-of:'.length))) || entity
}

/** The class or subclass page a feature belongs to (features have no own pages). */
function owner(entity: Entity, content: ContentIndex): Entity | undefined {
  if (entity.type !== 'feature') return undefined
  const parent = entity.parent && content.get(entity.parent)
  if (parent) return parent
  const base = entity.optionOf ?? entity.upgradeOf
  return base ? owner(content.get(base) ?? entity, content) : undefined
}

function speciesOf(entity: Entity, content: ContentIndex) {
  if (entity.type === 'subspecies') return content.getTyped(entity.species, 'species')
  if (entity.type === 'trait') {
    return content.all('species').find((s) => s.traits.includes(entity.id) || s.subspecies.some((sub) => content.getTyped(sub, 'subspecies')?.traits.includes(entity.id)))
  }
  return entity.type === 'species' ? entity : undefined
}

function wikidot(entity: Entity, content: ContentIndex, edition: Edition): string {
  const host = edition === '2014' ? 'https://dnd5e.wikidot.com' : 'https://dnd2024.wikidot.com'
  const search = `${host}/search:site/q/${encodeURIComponent(entity.name)}`
  const e = owner(entity, content) ?? entity
  switch (e.type) {
    case 'class':
      return edition === '2014' ? `${host}/${slugify(e.name)}` : `${host}/${slugify(e.name)}:main`
    case 'subclass': {
      const cls = content.getTyped(e.class, 'class')
      const sub = wikidotSubclassSlug[`${edition}:${e.id}`] ?? slugify(e.name)
      return cls ? `${host}/${slugify(cls.name)}:${sub}` : search
    }
    case 'spell': {
      const renamed = srdSpellNames[slugify(e.name)]
      return `${host}/spell:${renamed ? renamed[edition === '2014' ? 0 : 1] : slugify(e.name)}`
    }
    case 'feat':
      return `${host}/feat:${slugify(e.name)}`
    case 'background':
      return `${host}/background:${slugify(e.name)}`
    case 'species':
    case 'subspecies':
    case 'trait': {
      const species = speciesOf(e, content)
      return species ? `${host}/${edition === '2014' ? 'lineage' : 'species'}:${slugify(species.name)}` : search
    }
    case 'item':
      if (e.magic) {
        const group = itemGroup(e, content)
        const slug = wikidotItemSlug[`${edition}:${group.id}`] ?? slugify(group.name)
        return `${host}/${edition === '2014' ? 'wondrous-items' : 'magic-item'}:${slug}`
      }
      if (e.kind === 'weapon') return edition === '2014' ? `${host}/weapons` : `${host}/equipment:weapon`
      if (e.kind === 'armor') return edition === '2014' ? `${host}/armor` : `${host}/equipment:armor`
      return edition === '2014' ? `${host}/adventuring-gear` : `${host}/equipment:adventuring-gear`
    case 'weaponMastery':
      return edition === '2014' ? search : `${host}/equipment:weapon`
    default:
      return search
  }
}

function open5e(entity: Entity, content: ContentIndex, edition: Edition): string {
  const prefix = edition === '2014' ? 'srd' : 'srd-2024'
  const key = (e: Entity) => `${prefix}_${slugify(e.name)}`
  const search = `https://open5e.com/search?text=${encodeURIComponent(entity.name)}`
  const e = owner(entity, content) ?? entity
  switch (e.type) {
    case 'class':
      return `https://open5e.com/classes/${key(e)}`
    case 'subclass': {
      const cls = content.getTyped(e.class, 'class')
      return cls ? `https://open5e.com/classes/${key(cls)}/${key(e)}` : search
    }
    case 'spell':
      return `https://open5e.com/spells/${key(e)}`
    case 'feat':
      return `https://open5e.com/feats/${key(e)}`
    case 'background':
      return `https://open5e.com/backgrounds/${key(e)}`
    case 'species':
    case 'subspecies':
    case 'trait': {
      const species = speciesOf(e, content)
      return species ? `https://open5e.com/species/${key(species)}` : search
    }
    case 'item':
      return `https://open5e.com/${e.magic ? 'magic-items' : 'equipment'}/${key(e)}`
    case 'condition':
      return `https://open5e.com/conditions/${slugify(e.name)}`
    default:
      return search
  }
}

function dandwiki(entity: Entity, edition: Edition): string {
  // dandwiki hosts the 5.1 SRD as SRD5:<Title>; for 2024 only search is reliable.
  if (edition === '2014') return `https://www.dandwiki.com/wiki/SRD5:${encodeURIComponent(entity.name.replace(/ /g, '_'))}`
  return `https://www.dandwiki.com/w/index.php?search=${encodeURIComponent(entity.name)}`
}

function roll20(entity: Entity): string {
  return `https://roll20.net/compendium/dnd5e/${encodeURIComponent(entity.name)}`
}

export function ruleLink(entity: Entity, content: ContentIndex, site: LinkSite): string {
  if (entity.source.url) return entity.source.url
  const edition = entity.edition
  switch (site) {
    case 'wikidot':
      return wikidot(entity, content, edition)
    case 'open5e':
      return open5e(entity, content, edition)
    case 'dandwiki':
      return dandwiki(entity, edition)
    case 'roll20':
      return roll20(entity)
  }
}
