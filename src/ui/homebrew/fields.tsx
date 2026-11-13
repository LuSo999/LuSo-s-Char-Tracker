// Small form controls for the homebrew editor. Values are plain JSON.
import { useTranslation } from 'react-i18next'

const input = 'w-full rounded border border-border bg-card px-2 py-1 text-sm'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
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

export function Num({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <input
      className={input}
      inputMode="numeric"
      value={value ?? ''}
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
        if (/^-?\d+$/.test(v)) return onChange(Number(v))
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

export function Check({ value, onChange, label }: { value: boolean | undefined; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

/** Pick several ids from a list (chips). */
export function Multi({ value, onChange, options }: { value: string[] | undefined; onChange: (v: string[]) => void; options: { value: string; label: string }[] }) {
  const v = value ?? []
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = v.includes(o.value)
        return (
          <button
            type="button"
            key={o.value}
            className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => onChange(on ? v.filter((x) => x !== o.value) : [...v, o.value])}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A list of rows (resources, activities, effects…) with add / remove. */
export function Rows<T>({ title, hint, rows, onChange, make, render }: { title: string; hint?: string; rows: T[] | undefined; onChange: (rows: T[]) => void; make: () => T; render: (row: T, set: (row: T) => void) => React.ReactNode }) {
  const { t } = useTranslation()
  const list = rows ?? []
  return (
    <section className="rounded border border-border p-2">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
        <button type="button" className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => onChange([...list, make()])}>
          ➕ {t('homebrew.addRow')}
        </button>
      </div>
      <div className="space-y-2">
        {list.map((row, i) => (
          <div key={i} className="relative rounded bg-bg/60 p-2 pr-8">
            <button type="button" className="absolute right-1 top-1 text-sm text-danger" aria-label={t('homebrew.removeRow')} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              ✕
            </button>
            {render(row, (r) => onChange(list.map((x, j) => (j === i ? r : x))))}
          </div>
        ))}
      </div>
    </section>
  )
}

