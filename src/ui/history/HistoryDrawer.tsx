import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HistoryGroup } from '../../engine/history'
import { RuleRef } from '../rules/RuleRef'
import { useSheet } from '../sheet/context'
import { groupTitle, itemText } from './text'

/** Consecutive attacks of one Attack action are shown together. */
function blocks(list: HistoryGroup[]): (HistoryGroup | { groups: HistoryGroup[] })[] {
  const out: (HistoryGroup | { groups: HistoryGroup[] })[] = []
  for (const g of list) {
    const last = out[out.length - 1]
    if (g.actionId && last && 'groups' in last && last.groups[0].actionId === g.actionId) last.groups.push(g)
    else if (g.actionId) out.push({ groups: [g] })
    else out.push(g)
  }
  // A single attack needs no wrapper.
  return out.map((b) => ('groups' in b && b.groups.length === 1 ? b.groups[0] : b))
}

/**
 * Character history: game events and sheet changes, newest first, grouped by
 * action, split into play sessions. Searchable and filterable.
 */
export function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { store, content } = useSheet()
  const [showGame, setShowGame] = useState(true)
  const [showSheet, setShowSheet] = useState(true)
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')

  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const undone = useMemo(() => new Set(store.history.filter((g) => g.undoes).map((g) => g.undoes)), [store.history])
  const types = useMemo(() => [...new Set(store.history.map((g) => g.groupType))].filter((x) => x !== 'session'), [store.history])

  const texts = (g: HistoryGroup) => [groupTitle(t, g), ...g.items.map((i) => itemText(t, i))].join(' ').toLowerCase()
  const visible = store.history.filter((g) => {
    if (g.groupType === 'session') return !search && !type && showGame
    if (g.kind === 'game' && !showGame) return false
    if (g.kind === 'sheet' && !showSheet) return false
    if (type && g.groupType !== type) return false
    return !search || texts(g).includes(search.toLowerCase())
  })

  const renderGroup = (g: HistoryGroup, nested = false) => {
    if (g.groupType === 'session') {
      return (
        <li key={g.id} className="my-3 flex items-center gap-2 text-xs font-semibold uppercase text-accent">
          <span className="h-px flex-1 bg-accent" />
          {t('history.sessionStarted', { time: time.format(g.at) })}
          <span className="h-px flex-1 bg-accent" />
        </li>
      )
    }
    const isSheet = g.kind === 'sheet'
    const wasUndone = undone.has(g.id)
    // The first item names the action (used X, attacked with Y, undid Z); it becomes the title.
    const headItem = ['use', 'attack', 'note', 'undo'].includes(g.items[0]?.type) ? g.items[0] : undefined
    const lines = g.items.filter((i) => i !== headItem)
    const head = (
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`${isSheet ? 'font-semibold text-accent' : 'font-medium'} ${wasUndone ? 'line-through opacity-60' : ''}`}>
          {headItem ? itemText(t, headItem) : groupTitle(t, g)}
        </span>
        <span className="text-xs text-muted">
          {wasUndone && <span className="mr-1 rounded bg-border px-1">{t('history.undone')}</span>}
          {time.format(g.at)}
        </span>
      </span>
    )
    const body = (
      <ul className="mt-0.5 space-y-0.5 pl-3 text-sm text-muted">
        {lines.map((i, n) => (
          <li key={n}>
            <RuleRef entity={i.entity ? content.get(i.entity) : undefined} content={content}>
              {itemText(t, i)}
            </RuleRef>
          </li>
        ))}
      </ul>
    )
    return (
      <li key={g.id} className={nested ? 'py-0.5' : `mb-2 rounded border p-2 ${isSheet ? 'border-l-4 border-accent bg-accent/5' : 'border-border'}`}>
        {lines.length > 2 ? (
          <details>
            <summary className="cursor-pointer list-none">{head}</summary>
            {body}
          </details>
        ) : (
          <>
            {head}
            {lines.length > 0 && body}
          </>
        )}
      </li>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full flex-col border-l border-border bg-card shadow-xl sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('history.title')}
      >
        <header className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">{t('history.title')}</h2>
            <button className="text-2xl leading-none text-muted" aria-label={t('close')} onClick={onClose}>
              ×
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showGame} onChange={(e) => setShowGame(e.target.checked)} /> {t('history.game')}
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showSheet} onChange={(e) => setShowSheet(e.target.checked)} /> {t('history.sheet')}
            </label>
            <select className="rounded border border-border bg-card px-1" value={type} onChange={(e) => setType(e.target.value)} aria-label={t('history.type')}>
              <option value="">{t('history.allTypes')}</option>
              {types.map((x) => (
                <option key={x} value={x}>
                  {t(`history.groups.${x}`, { defaultValue: x })}
                </option>
              ))}
            </select>
          </div>
          <input
            className="mt-2 w-full rounded border border-border bg-card px-2 py-1 text-sm"
            placeholder={t('history.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="rounded border border-border px-2 py-1 text-sm hover:bg-bg"
              onClick={() => void store.addGroup({ kind: 'game', groupType: 'session', items: [{ type: 'session' }] })}
            >
              {t('history.startSession')}
            </button>
            <form
              className="flex flex-1 gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (!note.trim()) return
                void store.addGroup({ kind: 'sheet', groupType: 'note', items: [{ type: 'note', params: { text: note.trim() } }] })
                setNote('')
              }}
            >
              <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('history.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="rounded border border-border px-2 py-1 text-sm hover:bg-bg" type="submit">
                {t('history.addNote')}
              </button>
            </form>
          </div>
        </header>

        <ol className="flex-1 overflow-y-auto p-3">
          {visible.length === 0 && <li className="text-sm text-muted">{t('history.empty')}</li>}
          {blocks(visible).map((b) =>
            'groups' in b ? (
              <li key={b.groups[0].id} className="mb-2 rounded border border-emerald-600/40 bg-emerald-600/5 p-2">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">⚔️ {t('history.attackAction')}</span>
                  <span className="text-xs text-muted">{time.format(b.groups[0].at)}</span>
                </span>
                <ol className="pl-3">{b.groups.map((g) => renderGroup(g, true))}</ol>
              </li>
            ) : (
              renderGroup(b)
            ),
          )}
          {store.hasMore && (
            <li>
              <button className="w-full rounded border border-border py-1 text-sm hover:bg-bg" onClick={store.loadMore}>
                {t('history.loadMore')}
              </button>
            </li>
          )}
        </ol>
      </aside>
    </div>
  )
}
