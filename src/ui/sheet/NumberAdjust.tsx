import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Value editor used for HP, money and counts: click the value to type a new
 * one, or type an amount in the small field and press + or − (or type "-3" /
 * "+3" and Enter). With the field empty, + and − change the value by 1. The
 * field empties after use.
 */
export function NumberAdjust({
  value,
  onSet,
  onDelta,
  className = '',
  valueClassName = '',
  label,
}: {
  value: number
  onSet: (v: number) => void
  onDelta: (d: number) => void
  className?: string
  valueClassName?: string
  label: string
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [amount, setAmount] = useState('')

  const applySigned = () => {
    const m = /^\s*([+-])\s*(\d+)\s*$/.exec(amount)
    if (!m) return false
    onDelta(m[1] === '-' ? -Number(m[2]) : Number(m[2]))
    setAmount('')
    return true
  }
  // An empty field means "by one", so + and − work as quick steppers.
  const applyButton = (sign: 1 | -1) => {
    const n = amount.replace(/[+-]/g, '') === '' ? 1 : Number.parseInt(amount.replace(/[+-]/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) return
    onDelta(sign * n)
    setAmount('')
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {editing ? (
        <input
          autoFocus
        onFocus={(e) => e.target.select()}
          inputMode="numeric"
          aria-label={label}
          className="w-20 rounded border border-accent bg-card px-1 text-2xl font-semibold tabular-nums"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
            if (e.key === 'Enter') {
              const n = Number.parseInt(draft, 10)
              if (Number.isFinite(n)) onSet(n)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          className={`rounded px-0.5 tabular-nums hover:bg-bg ${valueClassName}`}
          title={t('adjust.clickToSet')}
          aria-label={`${label}: ${value}`}
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
        >
          {value}
        </button>
      )}
      <div className="flex items-stretch">
        <input
          inputMode="numeric"
          aria-label={t('adjust.amount', { label })}
          placeholder="±"
          className="w-12 rounded-l border border-border bg-card px-1.5 text-center text-sm tabular-nums"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d+-]/g, ''))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (!applySigned() && amount) setAmount('')
          }}
        />
        <div className="flex flex-col">
          <button className="rounded-tr border border-l-0 border-border px-1.5 text-xs leading-4 hover:bg-bg" aria-label={t('adjust.add', { label })} onClick={() => applyButton(1)}>
            +
          </button>
          <button className="rounded-br border border-l-0 border-t-0 border-border px-1.5 text-xs leading-4 hover:bg-bg" aria-label={t('adjust.subtract', { label })} onClick={() => applyButton(-1)}>
            −
          </button>
        </div>
      </div>
    </div>
  )
}
