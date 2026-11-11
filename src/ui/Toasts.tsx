import { dismiss, useToasts } from './toast'

/** Short notices at the bottom of the screen, e.g. "HP 44 → 41 · Undo". */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-xl items-center gap-3 rounded-card border px-4 py-2 shadow-lg ${t.tone === 'error' ? 'border-danger bg-card text-danger' : 'border-border bg-card'}`}
        >
          <span className="text-sm">{t.text}</span>
          {t.action && (
            <button
              className="rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-text"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="text-muted" aria-label="Close" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
