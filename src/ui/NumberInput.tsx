// A number field that is easy to retype on phones (iOS has no handy select-all): on focus the
// value clears and stays as a grey placeholder; what you type is kept as it is while editing
// and applied (within min / max) on Enter or leaving the field. Leaving it empty keeps the value.
import { useState } from 'react'

export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  className,
  ariaLabel,
  autoFocus,
  onDone,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
  ariaLabel?: string
  autoFocus?: boolean
  /** Called after editing ends (applied or not), e.g. to close an inline editor. */
  onDone?: () => void
}) {
  const [draft, setDraft] = useState<string>()
  const commit = () => {
    if (draft !== undefined && draft !== '' && draft !== '-') {
      const n = Number.parseInt(draft, 10)
      if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    }
    setDraft(undefined)
    onDone?.()
  }
  return (
    <input
      inputMode="numeric"
      enterKeyHint="done"
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      className={className}
      value={draft ?? String(value)}
      placeholder={String(value)}
      onFocus={() => setDraft('')}
      onChange={(e) => setDraft(e.target.value.replace('−', '-').replace(min < 0 ? /[^\d-]/g : /\D/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(undefined)
          onDone?.()
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
