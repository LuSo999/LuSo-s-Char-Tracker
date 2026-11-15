// Real examples for a help topic, found in whatever content is loaded (SRD, books, homebrew).
import type { ContentIndex } from '../../../content'
import type { Entity, EntityType } from '../../../content/schema'
import type { Snippet } from '../describe'
import { topicMeta } from './topics'
import type { HelpId } from './text.en'

export type Example = { entity: Entity; snippet: Snippet }

const SCANNED: EntityType[] = ['class', 'subclass', 'feature', 'feat', 'species', 'subspecies', 'background', 'trait', 'item', 'spell', 'creature', 'condition']
const cache = new WeakMap<ContentIndex, Map<string, Example[]>>()

/**
 * Up to `limit` examples, spread over the matches so they come from different books rather than
 * the first few entities of one pack.
 */
export function findExamples(content: ContentIndex, id: HelpId, limit = 4): Example[] {
  const key = `${id}:${limit}`
  let perContent = cache.get(content)
  if (!perContent) cache.set(content, (perContent = new Map()))
  const hit = perContent.get(key)
  if (hit) return hit
  const matcher = topicMeta(id).examples
  const out: Example[] = []
  if (matcher) {
    const all: Example[] = []
    for (const type of SCANNED) {
      for (const entity of content.all(type)) {
        const found = matcher(entity)
        if (found.length) all.push({ entity, snippet: found[0] })
      }
    }
    // Spread evenly over the matches.
    const step = all.length / Math.min(limit, all.length || 1)
    for (let i = 0; i < Math.min(limit, all.length); i++) out.push(all[Math.floor(i * step)])
  }
  perContent.set(key, out)
  return out
}
