// Sheet → character: a filled sheet (PDF / scan / photos) → filled form fields read locally
// and / or Claude's transcription → a sheet import file for the web app.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractSchema, extractSystem, extractToImport, type AiExtract } from '../../src/engine/export/ai'
import { importFromValues } from '../../src/engine/export/readBack'
import { SheetImport } from '../../src/engine/exchange'
import { readSheet, type SheetPdf } from '../../src/ui/export/pdf'
import { luso, type ClaudeRequest } from './bridge'
import { allTemplates, findTemplate, formKeys, formValues, loadSheet, pageImages, textInBoxes, type LoadedSheet } from './sheets'
import { Busy, FilePick, Section } from './ui'
import { useClaude } from './useClaude'

/** Local first, Claude fills what the form didn't have (lists merged, single values kept). */
function merge(local: SheetImport | undefined, ai: SheetImport): SheetImport {
  if (!local) return ai
  const list = (a: string[], b: string[]) => [...new Set([...a, ...b])]
  return {
    ...ai,
    ...Object.fromEntries(Object.entries(local).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length))),
    abilities: { ...ai.abilities, ...local.abilities },
    currency: { ...ai.currency, ...local.currency },
    skills: list(local.skills, ai.skills),
    languages: list(local.languages, ai.languages),
    cantrips: list(local.cantrips, ai.cantrips),
    spells: list(local.spells, ai.spells),
    feats: list(local.feats, ai.feats),
    items: local.items.length ? local.items : ai.items,
    notes: [local.notes, ai.notes].filter(Boolean).join('\n\n'),
  } as SheetImport
}

export function ImportFlow({ hasKey }: { hasKey: boolean }) {
  const { t } = useTranslation()
  const [sheet, setSheet] = useState<{ file: LoadedSheet; pdf: SheetPdf; filled: Record<string, string | boolean> }>()
  const [local, setLocal] = useState<SheetImport>()
  const [result, setResult] = useState<SheetImport>()
  const [showJson, setShowJson] = useState(false)
  const [message, setMessage] = useState('')
  const claude = useClaude()

  async function pick(files: File[]) {
    setResult(undefined)
    setLocal(undefined)
    setMessage('')
    const file = await loadSheet(files)
    const pdf = await readSheet(file.bytes)
    const filled = file.fromImage ? {} : await formValues(file.bytes)
    setSheet({ file, pdf, filled })
    const template = findTemplate(await allTemplates(), file, pdf)
    const keys = formKeys(pdf, template)
    const values: Record<string, string | boolean> = {
      ...textInBoxes(template, pdf),
      ...Object.fromEntries(Object.entries(filled).flatMap(([name, v]) => (keys.has(name) ? [[keys.get(name)!, v]] : []))),
    }
    if (Object.keys(values).length) {
      const imp = SheetImport.parse(importFromValues(values, template?.id === 'builtin-dnd-2024-official' ? '2024' : undefined))
      setLocal(imp)
      setResult(imp)
    }
  }

  async function readClaude() {
    if (!sheet) return
    const images = await pageImages(sheet.pdf.doc)
    const content: ClaudeRequest['content'] = images.flatMap((img, i) => [
      { type: 'text' as const, text: `Page ${i + 1}:` },
      { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: img.base64 } },
    ])
    const filled = Object.entries(sheet.filled)
    content.push({
      type: 'text',
      text: filled.length
        ? `The PDF's filled form fields (raw field names, they may be meaningless) as a reading aid:\n${filled.map(([k, v]) => `${k} = ${v === true ? '[checked]' : String(v).replace(/\n/g, ' / ')}`).join('\n')}\n\nTranscribe the sheet.`
        : 'Transcribe the sheet.',
    })
    const r = await claude.run<AiExtract>({ system: extractSystem, content, schema: extractSchema, maxTokens: 32000, effort: 'high' })
    if (r) setResult(merge(local, SheetImport.parse(extractToImport(r))))
  }

  async function save() {
    if (!result) return
    const name = result.name.replace(/[^\p{L}\p{N}\- ]+/gu, '').trim() || 'character'
    const path = await luso().saveFile(`${name}.luso-import.json`, JSON.stringify(result, null, 2), [{ name: 'JSON', extensions: ['json'] }])
    if (path) setMessage(t('desk.saved', { path }))
  }

  const set = (patch: Partial<SheetImport>) => result && setResult({ ...result, ...patch })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('desk.importIntro')}</p>
      <Section title={t('desk.step2')}>
        <FilePick label={t('desk.pickFilled')} accept="application/pdf,image/*" multiple onFiles={(f) => void pick(f)} />
        {sheet && (
          <div className="mt-2 space-y-2 text-sm">
            <p>📄 <b>{sheet.file.name}</b> · {sheet.pdf.pages.length} p.</p>
            <p>{Object.keys(sheet.filled).length ? t('desk.readLocal', { count: Object.keys(sheet.filled).length }) : t('desk.readNone')}</p>
            <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text disabled:opacity-40" disabled={!hasKey || claude.busy} onClick={() => void readClaude()}>
              {t('desk.readClaude')}
            </button>
            {!hasKey && <p className="text-xs text-muted">{t('desk.needKey')}</p>}
            <Busy claude={claude} label={t('desk.reading')} />
          </div>
        )}
      </Section>

      {result && (
        <Section title={t('desk.result')}>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <span className="w-24 text-muted">{t('desk.name')}</span>
              <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1" value={result.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-muted">{t('desk.edition')}</span>
              <select className="rounded border border-border bg-card px-2 py-1" value={result.edition ?? ''} onChange={(e) => set({ edition: (e.target.value || undefined) as SheetImport['edition'] })}>
                <option value="">— {t('desk.editionUnknown')}</option>
                <option value="2014">2014</option>
                <option value="2024">2024</option>
              </select>
            </label>
            <p><span className="text-muted">{t('desk.classes')}:</span> {result.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ''}`).join(' / ') || '—'}</p>
            <p><span className="text-muted">{t('desk.species')}:</span> {[result.species, result.subspecies].filter(Boolean).join(' – ') || '—'}</p>
            <p><span className="text-muted">{t('desk.background')}:</span> {result.background || '—'}</p>
            <p><span className="text-muted">{t('desk.abilities')}:</span> {Object.entries(result.abilities).map(([a, v]) => `${a.toUpperCase()} ${v}`).join(' · ') || '—'}</p>
            <p className="sm:col-span-2 text-muted">{t('desk.counts', { skills: result.skills.length, spells: result.cantrips.length + result.spells.length, items: result.items.length, languages: result.languages.length })}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text" onClick={() => void save()}>
              {t('desk.saveImport')}
            </button>
            <button className="text-xs text-muted hover:underline" onClick={() => setShowJson(!showJson)}>
              {t('desk.json')}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{t('desk.importHint')}</p>
          {showJson && <pre className="mt-2 max-h-80 overflow-auto rounded bg-bg p-2 text-xs">{JSON.stringify(result, null, 2)}</pre>}
        </Section>
      )}
      {message && <p className="rounded border border-border bg-card p-2 text-sm">{message}</p>}
    </div>
  )
}
