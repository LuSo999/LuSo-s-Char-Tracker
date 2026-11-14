import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveSheetImport, type SheetImport } from '../engine/exchange'
import { useContent } from '../state/content'
import { Dialog } from './sheet/RestDialog'

/**
 * A character read off a sheet by the desktop app: names matched to the content you have,
 * shown before it is created (what matched, what didn't and went into the notes).
 */
export function SheetImportDialog({ data, onCreate, onClose }: { data: SheetImport; onCreate: (c: ReturnType<typeof resolveSheetImport>['character']) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation()
  const [edition, setEdition] = useState(data.edition ?? '2024')
  const content = useContent(edition)
  const result = useMemo(() => (content ? resolveSheetImport({ ...data, edition }, content.withBooks(content.books().map((b) => b.id))) : undefined), [content, data, edition])
  const [busy, setBusy] = useState(false)
  return (
    <Dialog title={`📥 ${t('sheetImport.title', { name: data.name || '?' })}`} onClose={onClose} wide>
      {!data.edition && (
        <label className="mb-2 block text-sm">
          {t('sheetImport.edition')}{' '}
          <select className="rounded border border-border bg-card px-2 py-1" value={edition} onChange={(e) => setEdition(e.target.value as '2014' | '2024')}>
            <option value="2024">5.5e (2024)</option>
            <option value="2014">5e (2014)</option>
          </select>
        </label>
      )}
      {!result ? (
        <p className="text-sm text-muted">{t('loading')}</p>
      ) : (
        <>
          <p className="text-sm">{t('sheetImport.summary', { matched: result.report.matched.length, unmatched: result.report.unmatched.length })}</p>
          {result.report.matched.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-semibold">✅ {t('sheetImport.matched')}</summary>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.report.matched.map((m, i) => (
                  <li key={i}>
                    {m.what}: {m.from}
                    {m.from !== m.to && <> → {m.to}</>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.report.unmatched.length > 0 && (
            <div className="mt-2 rounded border border-amber-500/60 bg-amber-500/10 p-2 text-sm">
              ⚠️ {t('sheetImport.unmatched')}
              <ul className="list-disc pl-5 text-xs">
                {result.report.unmatched.map((u, i) => (
                  <li key={i}>
                    {u.what}: {u.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.report.notes.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted">
              {result.report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded border border-border px-3 py-1.5" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onCreate(result.character)
                onClose()
              }}
            >
              ✅ {t('sheetImport.create')}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
