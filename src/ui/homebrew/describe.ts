// One-line sentences for mechanics rows ("+1 to AC while wearing armor"): row headers in the
// homebrew editor, examples in the Ctrl help, the allies panel on the sheet.
import type { TFunction } from 'i18next'
import type { ContentIndex } from '../../content'
import type { EffectWhen, Entity, Scaled } from '../../content/schema'
import { companionStatFamily, parseTarget, type Family, type Param, type ParsedTarget } from './targets'

export type Ctx = { t: TFunction; content?: ContentIndex }

/** A raw row, as stored in a homebrew draft (may be incomplete while editing). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** "3", "pb", "by level (1: 2, 5: 3)". */
export function scaledText(v: Scaled | undefined, { t }: Ctx): string {
  if (v === undefined || v === null) return '?'
  if (typeof v === 'number' || typeof v === 'string') return String(v)
  const steps = Object.entries(v.byLevel ?? {})
    .map(([l, x]) => `${l}: ${x}`)
    .join(', ')
  return t('homebrew.d.byLevel', { steps })
}

const signedText = (v: Scaled | undefined, ctx: Ctx) => {
  const s = scaledText(v, ctx)
  if (typeof v === 'number') return v >= 0 ? `+${v}` : `${v}`
  return s.startsWith('-') ? s : `+${s}`
}

/** Display name of a parameter value: an ability, a skill, a spell from the content… */
export function argLabel(p: Param | undefined, value: string, ctx: Ctx): string {
  const { t, content } = ctx
  if (!value) return '…'
  switch (p) {
    case 'ability':
    case 'abilityAll':
      return value === 'all' ? t('homebrew.d.all') : value.toUpperCase()
    case 'skill':
      return content?.get(`skill-${value}`)?.name ?? cap(value.replace(/-/g, ' '))
    case 'spell':
    case 'creature':
    case 'weapon':
    case 'classOpt':
      return value.startsWith('@') ? t('homebrew.d.picked', { choice: value.slice(1) }) : (content?.get(value)?.name ?? value)
    case 'companionStat':
      return companionStatLabel(value, ctx)
    case 'target':
      return targetLabel(parseTarget(value), ctx)
    default:
      return value.startsWith('@') ? t('homebrew.d.picked', { choice: value.slice(1) }) : cap(value.replace(/-/g, ' '))
  }
}

function companionStatLabel(stat: string, ctx: Ctx): string {
  if (stat === 'hp' || stat === 'hpPerDie' || stat === 'tempHp') return ctx.t(`homebrew.target.companion_${stat}`)
  if (stat === 'attack' || stat === 'damage') return ctx.t(`homebrew.target.companion_${stat}`)
  return targetLabel(parseTarget(stat), ctx)
}

/** "Wisdom saving throws", "Proficiency: Stealth", "Your creatures (summons): AC". */
export function targetLabel(p: ParsedTarget, ctx: Ctx): string {
  const { t } = ctx
  const f = p.family
  if (!f) return p.raw || '…'
  if (f.id === 'proficiency') {
    const [kind, id] = p.args
    const sub = kind === 'skill' ? 'skill' : kind === 'save' ? 'ability' : undefined
    return t('homebrew.target.proficiency', { arg: `${t(`homebrew.profKind.${kind}`, { defaultValue: kind })} ${argLabel(sub as Param | undefined, id ?? '', ctx)}` })
  }
  if (f.id === 'spellDc' || f.id === 'spellAttack') {
    const base = t(`homebrew.target.${f.id}`)
    return p.args[0] ? `${base} (${argLabel('classOpt', p.args[0], ctx)})` : base
  }
  const label = t(`homebrew.target.${f.id}`, { arg: argLabel(f.params[0], p.args[0] ?? '', ctx) })
  if (f.id === 'companion' && p.group) return `${label} (${groupLabel(p.group, ctx)})`
  if (f.category === 'shape' && p.group) return `${label} (${p.group})`
  return label
}

/** companion@<filter>: a kind, a grant id or a creature id. */
export function groupLabel(group: string, ctx: Ctx): string {
  if (['familiar', 'steed', 'companion', 'summon'].includes(group)) return ctx.t(`homebrew.companionKind.${group}`)
  return ctx.content?.get(group)?.name ?? group
}

export function whenText(when: EffectWhen | undefined, ctx: Ctx): string {
  if (!when) return ''
  const one = (w: Exclude<EffectWhen, unknown[]>) => (typeof w === 'string' ? ctx.t(`homebrew.when.${w}`, { defaultValue: w }) : ctx.t('homebrew.d.whileToggle', { name: w.toggle }))
  return (Array.isArray(when) ? when : [when]).map(one).join(ctx.t('homebrew.d.and'))
}

/** How the value combines with a family: "+2 to AC", "AC at least 13", "Darkvision 60 ft". */
function valuePart(f: Family | undefined, label: string, e: Raw, ctx: Ctx): string {
  const { t } = ctx
  if (!f) return t('homebrew.d.add', { value: signedText(e.value, ctx), what: label })
  if (f.valueless) return label
  if (f.id === 'proficiency') return Number(e.value) >= 2 ? t('homebrew.d.expertise', { what: label.replace(/^[^:]*:\s*/, '') }) : label
  const ft = f.unit === 'ft' ? ` ${t('homebrew.d.ft')}` : ''
  if (f.id === 'critRange' && e.op === 'min') return t('homebrew.d.crit', { value: scaledText(e.value, ctx) })
  if (f.id === 'sense' && e.op !== 'add') return `${label} ${scaledText(e.value, ctx)}${ft}`
  if (f.id === 'speedMode') return `${label} ${e.value === 'walk' ? t('homebrew.d.equalWalk') : scaledText(e.value, ctx) + ft}`
  switch (e.op ?? 'add') {
    case 'set':
      return t('homebrew.d.set', { what: label, value: scaledText(e.value, ctx) + ft })
    case 'max':
      return t('homebrew.d.max', { what: label, value: scaledText(e.value, ctx) + ft })
    case 'min':
      return t('homebrew.d.min', { what: label, value: scaledText(e.value, ctx) + ft })
    default:
      return t('homebrew.d.add', { value: signedText(e.value, ctx) + ft, what: label })
  }
}

export function describeEffect(e: Raw, ctx: Ctx): string {
  const { t } = ctx
  const p = parseTarget(String(e.target ?? ''))
  let text: string
  if (p.family?.id === 'note') text = e.note || t('homebrew.target.note')
  else if (p.family?.id === 'companion') {
    const stat = p.args[0] ?? ''
    const who = p.group ? groupLabel(p.group, ctx) : t('homebrew.d.allCreatures')
    const inner = valuePart(companionStatFamily(stat), companionStatLabel(stat, ctx), e, ctx)
    text = t('homebrew.d.companion', { who, what: inner })
  } else if (p.family?.id === 'ally') {
    const inner = parseTarget(p.args[0] ?? '')
    const what = inner.family?.id === 'note' ? e.note || t('homebrew.target.note') : valuePart(inner.family, targetLabel(inner, ctx), e, ctx)
    text = e.range ? t('homebrew.d.allyRange', { what, range: e.range }) : t('homebrew.d.ally', { what })
  } else text = valuePart(p.family, targetLabel(p, ctx), e, ctx)
  if (e.max !== undefined && p.family?.id === 'score') text += ` ${t('homebrew.d.cap', { max: e.max })}`
  const w = whenText(e.when, ctx)
  if (w) text += `, ${w}`
  if (e.note && p.family?.id !== 'note' && !(p.family?.id === 'ally' && parseTarget(p.args[0] ?? '').family?.id === 'note')) text += ` — ${e.note}`
  return text
}

export function describeResource(r: Raw, ctx: Ctx): string {
  const { t } = ctx
  const back = (r.recharge as Raw[] | undefined)?.map((x) => t(`homebrew.rechargeOn.${x.on}`, { defaultValue: x.on })).join(' / ')
  const pool = r.die !== undefined ? t('homebrew.d.dicePool', { count: scaledText(r.max, ctx), die: scaledText(r.die, ctx) }) : t('homebrew.d.uses', { count: scaledText(r.max, ctx) })
  return `${r.name || r.id || '…'}: ${pool}${back ? `, ${t('homebrew.d.back', { when: back })}` : `, ${t('homebrew.d.neverBack')}`}`
}

export function describeActivity(a: Raw, ctx: Ctx): string {
  const { t } = ctx
  const parts = [`${a.name || '…'} (${t(`homebrew.action.${a.actionType}`, { defaultValue: a.actionType })})`]
  for (const c of (a.cost as Raw[] | undefined) ?? []) parts.push(t('homebrew.d.spends', { amount: c.amount ?? 1, what: poolLabel(c.resource, ctx) }))
  if (a.slotCost) parts.push(t('homebrew.d.spendsSlot'))
  if (a.roll) {
    const dice = typeof a.roll.dice === 'object' && a.roll.dice ? `${scaledText(a.roll.dice.count, ctx)}d${scaledText(a.roll.dice.die, ctx)}` : (a.roll.dice ?? '')
    const bonus = a.roll.bonus !== undefined ? ` ${signedText(a.roll.bonus, ctx)}` : ''
    parts.push(`${t(`homebrew.roll.${a.roll.kind}`)} ${dice}${bonus}`.trim())
  }
  if (a.saveDc !== undefined) parts.push(t('homebrew.d.save', { dc: scaledText(a.saveDc, ctx), ability: (a.saveAbility ?? '?').toUpperCase() }))
  if (a.toggle) parts.push(t('homebrew.d.toggles', { name: a.toggle }))
  for (const r of (a.restore as Raw[] | undefined) ?? []) parts.push(t('homebrew.d.restores', { what: poolLabel(r.resource, ctx), amount: r.amount === 'all' ? t('homebrew.d.all') : scaledText(r.amount, ctx) }))
  if (a.grants === 'action') parts.push(t('homebrew.d.grantsAction'))
  return parts.join(', ')
}

export function poolLabel(id: string | undefined, { t }: Ctx): string {
  if (!id) return '…'
  if (id === '@quantity') return t('homebrew.d.itself')
  if (id === '@hitDie') return t('homebrew.d.hitDie')
  return id
}

export function describeChoice(c: Raw, ctx: Ctx): string {
  const { t } = ctx
  const what = t(`homebrew.choiceKind.${c.kind}`, { defaultValue: c.kind })
  const count = scaledText(c.count ?? 1, ctx)
  return `${c.label || '…'}: ${t('homebrew.d.picks', { count, what })}`
}

export function describeSpellGrant(g: Raw, ctx: Ctx): string {
  const { t, content } = ctx
  const name = g.fromChoice ? t('homebrew.d.picked', { choice: g.fromChoice }) : (content?.get(g.id)?.name ?? (g.id || '…'))
  const parts = [t('homebrew.d.alwaysPrepared', { name })]
  if (g.minLevel) parts.push(t('homebrew.d.fromLevel', { level: g.minLevel }))
  if (g.atWill) parts.push(t('homebrew.d.atWill'))
  if (g.freeCast) parts.push(t('homebrew.d.freeCast', { what: poolLabel(g.freeCast, ctx) }))
  return parts.join(', ')
}

export function describeCompanion(c: Raw, ctx: Ctx): string {
  const { t, content } = ctx
  const kind = t(`homebrew.companionKind.${c.kind}`, { defaultValue: c.kind })
  const names = ((c.creatures as string[] | undefined) ?? []).map((id) => content?.get(id)?.name ?? id)
  const f = c.filter as Raw | undefined
  if (f) names.push(t('homebrew.d.filter', { type: f.creatureType ?? '*', cr: f.maxCr ?? '∞' }))
  return `${kind}: ${names.join(', ') || '…'}${c.slot ? ` (${t('homebrew.d.slot')})` : ''}`
}

export function describeAttack(a: Raw, ctx: Ctx): string {
  const dice = a.damage?.dice ?? ''
  const w = a.while ? `, ${ctx.t('homebrew.d.whileToggle', { name: a.while })}` : ''
  return `${a.name || '…'}: ${dice} ${a.damage?.type ?? ''}${w}`.trim()
}

/** The kinds of mechanics rows an entity can carry. */
export type RowKind = 'effects' | 'resources' | 'activities' | 'choices' | 'spells' | 'companions' | 'attacks'

/** A row lifted out of some entity: an example for the help, or a template to copy. */
export type Snippet = { kind: RowKind; row: Raw } | { kind: 'entity' }

export function describeSnippet(s: Snippet, entity: Entity, ctx: Ctx): string {
  switch (s.kind) {
    case 'effects':
      return describeEffect(s.row, ctx)
    case 'resources':
      return describeResource(s.row, ctx)
    case 'activities':
      return describeActivity(s.row, ctx)
    case 'choices':
      return describeChoice(s.row, ctx)
    case 'spells':
      return describeSpellGrant(s.row, ctx)
    case 'companions':
      return describeCompanion(s.row, ctx)
    case 'attacks':
      return describeAttack(s.row, ctx)
    default:
      return entity.description
  }
}
