// Sheets in the desktop app: any file (PDF or pictures) becomes a PDF, pages become images for
// Claude, filled form fields are read back, templates are found by fingerprint / page sizes.
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFRadioGroup, PDFTextField } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { analyzeFields } from '../../src/engine/export/analyze'
import { pdfFingerprint, SheetTemplate } from '../../src/engine/export/template'
import { builtInTemplates } from '../../src/ui/export/builtIn'
import type { SheetPdf } from '../../src/ui/export/pdf'
import { luso } from './bridge'

export type LoadedSheet = { name: string; bytes: Uint8Array; fingerprint: string; fromImage: boolean }

const isImage = (f: File) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)

/** A picture as PNG / JPEG bytes pdf-lib can embed (other formats go through a canvas). */
async function imageBytes(file: File): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg' }> {
  if (/png$/i.test(file.type) || /\.png$/i.test(file.name)) return { bytes: new Uint8Array(await file.arrayBuffer()), type: 'png' }
  if (/jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name)) return { bytes: new Uint8Array(await file.arrayBuffer()), type: 'jpg' }
  const bmp = await createImageBitmap(file)
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  const blob = await c.convertToBlob({ type: 'image/png' })
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'png' }
}

/** Files → one PDF: a PDF as it is, pictures as pages (A4 width, aspect kept). */
export async function loadSheet(files: File[]): Promise<LoadedSheet> {
  const first = files[0]
  if (!isImage(first)) {
    const bytes = new Uint8Array(await first.arrayBuffer())
    return { name: first.name.replace(/\.pdf$/i, ''), bytes, fingerprint: await pdfFingerprint(bytes), fromImage: false }
  }
  const doc = await PDFDocument.create()
  for (const f of files.filter(isImage)) {
    const img = await imageBytes(f)
    const embedded = img.type === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes)
    const w = 595
    const h = Math.round((embedded.height / embedded.width) * w)
    doc.addPage([w, h]).drawImage(embedded, { x: 0, y: 0, width: w, height: h })
  }
  const bytes = await doc.save()
  return { name: first.name.replace(/\.[a-z]+$/i, ''), bytes, fingerprint: await pdfFingerprint(bytes), fromImage: true }
}

/** Pages as JPEG images for Claude (long side ≤ maxSide px), with form values drawn in. */
export async function pageImages(doc: pdfjs.PDFDocumentProxy, maxPages = 6, maxSide = 2000) {
  const out: { base64: string; width: number; height: number }[] = []
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS }).promise
    out.push({ base64: canvas.toDataURL('image/jpeg', 0.88).split(',')[1], width: canvas.width, height: canvas.height })
  }
  return out
}

/** What is filled in the PDF's form fields, by field name. */
export async function formValues(bytes: Uint8Array): Promise<Record<string, string | boolean>> {
  const out: Record<string, string | boolean> = {}
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    for (const f of doc.getForm().getFields()) {
      const name = f.getName()
      if (f instanceof PDFTextField) {
        const v = f.getText()
        if (v?.trim()) out[name] = v
      } else if (f instanceof PDFCheckBox) {
        if (f.isChecked()) out[name] = true
      } else if (f instanceof PDFDropdown) {
        const v = f.getSelected()[0]
        if (v) out[name] = v
      } else if (f instanceof PDFRadioGroup) {
        const v = f.getSelected()
        if (v) out[name] = v
      }
    }
  } catch {
    // not readable by pdf-lib: no values
  }
  return out
}

/** All templates: built-in ones and the saved ones. */
export async function allTemplates(): Promise<SheetTemplate[]> {
  const saved = (await luso().listTemplates()).flatMap((t) => {
    const r = SheetTemplate.safeParse(t)
    return r.success ? [r.data] : []
  })
  return [...builtInTemplates, ...saved]
}

/** A template made for this sheet: same file, or (for built-ins) the same pages and form fields. */
export function findTemplate(templates: SheetTemplate[], sheet: LoadedSheet, pdf: SheetPdf): SheetTemplate | undefined {
  const exact = templates.find((t) => t.fingerprint === sheet.fingerprint)
  if (exact) return exact
  const names = new Set(pdf.widgets.map((w) => w.name))
  return templates.find(
    (t) =>
      t.pages.length === pdf.pages.length &&
      t.pages.every(([w, h], i) => Math.abs(w - pdf.pages[i][0]) < 2 && Math.abs(h - pdf.pages[i][1]) < 2) &&
      t.fields.some((f) => f.kind === 'form') &&
      t.fields.every((f) => f.kind !== 'form' || names.has(f.name)),
  )
}

/** Field name → catalogue key for a fillable PDF: from a template, else the local analysis. */
export function formKeys(pdf: SheetPdf, template: SheetTemplate | undefined): Map<string, string> {
  if (template) return new Map(template.fields.flatMap((f) => (f.kind === 'form' ? [[f.name, f.key] as const] : [])))
  return new Map(analyzeFields(pdf.widgets, pdf.words).flatMap((p) => (p.key ? [[p.field.name, p.key] as const] : [])))
}

/** Text printed inside a template's boxes (a sheet filled by this app or digitally), by key. */
export function textInBoxes(template: SheetTemplate | undefined, pdf: SheetPdf): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of template?.fields ?? []) {
    if (f.kind !== 'text') continue
    const inside = pdf.words
      .filter((w) => w.page === f.page && w.x >= f.x - 2 && w.x <= f.x + f.w && w.y >= f.y - 2 && w.y <= f.y + f.h)
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const lines: string[] = []
    let lastY: number | undefined
    for (const w of inside) {
      if (lastY !== undefined && Math.abs(lastY - w.y) < w.h * 0.5) lines[lines.length - 1] += ` ${w.text}`
      else lines.push(w.text)
      lastY = w.y
    }
    const text = lines.join('\n').replace(/ {2,}/g, ' ').trim()
    if (text) out[f.key] = text
  }
  return out
}
