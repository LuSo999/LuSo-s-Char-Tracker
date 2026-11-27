// Small form controls for the homebrew editor. Values are plain JSON.
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveScaled } from '../../engine/formula'
import { Help, HelpButton } from './help/Help'
import type { HelpId } from './help/text.en'
import { input, inputBase } from './ui'


/** A label with optional Ctrl help: Ctrl+hover explains it, ⓘ opens the same help. */
export function Label({ text, help, className = 'font-semibold' }: { text: string; help?: HelpId; className?: string }) {
  if (!help) return <span className={className}>{text}</span>
  return (
    <span className="inline-flex items-center">
      <Help id={help} title={text} className={className}>
        {text}
      </Help>
      <HelpButton id={help} title={text} />
    </span>
  )
}

export function Field({ label, hint, help, children }: { label: string; hint?: string; help?: HelpId; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <Label text={label} help={help} />
      {hint && <span className="ml-1 text-xs text-muted">{hint}</span>}
      <span className="mt-0.5 block">{children}</span>
    </label>
  )
}

export function Text({ value, onChange, placeholder, list }: { value: string | undefined; onChange: (v: string) => void; placeholder?: string; list?: string }) {
  return <input className={input} value={value ?? ''} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} />
}

export function Area({ value, onChange, rows = 3 }: { value: string | undefined; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={input} rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

export function Num({ value, onChange, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <input
      className={input}
      inputMode="decimal"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange(e.target.value === '' || !Number.isFinite(n) ? undefined : n)
      }}
    />
  )
}

/** A number or a formula ("pb", "2 * level", "cha"). */
export function Scaled({ value, onChange, placeholder }: { value: unknown; onChange: (v: number | string | undefined) => void; placeholder?: string }) {
  const shown = typeof value === 'object' && value !== null ? JSON.stringify(value) : value === undefined ? '' : String(value)
  return (
    <input
      className={input}
      value={shown}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value.trim()
        if (v === '') return onChange(undefined)
        if (/^-?\d+(\.\d+)?$/.test(v)) return onChange(Number(v))
        try {
          if (v.startsWith('{')) return onChange(JSON.parse(v))
        } catch {
          /* keep as text until valid */
        }
        onChange(v)
      }}
    />
  )
}

type ScaledValue = number | string | { byLevel: Record<string, number | string>; per?: 'classLevel' | 'characterLevel' }

/** Sample owner numbers for previewing a formula at a few levels. */
const sampleVars = (level: number) => {
  const pb = 2 + Math.floor((level - 1) / 4)
  return { pb, level, classLevel: level, characterLevel: level, str: 3, dex: 3, con: 2, int: 1, wis: 3, cha: 3, strScore: 16, dexScore: 16, conScore: 14, intScore: 12, wisScore: 16, chaScore: 16, walk: 30, slot: Math.min(9, Math.max(1, Math.ceil(level / 2))), spellAttack: pb + 3, spellDc: 8 + pb + 3, attuned: 1, hpMax: level * 8 }
}

/**
 * A value that may scale: a number / formula, or a table by level. Shows what it comes to at
 * levels 1, 5, 11 and 17 (with +3 in the main abilities) so a formula can be checked at a glance.
 */
export function ScaledInput({ value, onChange, placeholder, preview = true }: { value: unknown; onChange: (v: ScaledValue | undefined) => void; placeholder?: string; preview?: boolean }) {
  const { t } = useTranslation()
  const table = typeof value === 'object' && value !== null && 'byLevel' in value ? (value as { byLevel: Record<string, number | string>; per?: 'classLevel' | 'characterLevel' }) : undefined
  const steps = table ? Object.entries(table.byLevel).sort((a, b) => Number(a[0]) - Number(b[0])) : []
  const setSteps = (s: [string, number | string][]) => onChange({ ...table, byLevel: Object.fromEntries(s.filter(([l]) => l !== '')) })
  const shown = (() => {
    if (!preview || value === undefined || value === '' || (typeof value === 'number' && !table)) return undefined
    try {
      return [1, 5, 11, 17].map((l) => `${l}: ${Math.floor(resolveScaled(value as ScaledValue, sampleVars(l)))}`).join(' · ')
    } catch {
      return '⚠'
    }
  })()
  return (
    <span className="block">
      {table ? (
        <span className="block space-y-1">
          {steps.map(([lvl, v], i) => (
            <span key={i} className="flex items-center gap-1 text-xs">
              <span className="text-muted">{t('homebrew.f.level')}</span>
              <input className={`${inputBase} w-14`} inputMode="numeric" value={lvl} onChange={(e) => setSteps(steps.map((s, j) => (j === i ? [e.target.value.replace(/\D/g, ''), s[1]] : s)))} />
              <span>→</span>
              <input className={input} value={String(v)} onChange={(e) => setSteps(steps.map((s, j) => (j === i ? [s[0], /^-?\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value] : s)))} />
              <button type="button" className="text-danger" aria-label={t('homebrew.removeRow')} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                ✕
              </button>
            </span>
          ))}
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className="rounded border border-border px-2 py-0.5 hover:bg-bg" onClick={() => setSteps([...steps, [String(Number(steps.at(-1)?.[0] ?? 0) + 4 || 1), steps.at(-1)?.[1] ?? 1]])}>
              ➕ {t('homebrew.f.level')}
            </button>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={table.per === 'characterLevel'} onChange={(e) => onChange({ ...table, per: e.target.checked ? 'characterLevel' : undefined })} />
              {t('homebrew.scaled.characterLevel')}
            </label>
            <button type="button" className="text-accent underline" onClick={() => onChange(steps[0]?.[1] ?? undefined)}>
              {t('homebrew.scaled.toFormula')}
            </button>
          </span>
        </span>
      ) : (
        <span className="flex gap-1">
          <Scaled value={value} onChange={onChange} placeholder={placeholder} />
          <button
            type="button"
            className="shrink-0 rounded border border-border px-1.5 text-xs hover:bg-bg"
            title={t('homebrew.scaled.toTable')}
            aria-label={t('homebrew.scaled.toTable')}
            onClick={() => onChange({ byLevel: { '1': (value as number | string | undefined) ?? 1 } })}
          >
            📈
          </button>
        </span>
      )}
      {shown && <span className="mt-0.5 block text-[11px] text-muted">{t('homebrew.scaled.preview', { values: shown })}</span>}
    </span>
  )
}

export function Select<T extends string>({ value, onChange, options, empty }: { value: T | undefined; onChange: (v: T | undefined) => void; options: { value: T; label: string }[]; empty?: string }) {
  return (
    <select className={input} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Check({ value, onChange, label, help }: { value: boolean | undefined; onChange: (v: boolean) => void; label: string; help?: HelpId }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <Label text={label} help={help} className="" />
    </label>
  )
}

export type ChipOption = { value: string; label: string; help?: HelpId }

/** Pick several ids from a list (chips); each chip may carry Ctrl help. */
export function Multi({ value, onChange, options }: { value: string[] | undefined; onChange: (v: string[]) => void; options: ChipOption[] }) {
  const v = value ?? []
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = v.includes(o.value)
        const chip = (
          <button
            type="button"
            key={o.value}
            className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => onChange(on ? v.filter((x) => x !== o.value) : [...v, o.value])}
          >
            {o.label}
          </button>
        )
        return o.help ? (
          <Help key={o.value} id={o.help} title={o.label}>
            {chip}
          </Help>
        ) : (
          chip
        )
      })}
    </div>
  )
}

/** Pick one of a few options as buttons; each may carry Ctrl help. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string; help?: HelpId }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const button = (
          <button type="button" key={o.value} className={`rounded border px-2 py-0.5 text-xs ${value === o.value ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        )
        return o.help ? (
          <Help key={o.value} id={o.help} title={o.label}>
            {button}
          </Help>
        ) : (
          button
        )
      })}
    </div>
  )
}

/** A "📍 where it shows" badge. */
export function PlaceBadge({ place }: { place?: string }) {
  const { t } = useTranslation()
  if (!place) return null
  return <span className="shrink-0 rounded-full border border-border px-2 text-[11px] text-muted">📍 {t(`homebrew.place.${place}`)}</span>
}

/**
 * A list of rows (resources, actions, effects…) with add / remove. With `summary` each row is a
 * one-line sentence (and where it shows on the sheet) that opens to its form on click.
 */
export function Rows<T>({
  title,
  hint,
  help,
  rows,
  onChange,
  make,
  render,
  summary,
  place,
  extra,
  initialOpen,
}: {
  title: string
  hint?: string
  help?: HelpId
  rows: T[] | undefined
  onChange: (rows: T[]) => void
  make: () => T
  render: (row: T, set: (row: T) => void) => React.ReactNode
  summary?: (row: T) => string
  place?: (row: T) => string | undefined
  /** More buttons next to "Add" (e.g. a ready-made row). */
  extra?: React.ReactNode
  /** Rows open from the start (a section that appears because a row was just added to it). */
  initialOpen?: number[]
}) {
  const { t } = useTranslation()
  const list = rows ?? []
  const [open, setOpen] = useState<Set<number>>(() => new Set(initialOpen))
  // A row added from outside (the "Add mechanic" menu, a template) opens like one added here.
  const prevLength = useRef(list.length)
  useEffect(() => {
    if (list.length > prevLength.current) setOpen((o) => new Set([...o, list.length - 1]))
    prevLength.current = list.length
  }, [list.length])
  const toggle = (i: number) => setOpen((o) => (o.has(i) ? new Set([...o].filter((x) => x !== i)) : new Set([...o, i])))
  return (
    <section className="rounded border border-border p-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm">
          <Label text={title} help={help} />
        </h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
        <span className="ml-auto flex gap-1">
          {extra}
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-xs hover:bg-bg"
            onClick={() => onChange([...list, make()])}
          >
            ➕ {t('homebrew.addRow')}
          </button>
        </span>
      </div>
      <div className="space-y-1.5">
        {list.map((row, i) => {
          const expanded = !summary || open.has(i)
          const remove = () => {
            onChange(list.filter((_, j) => j !== i))
            setOpen((o) => new Set([...o].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))))
          }
          return (
            <div key={i} className="relative rounded bg-bg/60 p-2 pr-8">
              <button type="button" className="absolute right-1 top-1 text-sm text-danger" aria-label={t('homebrew.removeRow')} onClick={remove}>
                ✕
              </button>
              {summary && (
                <button type="button" className="flex w-full items-start gap-2 text-left text-sm" aria-expanded={expanded} onClick={() => toggle(i)}>
                  <span key={String(expanded)} className="anim-icon text-muted">{expanded ? '▾' : '▸'}</span>
                  <span className="flex-1">{summary(row)}</span>
                  <PlaceBadge place={place?.(row)} />
                </button>
              )}
              {expanded && <div className={summary ? 'mt-2 border-t border-border pt-2' : ''}>{render(row, (r) => onChange(list.map((x, j) => (j === i ? r : x))))}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Several ids picked from a long list (spells, creatures, features): chips with names, and an
 * input with suggestions to add one. Unknown ids stay (another pack may define them later).
 */
export function IdList({ value, onChange, options, placeholder }: { value: string[] | undefined; onChange: (v: string[]) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const v = value ?? []
  const byLabel = new Map(options.map((o) => [o.label.toLowerCase(), o.value]))
  const byValue = new Map(options.map((o) => [o.value, o.label]))
  const listId = `hb-ids-${useId()}`
  const add = (raw: string) => {
    const id = byValue.has(raw) ? raw : (byLabel.get(raw.trim().toLowerCase()) ?? raw.trim())
    if (id && !v.includes(id)) onChange([...v, id])
    setText('')
  }
  return (
    <span className="block">
      <span className="flex flex-wrap gap-1">
        {v.map((id) => (
          <span key={id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${byValue.has(id) ? 'border-border' : 'border-danger text-danger'}`} title={id}>
            {byValue.get(id) ?? id}
            <button type="button" aria-label={t('homebrew.removeRow')} onClick={() => onChange(v.filter((x) => x !== id))}>
              ✕
            </button>
          </span>
        ))}
      </span>
      <input
        className={`${input} mt-1`}
        list={listId}
        value={text}
        placeholder={placeholder ?? t('homebrew.idList.add')}
        onChange={(e) => {
          const val = e.target.value
          // Picking a suggestion fills the whole label at once: add it right away.
          if (byLabel.has(val.toLowerCase()) || byValue.has(val)) add(val)
          else setText(val)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (text.trim()) add(text)
          }
        }}
      />
      <datalist id={listId}>
        {options.slice(0, 2000).map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </span>
  )
}
