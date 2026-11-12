// Extras: features, feats or traits the character has beyond class, species
// and background (granted by the DM, from the backstory, homebrew). Edit mode
// adds and removes them; they go to the sheet history.
import type { ContentIndex } from '../content'
import { Feature, type ActionType, type Effect, type RechargeOn } from '../content/schema'
import type { ActionResult, HistoryItem } from './actions'
import type { Character } from './character'

const newUid = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const ok = (character: Character, items: HistoryItem[]): ActionResult => ({ ok: true, character, items, groupType: 'extras', kind: 'sheet' })

/** Add something from the rules (feature, feat, trait…) by id. */
export function addExtra(char: Character, content: ContentIndex, entityId: string, note?: string): ActionResult {
  const e = content.get(entityId)
  if (!e) return { ok: false, error: 'unknownEntity' }
  if (char.extras.some((x) => x.entityId === entityId) && !('repeatable' in e && e.repeatable)) return { ok: false, error: 'alreadyHave', params: { name: e.name } }
  const extra = { uid: newUid(), entityId, ...(note?.trim() ? { note: note.trim() } : {}) }
  return ok({ ...char, extras: [...char.extras, extra] }, [{ type: 'extraAdded', params: { name: e.name, note: note?.trim() ?? '' }, entity: entityId }])
}

/** The quick form for an own feature: everything optional except the name. */
export type CustomFeatureInput = {
  name: string
  description?: string
  note?: string
  actionType?: ActionType | 'none'
  uses?: number
  recharge?: RechargeOn | 'none'
  /** Simple constant bonuses, e.g. { target: 'ac', value: 1 }. */
  effects?: { target: string; value: number }[]
}

export function addCustomFeature(char: Character, input: CustomFeatureInput): ActionResult {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'nameRequired' }
  const uid = newUid()
  const id = `custom:${uid}`
  const uses = input.uses && input.uses > 0 ? Math.round(input.uses) : undefined
  const resourceId = `custom-${uid}`
  const acting = input.actionType && input.actionType !== 'none'
  const recharge = input.recharge && input.recharge !== 'none' ? input.recharge : undefined
  const feature = Feature.parse({
    id,
    edition: char.edition,
    type: 'feature',
    name,
    description: input.description?.trim() ?? '',
    source: { book: 'custom' },
    actionType: acting ? input.actionType : undefined,
    effects: (input.effects ?? []).filter((e) => e.target && e.value).map((e): Effect => ({ target: e.target, op: 'add', value: e.value })),
    resources: uses
      ? [{ id: resourceId, name, max: uses, recharge: recharge ? (recharge === 'shortRest' ? [{ on: 'shortRest', amount: 'all' }, { on: 'longRest', amount: 'all' }] : [{ on: recharge, amount: 'all' }]) : [] }]
      : [],
    activities:
      acting || uses
        ? [{ id: 'use', name, actionType: acting ? input.actionType : 'other', cost: uses ? [{ resource: resourceId }] : [], summary: input.description?.trim() || undefined }]
        : [],
    tags: ['custom'],
  })
  const extra = { uid, custom: feature, ...(input.note?.trim() ? { note: input.note.trim() } : {}) }
  return ok({ ...char, extras: [...char.extras, extra] }, [{ type: 'extraAdded', params: { name, note: input.note?.trim() ?? '' } }])
}

export function removeExtra(char: Character, content: ContentIndex, uid: string): ActionResult {
  const x = char.extras.find((e) => e.uid === uid)
  if (!x) return { ok: false, error: 'unknownEntity' }
  const name = x.custom?.name ?? (x.entityId ? content.get(x.entityId)?.name : undefined) ?? uid
  const resourcesUsed = { ...char.resourcesUsed }
  if (x.custom) for (const r of x.custom.resources) delete resourcesUsed[r.id]
  return ok({ ...char, extras: char.extras.filter((e) => e.uid !== uid), resourcesUsed }, [{ type: 'extraRemoved', params: { name }, entity: x.entityId }])
}
