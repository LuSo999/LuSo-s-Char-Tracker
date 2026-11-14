// A character sheet template: where each export value goes on one PDF (form fields by name,
// or text / marks drawn at positions for sheets without fields). Coordinates are PDF points
// with the origin at the bottom left of the page, as in the PDF itself.
import { z } from 'zod'

export const TemplateField = z.discriminatedUnion('kind', [
  /** A fillable form field (text or checkbox) of the PDF, by its field name. */
  z.object({ kind: z.literal('form'), name: z.string(), key: z.string() }),
  /** Text drawn into a box (sheets without form fields). */
  z.object({
    kind: z.literal('text'),
    page: z.number().int().min(0),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    key: z.string(),
    size: z.number().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    multiline: z.boolean().optional(),
  }),
  /** A filled dot for a checked value (proficiency circles on printed sheets). */
  z.object({ kind: z.literal('mark'), page: z.number().int().min(0), x: z.number(), y: z.number(), r: z.number().optional(), key: z.string() }),
])
export type TemplateField = z.infer<typeof TemplateField>

export const SheetTemplate = z.object({
  id: z.string(),
  name: z.string(),
  /** Page sizes [width, height] in points: a quick check that an uploaded PDF fits the template. */
  pages: z.array(z.tuple([z.number(), z.number()])),
  /** Fingerprint of the PDF the template was made for (size + first bytes hash). */
  fingerprint: z.string().optional(),
  /** File name hint shown when the PDF has to be uploaded again. */
  fileName: z.string().optional(),
  /** Where the blank PDF can be downloaded (shown when it has to be uploaded). */
  pdfUrl: z.string().optional(),
  fields: z.array(TemplateField),
  builtIn: z.boolean().optional(),
})
export type SheetTemplate = z.infer<typeof SheetTemplate>

/** A short fingerprint of a PDF file (its size and a hash of the first and last 64 KB). */
export async function pdfFingerprint(bytes: Uint8Array): Promise<string> {
  const part = new Uint8Array([...bytes.subarray(0, 65536), ...bytes.subarray(Math.max(0, bytes.length - 65536))])
  const hash = await crypto.subtle.digest('SHA-256', part)
  return `${bytes.length}:${[...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
