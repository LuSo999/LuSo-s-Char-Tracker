import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setOverride, setTextOverride } from '../../engine/edits'
import type { Value } from '../../engine/derive'
import { useRun, useSheet } from './context'
import { useEditMode } from './editMode'
import { breakdown } from './format'
import { NumberInput } from '../NumberInput'

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

  const title = `${label}\n${breakdown(value)}${value.overridden ? `\n✎ ${t('edit.overriddenHint', { computed: format(value.computed) })}` : ''}`

  if (draft !== undefined) {
    return (
      <NumberInput
        autoFocus
        ariaLabel={label}
        className="w-16 rounded border border-accent bg-card px-1 text-center tabular-nums"
        value={value.value}
        onChange={(n) => void run(setOverride(character, overrideKey, n, label, value.computed))}
        onDone={() => setDraft(undefined)}
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

/**
 * A computed text (notes separated by "; ") that can be overridden in edit mode,
 * like Editable for numbers: ✎ marks the player's own text, ↺ returns the computed one.
 * An empty text is kept as an override (it hides the computed notes).
 */
export function EditableText({
  value,
  overrideKey,
  label,
  className = '',
}: {
  value: { value: string; computed: string; overridden: boolean }
  overrideKey: string
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const { character } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [draft, setDraft] = useState<string>()
  const computed = value.computed || '—'
  const title = `${label}${value.overridden ? `\n✎ ${t('edit.overriddenHint', { computed })}` : ''}`

  if (draft !== undefined) {
    const commit = () => {
      void run(setTextOverride(character, overrideKey, draft, label, value.computed))
      setDraft(undefined)
    }
    return (
      <input
        autoFocus
        enterKeyHint="done"
        aria-label={label}
        placeholder={t('edit.notesPlaceholder')}
        className="w-full rounded border border-accent bg-card px-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(undefined)
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  const shown = (
    <span className={`${className} ${value.overridden ? 'text-accent' : ''}`}>
      {value.value || '—'}
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
        className="rounded border border-dashed border-accent/70 px-1 text-left hover:bg-accent/10"
        title={`${title}\n${t('edit.clickToOverride')}`}
        onClick={(e) => {
          e.stopPropagation()
          setDraft(value.value)
        }}
      >
        {shown}
      </button>
      {value.overridden && (
        <button
          className="text-xs text-muted hover:text-accent"
          title={t('edit.reset', { computed })}
          aria-label={t('edit.reset', { computed })}
          onClick={(e) => {
            e.stopPropagation()
            void run(setTextOverride(character, overrideKey, undefined, label, value.computed))
          }}
        >
          ↺
        </button>
      )}
    </span>
  )
}
