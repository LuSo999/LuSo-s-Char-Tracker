// Small building blocks of the desktop app's pages.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { providerInfo, type Provider } from './providers'
import type { Ai } from './useAi'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}

export function FilePick({ label, accept, multiple, onFiles }: { label: string; accept: string; multiple?: boolean; onFiles: (files: File[]) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-border px-3 py-2 text-sm hover:bg-bg">
      📂 {label}
      <input
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </label>
  )
}

/** "🤖 Analyze" with the AI it uses: the default, or another one with a key picked here. */
export function AiButton({ ai, label, onClick }: { ai: Ai; label: string; onClick: () => void }) {
  const { t } = useTranslation()
  if (!ai.available.length) return <span className="self-center text-xs text-muted">{t('desk.needKey')}</span>
  return (
    <span className="inline-flex overflow-hidden rounded">
      <button className="bg-accent px-3 py-1.5 font-semibold text-accent-text disabled:opacity-40" disabled={ai.busy} onClick={onClick}>
        🤖 {label}
      </button>
      <select
        className="border-l border-accent-text/30 bg-accent px-1 text-sm text-accent-text disabled:opacity-40"
        disabled={ai.busy}
        value={ai.provider}
        title={ai.label}
        aria-label={t('desk.provider')}
        onChange={(e) => ai.pick(e.target.value as Provider)}
      >
        {ai.available.map((p) => (
          <option key={p} value={p}>
            {providerInfo[p].name}
          </option>
        ))}
      </select>
    </span>
  )
}

export function Busy({ ai, label }: { ai: Ai; label: string }) {
  const { t } = useTranslation()
  if (ai.error) return <p className="text-sm text-danger">{ai.error}</p>
  if (!ai.busy) return null
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {label} {t('desk.elapsed', { s: ai.seconds })}
      <button className="rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={ai.cancel}>
        {t('desk.cancel')}
      </button>
    </p>
  )
}
