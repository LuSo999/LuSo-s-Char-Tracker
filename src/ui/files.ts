// Saving files the user asked for: the desktop app shows its "Save as" dialog, a browser
// downloads. One file name rule for everything saved.
import { desktop } from '../desktop/bridge'

/** A name that is safe as a file name on every system (letters, digits, dashes, spaces). */
export const safeFileName = (s: string, fallback = 'character') => s.replace(/[^\p{L}\p{N}\- ]+/gu, '').replace(/\s+/g, ' ').trim() || fallback

/** Save a file; resolves with where it went (undefined when the save dialog was cancelled). */
export async function saveAs(name: string, data: Uint8Array | string, mime: string, extension: string): Promise<string | undefined> {
  const app = desktop()
  if (app) return (await app.saveFile(name, data, [{ name: extension.toUpperCase(), extensions: [extension] }])) ?? undefined
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return name
}
