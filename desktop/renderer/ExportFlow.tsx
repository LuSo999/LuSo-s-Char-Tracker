// Character → sheet: a character file + any sheet → (template from Claude / local analysis /
// saved) → mapping editor → filled PDF.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mappingPrompt, mappingSchema, mappingSystem, mappingToFields, type AiMapping } from '../../src/engine/export/ai'
import { analyzeFields, proposalsToFields } from '../../src/engine/export/analyze'
import { fillSheet } from '../../src/engine/export/fill'
import type { SheetTemplate, TemplateField } from '../../src/engine/export/template'
import { exportCatalogue } from '../../src/engine/export/values'
import { CharacterExport } from '../../src/engine/exchange'
import { loadFont, readSheet, type SheetPdf } from '../../src/ui/export/pdf'
import { TemplateEditor } from '../../src/ui/export/TemplateEditor'
import { luso, type AiContent } from './bridge'
import { AiButton, Busy, FilePick, Section } from './ui'
import { useAi, type KeyStatus } from './useAi'
import { allTemplates, findTemplate, loadSheet, pageImages, type LoadedSheet } from './sheets'

const catalogue = exportCatalogue()
const catalogueKeys = new Set(catalogue.map((f) => f.key))

export function ExportFlow({ keys }: { keys: KeyStatus | undefined }) {
  const { t } = useTranslation()
  const [character, setCharacter] = useState<CharacterExport>()
  const [charError, setCharError] = useState(false)
  const [sheet, setSheet] = useState<{ file: LoadedSheet; pdf: SheetPdf }>()
  const [templates, setTemplates] = useState<SheetTemplate[]>([])
  const [template, setTemplate] = useState<SheetTemplate>()
  const [editing, setEditing] = useState<SheetTemplate>()
  const [message, setMessage] = useState('')
  const ai = useAi(keys)

  const reload = () => void allTemplates().then(setTemplates)
  useEffect(reload, [])

  async function pickCharacter(files: File[]) {
    setCharError(false)
    try {
      const r = CharacterExport.safeParse(JSON.parse(await files[0].text()))
      if (r.success) setCharacter(r.data)
      else setCharError(true)
    } catch {
      setCharError(true)
    }
  }

  async function pickSheet(files: File[]) {
    setMessage('')
    const file = await loadSheet(files)
    const pdf = await readSheet(file.bytes)
    setSheet({ file, pdf })
    setTemplate(findTemplate(await allTemplates(), file, pdf))
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
    // Form fields Claude left out: the local analysis may still know them.
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
    const safe = (s: string) => s.replace(/[^\p{L}\p{N}\- ]+/gu, '').trim()
    const path = await luso().saveFile(`${safe(character.name) || 'character'} – ${safe(template.name) || 'sheet'}.pdf`, bytes, [{ name: 'PDF', extensions: ['pdf'] }])
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
          await luso().saveTemplate(saved, sheet.file.bytes)
          setTemplate(saved)
          setEditing(undefined)
          reload()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('desk.exportIntro')}</p>
      <Section title={t('desk.step1')} hint={t('desk.step1Hint')}>
        <FilePick label={t('desk.pickCharacter')} accept=".json,application/json" onFiles={pickCharacter} />
        {character && <p className="mt-2 font-semibold">✅ {character.name} <span className="text-sm font-normal text-muted">{String(character.values.class ?? '')}</span></p>}
        {charError && <p className="mt-2 text-sm text-danger">{t('desk.badCharacter')}</p>}
      </Section>

      <Section title={t('desk.step2')} hint={t('desk.step2Hint')}>
        <FilePick label={t('desk.pickSheet')} accept="application/pdf,image/*" multiple onFiles={(f) => void pickSheet(f)} />
        {sheet && (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              📄 <b>{sheet.file.name}</b> · {sheet.pdf.pages.length} × {Math.round(sheet.pdf.pages[0][0])}×{Math.round(sheet.pdf.pages[0][1])} pt · {sheet.pdf.widgets.length} form fields
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
      </Section>
      {message && <p className="rounded border border-border bg-card p-2 text-sm">{message}</p>}

      <Section title={t('desk.templates')}>
        {templates.filter((x) => !x.builtIn).length === 0 && <p className="text-sm text-muted">{t('desk.noTemplates')}</p>}
        <ul className="space-y-1 text-sm">
          {templates
            .filter((x) => !x.builtIn)
            .map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <span className="flex-1">{x.name} <span className="text-xs text-muted">· {t('export.fieldCount', { count: x.fields.length })}</span></span>
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => {
                    if (!confirm(t('desk.deleteTemplate', { name: x.name }))) return
                    void luso().deleteTemplate(x.id).then(() => {
                      if (template?.id === x.id) setTemplate(undefined)
                      reload()
                    })
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
