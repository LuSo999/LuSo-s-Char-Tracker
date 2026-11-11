export function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border bg-card p-3 shadow-sm ${className}`}>
      {title && <h2 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>}
      {children}
    </section>
  )
}

/** Uses shown as dots; filled dots are remaining. Large pools fall back to numbers. */
export function Dots({ remaining, max, label }: { remaining: number; max: number; label?: string }) {
  if (max > 10) {
    return (
      <span className="tabular-nums" aria-label={label}>
        {remaining}/{max}
      </span>
    )
  }
  return (
    <span className="inline-flex gap-1" aria-label={label ?? `${remaining} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full border border-accent ${i < remaining ? 'bg-accent' : 'bg-transparent'}`} />
      ))}
    </span>
  )
}
