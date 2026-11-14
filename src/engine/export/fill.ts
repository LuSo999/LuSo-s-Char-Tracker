// Fill a character sheet PDF from a template and the export values: form fields get their
// text (sized to fit), printed sheets get text drawn into boxes and dots for checked values.
// A Unicode font is embedded so names with diacritics (č, ř, ž) print correctly.
import fontkit from '@pdf-lib/fontkit'
import { PDFCheckBox, PDFDocument, PDFTextField, rgb, type PDFFont } from 'pdf-lib'
import type { SheetTemplate } from './template'

/** Font size that lets the text fit a box (shrinks down to 5 pt; wraps when multiline). */
export function fitText(font: PDFFont, text: string, w: number, h: number, multiline: boolean, max = 11, lineFactor = 1.15): { size: number; lines: string[] } {
  for (let size = max; size >= 5; size -= 0.5) {
    const lines = multiline ? wrap(font, text, w, size) : [text]
    const lineH = size * lineFactor
    const widest = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)))
    if (widest <= w && lines.length * lineH <= h + 0.5) return { size, lines }
  }
  return { size: 5, lines: multiline ? wrap(font, text, w, 5) : [text] }
}

function wrap(font: PDFFont, text: string, w: number, size: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= w || !line) line = next
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

export type FillReport = { filled: number; missingFields: string[] }

/** The filled PDF (fields stay editable) and what couldn't be placed. */
export async function fillSheet(pdfBytes: Uint8Array, template: SheetTemplate, values: Record<string, string | boolean>, fontBytes: Uint8Array): Promise<{ bytes: Uint8Array; report: FillReport }> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(fontBytes, { subset: true })
  const pages = doc.getPages()
  const form = doc.getForm()
  const report: FillReport = { filled: 0, missingFields: [] }
  const ink = rgb(0.1, 0.1, 0.12)

  for (const f of template.fields) {
    const value = values[f.key]
    if (value === undefined || value === false || value === '') continue
    if (f.kind === 'form') {
      const field = form.getFieldMaybe(f.name)
      if (!field) {
        report.missingFields.push(f.name)
        continue
      }
      if (field instanceof PDFCheckBox) {
        if (value) field.check()
      } else if (field instanceof PDFTextField) {
        const text = String(value)
        const widget = field.acroField.getWidgets()[0]
        const rect = widget?.getRectangle()
        const multiline = field.isMultiline() || text.includes('\n')
        if (multiline && !field.isMultiline()) field.enableMultiline()
        // Our size and line breaks, drawn now with the Unicode font (the field's own "auto" size would
        // blow short text up, and its own wrapping would need more lines than we planned for).
        const fit = rect ? fitText(font, text, rect.width - (multiline ? 10 : 4), rect.height - (multiline ? 8 : 2), multiline, multiline ? 9 : 11, multiline ? font.heightAtSize(1) * 1.2 + 0.05 : 1.15) : { size: 9, lines: [text] }
        const size = fit.size
        field.setText(multiline ? fit.lines.join('\n') : text)
        for (const w of field.acroField.getWidgets()) {
          const da = w.getDefaultAppearance()
          if (da) w.setDefaultAppearance(da.replace(/(\/\S+\s+)[\d.]+(\s+Tf)/, `$1${size}$2`))
        }
        field.setFontSize(size)
        field.updateAppearances(font)
      } else continue
      report.filled++
      continue
    }
    const page = pages[f.page]
    if (!page) continue
    if (f.kind === 'mark') {
      page.drawCircle({ x: f.x, y: f.y, size: f.r ?? 2.6, color: ink })
      report.filled++
      continue
    }
    const text = String(value)
    const multiline = f.multiline ?? text.includes('\n')
    const { size, lines } = fitText(font, text, f.w, f.h, multiline, f.size ?? (multiline ? 8.5 : 11))
    const lineH = size * 1.15
    // Single lines sit in the middle of the box; blocks start at its top.
    let y = multiline ? f.y + f.h - size : f.y + (f.h - size) / 2 + size * 0.22
    for (const line of lines) {
      const width = font.widthOfTextAtSize(line, size)
      const x = f.align === 'center' ? f.x + (f.w - width) / 2 : f.align === 'right' ? f.x + f.w - width : f.x
      page.drawText(line, { x, y, size, font, color: ink })
      y -= lineH
    }
    report.filled++
  }
  return { bytes: await doc.save(), report }
}
