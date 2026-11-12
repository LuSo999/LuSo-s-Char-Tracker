import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setOverride } from '../../engine/edits'
import type { Value } from '../../engine/derive'
import { useRun, useSheet } from './context'
import { useEditMode } from './editMode'
import { breakdown } from './format'

/**
 * A computed number that can be overridden in edit mode. An overridden value
 * is marked with ✎ everywhere; in edit mode ↺ returns it to the computed one.
 */
export function Editable({
  value,
  overrideKey,
  label,
  format = String,
  className = '',
}: {
  value: Value
  overrideKey: string
  label: string
  format?: (n: number) => string
  className?: string
}) {
  const { t } = useTranslation()
  const { character } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [draft, setDraft] = useState<string>()

  const commit = (raw: string) => {
    setDraft(undefined)
    const n = Number.parseInt(raw.replace('−', '-'), 10)
    if (Number.isFinite(n)) void run(setOverride(character, overrideKey, n, label, value.computed))
  }

  const title = `${label}\n${breakdown(value)}${value.overridden ? `\n✎ ${t('edit.overriddenHint', { computed: format(value.computed) })}` : ''}`

  if (draft !== undefined) {
    return (
      <input
        autoFocus
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        aria-label={label}
        className="w-16 rounded border border-accent bg-card px-1 text-center tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
          if (e.key === 'Escape') setDraft(undefined)
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  const shown = (
    <span className={`${className} ${value.overridden ? 'text-accent' : ''}`}>
      {format(value.value)}
      {value.overridden && (
        <sup className="ml-0.5 text-[0.6em]" aria-label={t('edit.overridden')}>
          ✎
        </sup>
      )}
    </span>
  )
  if (!edit) return <span title={title}>{shown}</span>
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        className="rounded border border-dashed border-accent/70 px-1 hover:bg-accent/10"
        title={`${title}\n${t('edit.clickToOverride')}`}
        onClick={(e) => {
          e.stopPropagation()
          setDraft(String(value.value))
        }}
      >
        {shown}
      </button>
      {value.overridden && (
        <button
          className="text-xs text-muted hover:text-accent"
          title={t('edit.reset', { computed: format(value.computed) })}
          aria-label={t('edit.reset', { computed: format(value.computed) })}
          onClick={(e) => {
            e.stopPropagation()
            void run(setOverride(character, overrideKey, undefined, label, value.computed))
          }}
        >
          ↺
        </button>
      )}
    </span>
  )
}
