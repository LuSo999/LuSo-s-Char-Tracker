import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { analyzeFields, proposalsToFields } from '../../engine/export/analyze'
import { pdfFingerprint, type SheetTemplate } from '../../engine/export/template'
import { exportValues } from '../../engine/export/values'
import { makeCharacterExport } from '../../engine/exchange'
import { useAuth } from '../../state/auth'
import { deleteTemplate, saveTemplate, storedPdf, storePdf, useSheetTemplates } from '../../state/sheetTemplates'
import { builtInTemplates } from './builtIn'
import { Dialog } from '../sheet/RestDialog'
import { useSheet } from '../sheet/context'
import { toast } from '../toast'
import { downloadFilled, readSheet } from './pdf'
import { TemplateEditor } from './TemplateEditor'

/**
 * Export the character into a character sheet PDF: pick a template (built-in or your own),
 * give it the PDF once (kept in this browser), download it filled. A new PDF is analysed
 * automatically and opens in the mapping editor.
 */
export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const uid = useAuth((s) => s.user?.uid)
  const own = useSheetTemplates((s) => s.templates)
  const templates = useMemo(() => [...builtInTemplates, ...own], [own])
  const [selectedId, setSelectedId] = useState(templates[0]?.id)
  const selected = templates.find((x) => x.id === selectedId)
  // The selected template's PDF from this browser (kept with its template id).
  const [loaded, setLoaded] = useState<{ id: string; bytes?: Uint8Array }>()
  const pdf = loaded?.id === selectedId ? loaded.bytes : undefined
  const setPdf = (bytes: Uint8Array) => selected && setLoaded({ id: selected.id, bytes })
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<{ template: SheetTemplate; pdf: Uint8Array }>()
  const values = useMemo(() => exportValues(character, sheet, content), [character, sheet, content])

  useEffect(() => {
    let cancelled = false
    if (selected) void storedPdf(selected).then((b) => !cancelled && setLoaded({ id: selected.id, bytes: b }))
    return () => {
      cancelled = true
    }
  }, [selected])

  async function upload(file: File) {
    if (!selected) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    const fp = await pdfFingerprint(bytes)
    const sheetPdf = await readSheet(bytes)
    const sizesMatch = sheetPdf.pages.length === selected.pages.length && sheetPdf.pages.every(([w, h], i) => Math.abs(w - selected.pages[i][0]) < 3 && Math.abs(h - selected.pages[i][1]) < 3)
    if (!sizesMatch && !confirm(t('export.sizeMismatch', { name: selected.name }))) return
    await storePdf(selected, fp, bytes)
    setPdf(bytes)
  }

  async function newFromPdf(file: File) {
    setBusy(t('export.analyzing'))
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const fp = await pdfFingerprint(bytes)
      const s = await readSheet(bytes)
      // A sheet we already have a template for (same pages): offer to use it.
      const same = templates.find((tpl) => tpl.fingerprint === fp || (tpl.pages.length === s.pages.length && tpl.pages.every(([w, h], i) => Math.abs(w - s.pages[i][0]) < 2 && Math.abs(h - s.pages[i][1]) < 2)))
      if (same && confirm(t('export.looksLike', { name: same.name }))) {
        await storePdf(same, fp, bytes)
        setSelectedId(same.id)
        setLoaded({ id: same.id, bytes })
        return
      }
      const proposals = analyzeFields(s.widgets, s.words)
      const template: SheetTemplate = {
        id: `tpl-${Date.now().toString(36)}`,
        name: file.name.replace(/\.pdf$/i, ''),
        pages: s.pages,
        fingerprint: fp,
        fileName: file.name,
        fields: proposalsToFields(proposals),
      }
      await storePdf(template, fp, bytes)
      const found = template.fields.length
      toast(
        s.widgets.length
          ? t('export.analyzed', { found, total: s.widgets.length })
          : s.words.length
            ? t('export.noFields')
            : t('export.noText'),
      )
      setEditing({ template, pdf: bytes })
    } catch (e) {
      toast(t('export.readError', { message: e instanceof Error ? e.message : String(e) }), { tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  async function download() {
    if (!selected || !pdf) return
    setBusy(t('export.filling'))
    try {
      const report = await downloadFilled(pdf, selected, values, `${character.name || 'character'} – ${selected.name}.pdf`)
      if (report.missingFields.length) toast(t('export.missing', { count: report.missingFields.length }), { tone: 'error' })
    } catch (e) {
      toast(t('export.readError', { message: e instanceof Error ? e.message : String(e) }), { tone: 'error' })
    } finally {
      setBusy('')
    }
  }

  if (editing) {
    return (
      <TemplateEditor
        template={editing.template}
        pdf={editing.pdf}
        values={values}
        onCancel={() => setEditing(undefined)}
        onSave={async (tpl) => {
          await saveTemplate(uid, tpl)
          setSelectedId(tpl.id)
          setEditing(undefined)
          toast(t('export.saved', { name: tpl.name }))
        }}
      />
    )
  }

  return (
    <Dialog title={`📄 ${t('export.title')}`} onClose={onClose} wide>
      <p className="text-sm text-muted">{t('export.hint')}</p>
      <ul className="mt-3 space-y-1">
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <label className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm ${tpl.id === selectedId ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg'}`}>
              <input type="radio" name="tpl" checked={tpl.id === selectedId} onChange={() => setSelectedId(tpl.id)} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{tpl.name}</span>
                <span className="ml-2 text-xs text-muted">{tpl.builtIn ? t('export.builtIn') : t('export.yours')} · {t('export.fieldCount', { count: tpl.fields.length })}</span>
              </span>
              {!tpl.builtIn && (
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm(t('export.deleteConfirm', { name: tpl.name }))) void deleteTemplate(uid, tpl.id)
                  }}
                >
                  🗑
                </button>
              )}
            </label>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-3 rounded border border-border p-3 text-sm">
          {pdf ? (
            <p>✅ {t('export.pdfReady')}</p>
          ) : (
            <label className="block">
              <span>{t('export.needPdf', { file: selected.fileName ?? 'PDF' })}</span>
              {selected.pdfUrl && (
                <a href={selected.pdfUrl} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
                  ⬇️ {t('export.getPdf')}
                </a>
              )}
              <input type="file" accept="application/pdf" className="mt-1 block text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text disabled:opacity-40" disabled={!pdf || !!busy} onClick={() => void download()}>
              ⬇️ {t('export.download')}
            </button>
            <button className="rounded border border-border px-3 py-1.5 hover:bg-bg disabled:opacity-40" disabled={!pdf || !!busy} onClick={() => pdf && setEditing({ template: selected, pdf })}>
              ✏️ {t('export.edit')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <p className="font-semibold">🖥️ {t('export.desktopTitle')}</p>
        <p className="text-xs text-muted">{t('export.desktopHint')}</p>
        <button
          className="mt-1 rounded border border-border px-3 py-1.5 hover:bg-bg"
          onClick={() => {
            const data = makeCharacterExport(character, sheet, content)
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `${character.name.replace(/[^\p{L}\p{N}\- ]+/gu, '').trim() || 'character'}.luso-character.json`
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 5000)
          }}
        >
          ⬇️ {t('export.desktopDownload')}
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <label className="block">
          <span className="font-semibold">➕ {t('export.newFromPdf')}</span>
          <span className="block text-xs text-muted">{t('export.newHint')}</span>
          <input type="file" accept="application/pdf" className="mt-1 block text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1" disabled={!!busy} onChange={(e) => e.target.files?.[0] && void newFromPdf(e.target.files[0])} />
        </label>
      </div>
      {busy && <p className="mt-3 text-sm text-muted">⏳ {busy}</p>}
    </Dialog>
  )
}
