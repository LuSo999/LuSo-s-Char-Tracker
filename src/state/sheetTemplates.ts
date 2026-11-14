// Character sheet PDF templates: the user's own (users/{uid}/sheetTemplates/{id}, JSON string)
// plus the built-in ones; the PDF files themselves stay in this browser (IndexedDB).
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { create } from 'zustand'
import { SheetTemplate } from '../engine/export/template'
import { db } from '../firebase'
import { cacheGet, cacheSet } from './idb'

type State = { templates: SheetTemplate[]; status: 'idle' | 'loading' | 'ready' }
export const useSheetTemplates = create<State>(() => ({ templates: [], status: 'idle' }))

let unsubscribe: (() => void) | undefined
let memory = false
const col = (uid: string) => collection(db!, 'users', uid, 'sheetTemplates')

export function watchSheetTemplates(uid: string | undefined) {
  unsubscribe?.()
  unsubscribe = undefined
  if (memory) return
  if (!uid || !db) return useSheetTemplates.setState({ templates: [], status: 'ready' })
  useSheetTemplates.setState({ status: 'loading' })
  unsubscribe = onSnapshot(
    col(uid),
    (snap) => {
      const templates = snap.docs.flatMap((d) => {
        try {
          const r = SheetTemplate.safeParse(JSON.parse(String(d.data().json)))
          return r.success ? [r.data] : []
        } catch {
          return []
        }
      })
      useSheetTemplates.setState({ templates: templates.sort((a, b) => a.name.localeCompare(b.name)), status: 'ready' })
    },
    () => useSheetTemplates.setState({ status: 'ready' }),
  )
}

/** Dev preview: keep templates in memory. */
export function enableMemoryTemplates() {
  memory = true
  useSheetTemplates.setState({ status: 'ready' })
}

export async function saveTemplate(uid: string | undefined, t: SheetTemplate) {
  const clean = SheetTemplate.parse(JSON.parse(JSON.stringify({ ...t, builtIn: undefined })))
  if (memory || !uid || !db) {
    const others = useSheetTemplates.getState().templates.filter((x) => x.id !== clean.id)
    return void useSheetTemplates.setState({ templates: [...others, clean].sort((a, b) => a.name.localeCompare(b.name)) })
  }
  await setDoc(doc(col(uid), clean.id), { json: JSON.stringify(clean), name: clean.name, updatedAt: serverTimestamp() })
}

export async function deleteTemplate(uid: string | undefined, id: string) {
  if (memory || !uid || !db) return void useSheetTemplates.setState({ templates: useSheetTemplates.getState().templates.filter((x) => x.id !== id) })
  await deleteDoc(doc(col(uid), id))
}

/** The PDF of a template, if this browser has it (by fingerprint, else by template id). */
export async function storedPdf(t: SheetTemplate): Promise<Uint8Array | undefined> {
  const fp = t.fingerprint ?? (await cacheGet<string>(`sheetPdf:template:${t.id}`))
  return fp ? cacheGet<Uint8Array>(`sheetPdf:${fp}`) : undefined
}

export async function storePdf(t: SheetTemplate, fingerprint: string, bytes: Uint8Array) {
  await cacheSet(`sheetPdf:${fingerprint}`, bytes)
  await cacheSet(`sheetPdf:template:${t.id}`, fingerprint)
}
