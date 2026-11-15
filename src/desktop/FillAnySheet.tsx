// Desktop app: fill any character sheet (PDF or picture) with a character. Its template comes
// from the account (known sheet), the AI or the local analysis, and is fine-tuned in the
// mapping editor; templates are saved to the account like the web's own.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mappingPrompt, mappingSchema, mappingSystem, mappingToFields, type AiMapping } from '../engine/export/ai'
import { analyzeFields, proposalsToFields } from '../engine/export/analyze'
import { fillSheet } from '../engine/export/fill'
import type { SheetTemplate, TemplateField } from '../engine/export/template'
import { exportCatalogue } from '../engine/export/values'
import { useAuth } from '../state/auth'
import { deleteTemplate, saveTemplate, storePdf, useSheetTemplates } from '../state/sheetTemplates'
import { loadFont, readSheet, type SheetPdf } from '../ui/export/pdf'
import { TemplateEditor } from '../ui/export/TemplateEditor'
import type { AiContent } from './bridge'
import { safeFileName, saveAs } from '../ui/files'
import { findTemplate, loadSheet, pageImages, allTemplates, type LoadedSheet } from './sheets'
import { AiButton, Busy, FilePick, Section } from './ui'
import { useAi } from './useAi'

const catalogue = exportCatalogue()
const catalogueKeys = new Set(catalogue.map((f) => f.key))

export type FillCharacter = { name: string; values: Record<string, string | boolean> }

export function FillAnySheet({ character }: { character: FillCharacter | undefined }) {
  const { t } = useTranslation()
  const uid = useAuth((s) => s.user?.uid)
  const own = useSheetTemplates((s) => s.templates)
  const [sheet, setSheet] = useState<{ file: LoadedSheet; pdf: SheetPdf }>()
  const [template, setTemplate] = useState<SheetTemplate>()
  const [editing, setEditing] = useState<SheetTemplate>()
  const [message, setMessage] = useState('')
  const ai = useAi()

  async function pickSheet(files: File[]) {
    setMessage('')
    try {
      const file = await loadSheet(files)
      const pdf = await readSheet(file.bytes)
      setSheet({ file, pdf })
      setTemplate(findTemplate(allTemplates(), file, pdf))
    } catch (e) {
      // A broken / encrypted PDF or a picture format this system can't open: say so, drop the old sheet.
      setSheet(undefined)
      setTemplate(undefined)
      setMessage(t('desk.sheetError', { message: e instanceof Error ? e.message : String(e) }))
    }
  }

  const newTemplate = (fields: TemplateField[]): SheetTemplate => ({
    id: `tpl-${Date.now().toString(36)}`,
    name: sheet!.file.name,
    pages: sheet!.pdf.pages,
    fingerprint: sheet!.file.fingerprint,
    fileName: sheet!.file.name,
    fields,
  })

  function analyzeLocal() {
    if (!sheet) return
    setEditing(newTemplate(proposalsToFields(analyzeFields(sheet.pdf.widgets, sheet.pdf.words))))
  }

  async function analyzeAi() {
    if (!sheet) return
    const { pdf } = sheet
    const images = await pageImages(pdf.doc)
    const pages = images.map((img, i) => ({ width: pdf.pages[i][0], height: pdf.pages[i][1], image: { width: img.width, height: img.height } }))
    const content: AiContent[] = []
    images.forEach((img, i) => {
      content.push({ type: 'text', text: `Page ${i}:` })
      content.push({ type: 'image', mime: 'image/jpeg', data: img.base64 })
    })
    const widgets = pdf.widgets.filter((w) => w.page < images.length)
    content.push({ type: 'text', text: mappingPrompt({ pages, widgets, words: pdf.words.filter((w) => w.page < images.length), catalogue }) })
    const r = await ai.run<AiMapping>({ system: mappingSystem, content, schema: mappingSchema })
    if (!r) return
    const fields = mappingToFields(r, pages, catalogueKeys, new Set(widgets.map((w) => w.name)))
    // Form fields the AI left out: the local analysis may still know them.
    const named = new Set(fields.flatMap((f) => (f.kind === 'form' ? [f.name] : [])))
    const used = new Set(fields.map((f) => f.key))
    for (const f of proposalsToFields(analyzeFields(pdf.widgets, pdf.words))) {
      if (f.kind === 'form' && !named.has(f.name) && !used.has(f.key)) fields.push(f)
    }
    setMessage([t('desk.aiResult', { name: ai.label, count: fields.length }), r.comment].filter(Boolean).join(' '))
    setEditing(newTemplate(fields))
  }

  async function fillAndSave() {
    if (!sheet || !template || !character) return
    const { bytes, report } = await fillSheet(sheet.file.bytes, template, character.values, await loadFont())
    const path = await saveAs(`${safeFileName(character.name)} – ${safeFileName(template.name, 'sheet')}.pdf`, bytes, 'application/pdf', 'pdf')
    if (path) setMessage([t('desk.saved', { path }), report.missingFields.length ? t('desk.missing', { count: report.missingFields.length }) : ''].filter(Boolean).join(' '))
  }

  if (editing && sheet) {
    return (
      <TemplateEditor
        template={editing}
        pdf={sheet.file.bytes}
        values={character?.values ?? {}}
        onCancel={() => setEditing(undefined)}
        onSave={async (tpl) => {
          const saved = { ...tpl, fingerprint: sheet.file.fingerprint, fileName: sheet.file.name }
          await saveTemplate(uid, saved)
          await storePdf(saved, sheet.file.fingerprint, sheet.file.bytes)
          setTemplate(saved)
          setEditing(undefined)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Section title={t('desk.step2')} hint={t('desk.step2Hint')}>
        <FilePick label={t('desk.pickSheet')} accept="application/pdf,image/*" multiple onFiles={(f) => void pickSheet(f)} />
        {sheet && (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              📄 <b>{sheet.file.name}</b> · {sheet.pdf.pages.length} × {Math.round(sheet.pdf.pages[0][0])}×{Math.round(sheet.pdf.pages[0][1])} pt · {t('desk.formFields', { count: sheet.pdf.widgets.length })}
            </p>
            <p>{template ? `✅ ${t('desk.templateFound', { name: template.name })}` : `➕ ${t('desk.templateNew')}`}</p>
            <div className="flex flex-wrap gap-2">
              {template && (
                <button className="rounded border border-border px-3 py-1.5 hover:bg-bg" onClick={() => setEditing(template)}>
                  {t('desk.edit')}
                </button>
              )}
              <AiButton ai={ai} label={template ? t('desk.reanalyze') : t('desk.analyze')} onClick={() => void analyzeAi()} />
              {!template && (
                <button className="rounded border border-border px-3 py-1.5 hover:bg-bg disabled:opacity-40" disabled={ai.busy} onClick={analyzeLocal}>
                  {t('desk.analyzeLocal')}
                </button>
              )}
            </div>
            {!template && <p className="text-xs text-muted">{t('desk.analyzeLocalHint')}</p>}
            <Busy ai={ai} label={t('desk.analyzing', { ai: ai.label })} />
          </div>
        )}
      </Section>

      <Section title={t('desk.step3')}>
        <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text disabled:opacity-40" disabled={!character || !sheet || !template} onClick={() => void fillAndSave()}>
          {t('desk.fillSave')}
        </button>
        {!character && <p className="mt-1 text-xs text-muted">{t('desk.needCharacter')}</p>}
      </Section>
      {message && <p className="rounded border border-border bg-card p-2 text-sm">{message}</p>}

      <Section title={t('desk.templates')}>
        {own.length === 0 && <p className="text-sm text-muted">{t('desk.noTemplates')}</p>}
        <ul className="space-y-1 text-sm">
          {own.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <span className="flex-1">
                {x.name} <span className="text-xs text-muted">· {t('export.fieldCount', { count: x.fields.length })}</span>
              </span>
              <button
                className="text-xs text-danger hover:underline"
                onClick={() => {
                  if (!confirm(t('desk.deleteTemplate', { name: x.name }))) return
                  if (template?.id === x.id) setTemplate(undefined)
                  void deleteTemplate(uid, x.id)
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
