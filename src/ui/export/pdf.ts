// Browser side of the PDF export: reading a sheet (pages, printed words, form fields) with
// pdf.js, drawing a page for the mapping editor, and filling + downloading with pdf-lib.
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import fontUrl from '../../assets/fonts/Roboto-Regular.ttf?url'
import type { Widget, Word } from '../../engine/export/analyze'
import { fillSheet } from '../../engine/export/fill'
import type { SheetTemplate } from '../../engine/export/template'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export type SheetPdf = {
  doc: pdfjs.PDFDocumentProxy
  pages: [number, number][]
  words: Word[]
  widgets: Widget[]
}

/** Read a sheet: page sizes, printed words with positions and its form fields. */
export async function readSheet(bytes: Uint8Array): Promise<SheetPdf> {
  // pdf.js takes ownership of the buffer it gets: give it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const pages: [number, number][] = []
  const words: Word[] = []
  const widgets: Widget[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const [x0, y0, x1, y1] = page.view
    pages.push([x1 - x0, y1 - y0])
    const text = await page.getTextContent()
    for (const item of text.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const [, , , d, e, f] = item.transform as number[]
      words.push({ page: i - 1, x: e - x0, y: f - y0, w: item.width, h: Math.abs(d) || item.height, text: item.str })
    }
    for (const a of await page.getAnnotations()) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue
      const [ax1, ay1, ax2, ay2] = a.rect as number[]
      const type = a.fieldType === 'Btn' && (a.checkBox || a.radioButton) ? 'check' : a.fieldType === 'Tx' ? 'text' : undefined
      if (!type) continue
      widgets.push({ page: i - 1, name: a.fieldName, type, multiline: !!a.multiLine, x: Math.min(ax1, ax2) - x0, y: Math.min(ay1, ay2) - y0, w: Math.abs(ax2 - ax1), h: Math.abs(ay2 - ay1) })
    }
  }
  return { doc, pages, words, widgets }
}

/**
 * Draw one page into a canvas at the given scale. Returns a cancel function: a new render of the
 * same canvas must cancel the running one (pdf.js can't share a canvas between renders).
 */
export function renderPage(doc: pdfjs.PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, scale: number): () => void {
  let task: pdfjs.RenderTask | undefined
  let cancelled = false
  void doc.getPage(index + 1).then((page) => {
    if (cancelled) return
    const viewport = page.getViewport({ scale })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    task = page.render({ canvasContext: canvas.getContext('2d')!, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS })
    task.promise.catch(() => {}) // cancelled
  })
  return () => {
    cancelled = true
    task?.cancel()
  }
}

let font: Promise<Uint8Array> | undefined
export const loadFont = () => (font ??= fetch(fontUrl).then(async (r) => new Uint8Array(await r.arrayBuffer())))

/** Fill the sheet and hand it to the browser as a download. */
export async function downloadFilled(pdf: Uint8Array, template: SheetTemplate, values: Record<string, string | boolean>, fileName: string) {
  const { bytes, report } = await fillSheet(pdf, template, values, await loadFont())
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return report
}
