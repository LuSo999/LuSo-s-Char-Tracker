import type { TFunction } from 'i18next'
import type { HistoryItem } from '../../engine/actions'
import type { HistoryGroup } from '../../engine/history'

/** History is stored as data and rendered in the current language. */
export function itemText(t: TFunction, item: HistoryItem): string {
  const params = { ...item.params, before: item.before, after: item.after }
  if (item.type === 'undo') return t('history.items.undo', { what: t(`history.groups.${item.params?.what}`) })
  const text = t(`history.items.${item.type}`, { ...params, defaultValue: item.type })
  if (item.before !== undefined && item.after !== undefined && !text.includes(String(item.after))) return `${text} ${item.before} → ${item.after}`
  return text
}

export function groupTitle(t: TFunction, group: HistoryGroup): string {
  return t(`history.groups.${group.groupType}`, { defaultValue: group.groupType })
}

/** One-line summary for toasts: the most telling item of the group. */
export function groupSummary(t: TFunction, group: Pick<HistoryGroup, 'items' | 'groupType'>): string {
  const main = group.items.find((i) => i.before !== undefined) ?? group.items[0]
  return main ? itemText(t, main) : t(`history.groups.${group.groupType}`)
}
