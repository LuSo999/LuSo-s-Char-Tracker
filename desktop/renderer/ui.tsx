// Small building blocks of the desktop app's pages.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { useClaude } from './useClaude'

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

export function Busy({ claude, label }: { claude: ReturnType<typeof useClaude>; label: string }) {
  const { t } = useTranslation()
  if (claude.error) return <p className="text-sm text-danger">{claude.error}</p>
  if (!claude.busy) return null
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {label} {t('desk.elapsed', { s: claude.seconds })}
      <button className="rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={claude.cancel}>
        {t('desk.cancel')}
      </button>
    </p>
  )
}
