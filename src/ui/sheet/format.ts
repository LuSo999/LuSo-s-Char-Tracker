import type { ActionType } from '../../content/schema'
import type { Value } from '../../engine/derive'

export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

/** Tooltip text listing where a number comes from. */
export function breakdown(v: Value) {
  const lines = v.parts.filter((p) => p.label || p.value).map((p) => `${p.label || '—'}: ${signed(p.value)}`)
  if (v.overridden) lines.push(`Manual: ${v.value} (computed ${v.computed})`)
  return lines.join('\n')
}

export const actionTypeIcon: Record<ActionType, string> = {
  action: '⚔️',
  bonusAction: '✨',
  reaction: '↩️',
  other: '◆',
}

export const actionTypeShort: Record<ActionType, string> = {
  action: 'Action',
  bonusAction: 'Bonus',
  reaction: 'Reaction',
  other: 'Other',
}

export const actionTypeClass: Record<ActionType, string> = {
  action: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300',
  bonusAction: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  reaction: 'bg-violet-600/15 text-violet-700 dark:text-violet-300',
  other: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}
