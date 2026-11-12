export function Panel({ title, icon, children, className = '' }: { title?: string; icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border bg-card p-3 shadow-sm ${className}`}>
      {title && (
        <h2 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
          {icon && (
            <span className="mr-1.5 not-italic" aria-hidden>
              {icon}
            </span>
          )}
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

/**
 * Uses shown as dots; filled dots are remaining. With `onSet` the dots are
 * clickable: a filled dot spends down to it, an empty one restores up to it.
 * Large pools fall back to numbers.
 */
export function Dots({ remaining, max, label, onSet }: { remaining: number; max: number; label?: string; onSet?: (remaining: number) => void }) {
  if (max > 10) {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums" aria-label={label}>
        {onSet && (
          <button className="rounded border border-border px-1 leading-4" aria-label="−1" onClick={() => onSet(remaining - 1)}>
            −
          </button>
        )}
        {remaining}/{max}
        {onSet && (
          <button className="rounded border border-border px-1 leading-4" aria-label="+1" onClick={() => onSet(remaining + 1)}>
            +
          </button>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex gap-1" aria-label={label ?? `${remaining} / ${max}`}>
      {/* Extra uses above the maximum (a slot made by Font of Magic) show as violet dots. */}
      {Array.from({ length: Math.max(max, remaining) }, (_, i) => {
        const cls = `h-3 w-3 rounded-full border ${i >= max ? 'border-violet-500 bg-violet-500' : `border-accent ${i < remaining ? 'bg-accent' : 'bg-transparent'}`}`
        return onSet ? (
          <button key={i} className={`${cls} hover:ring-2 hover:ring-accent/40`} aria-label={`${i + 1}`} onClick={() => onSet(i < remaining ? i : i + 1)} />
        ) : (
          <span key={i} className={cls} />
        )
      })}
    </span>
  )
}
