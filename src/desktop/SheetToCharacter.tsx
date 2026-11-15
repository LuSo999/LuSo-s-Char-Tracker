// Character creation from a filled character sheet (PDF, scan, photos). Filled form fields and
// text in known templates are read right here (web and desktop); anything else (scans, photos,
// handwriting) is read by the AI in the desktop app. The result is matched against the content
// and reviewed in SheetImportDialog before the character is created.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractSchema, extractSystem, extractToImport, type AiExtract } from '../engine/export/ai'
import { importFromValues } from '../engine/export/readBack'
import { SheetImport } from '../engine/exchange'
import { readSheet, type SheetPdf } from '../ui/export/pdf'
import { isDesktop, type AiContent } from './bridge'
import { DesktopHint } from './DesktopHint'
import { allTemplates, findTemplate, formKeys, formValues, loadSheet, pageImages, textInBoxes, type LoadedSheet } from './sheets'
import { AiButton, Busy, FilePick } from './ui'
import { useAi } from './useAi'

/** Local first, the AI fills what the form didn't have (lists merged, single values kept). */
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

export function SheetToCharacter({ onResult }: { onResult: (data: SheetImport) => void }) {
  const { t } = useTranslation()
  const desktopApp = isDesktop()
  const [sheet, setSheet] = useState<{ file: LoadedSheet; pdf: SheetPdf; filled: Record<string, string | boolean> }>()
  const [local, setLocal] = useState<SheetImport>()
  const [error, setError] = useState('')
  const ai = useAi()

  async function pick(files: File[]) {
    setLocal(undefined)
    setError('')
    try {
      const file = await loadSheet(files)
      const pdf = await readSheet(file.bytes)
      const filled = file.fromImage ? {} : await formValues(file.bytes)
      setSheet({ file, pdf, filled })
      const template = findTemplate(allTemplates(), file, pdf)
      const keys = formKeys(pdf, template)
      const values: Record<string, string | boolean> = {
        ...textInBoxes(template, pdf),
        ...Object.fromEntries(Object.entries(filled).flatMap(([name, v]) => (keys.has(name) ? [[keys.get(name)!, v]] : []))),
      }
      if (Object.keys(values).length) setLocal(SheetImport.parse(importFromValues(values, template?.id === 'builtin-dnd-2024-official' ? '2024' : undefined)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function readAi() {
    if (!sheet) return
    const images = await pageImages(sheet.pdf.doc)
    const content: AiContent[] = images.flatMap((img, i): AiContent[] => [
      { type: 'text', text: `Page ${i + 1}:` },
      { type: 'image', mime: 'image/jpeg', data: img.base64 },
    ])
    const filled = Object.entries(sheet.filled)
    content.push({
      type: 'text',
      text: filled.length
        ? `The PDF's filled form fields (raw field names, they may be meaningless) as a reading aid:\n${filled.map(([k, v]) => `${k} = ${v === true ? '[checked]' : String(v).replace(/\n/g, ' / ')}`).join('\n')}\n\nTranscribe the sheet.`
        : 'Transcribe the sheet.',
    })
    const r = await ai.run<AiExtract>({ system: extractSystem, content, schema: extractSchema, maxTokens: 32000, effort: 'high' })
    if (r) onResult(merge(local, SheetImport.parse(extractToImport(r))))
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">{t('desk.fromSheetHint')}</p>
      <FilePick label={t('desk.pickFilled')} accept="application/pdf,image/*" multiple onFiles={(f) => void pick(f)} />
      {error && <p className="text-danger">{error}</p>}
      {sheet && (
        <div className="space-y-2">
          <p>
            📄 <b>{sheet.file.name}</b> · {sheet.pdf.pages.length} p. · {local ? t('desk.readLocal', { count: Object.keys(sheet.filled).length }) : t('desk.readNone')}
          </p>
          <div className="flex flex-wrap gap-2">
            {local && (
              <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text" disabled={ai.busy} onClick={() => onResult(local)}>
                ➡️ {t('desk.useLocal')}
              </button>
            )}
            {desktopApp && <AiButton ai={ai} label={t('desk.read')} onClick={() => void readAi()} />}
          </div>
          <Busy ai={ai} label={t('desk.reading', { ai: ai.label })} />
        </div>
      )}
      <DesktopHint text={t('desk.fromSheetDesktop')} />
    </div>
  )
}
