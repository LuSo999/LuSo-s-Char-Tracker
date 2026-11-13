// The signed-in user's homebrew packs (users/{uid}/packs/{packId}), live.
// Each document holds the pack as a JSON string, so any valid pack is stored
// as is (Firestore can't store undefined values or very deep objects well).
import { stampChanges } from '../engine/homebrew'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { create } from 'zustand'
import { Pack } from '../content/schema'
import { db } from '../firebase'

type State = { uid?: string; packs: Pack[]; status: 'idle' | 'loading' | 'ready'; broken: string[] }

export const useHomebrew = create<State>(() => ({ packs: [], status: 'idle', broken: [] }))

let unsubscribe: (() => void) | undefined

const packsCol = (uid: string) => {
  if (!db) throw new Error('Firebase is not configured')
  return collection(db, 'users', uid, 'packs')
}

export function watchHomebrew(uid: string | undefined) {
  unsubscribe?.()
  unsubscribe = undefined
  if (!uid || !db) return useHomebrew.setState({ uid: undefined, packs: [], status: 'ready', broken: [] })
  useHomebrew.setState({ uid, status: 'loading' })
  unsubscribe = onSnapshot(
    packsCol(uid),
    (snap) => {
      const packs: Pack[] = []
      const broken: string[] = []
      for (const d of snap.docs) {
        try {
          const r = Pack.safeParse(JSON.parse(String(d.data().json)))
          if (r.success) packs.push(r.data)
          else broken.push(d.id)
        } catch {
          broken.push(d.id)
        }
      }
      useHomebrew.setState({ packs: packs.sort((a, b) => a.name.localeCompare(b.name)), broken, status: 'ready' })
    },
    () => useHomebrew.setState({ status: 'ready' }),
  )
}

/** Dev preview: keep packs in memory instead of Firestore. */
let memory = false
export function enableMemoryHomebrew() {
  memory = true
  useHomebrew.setState({ uid: 'dev', status: 'ready' })
}

export async function savePack(uid: string, pack: Pack) {
  const previous = useHomebrew.getState().packs.find((p) => p.id === pack.id)
  const clean = Pack.parse(JSON.parse(JSON.stringify(stampChanges(pack, previous))))
  if (memory) {
    const others = useHomebrew.getState().packs.filter((p) => p.id !== clean.id)
    return void useHomebrew.setState({ packs: [...others, clean].sort((a, b) => a.name.localeCompare(b.name)) })
  }
  await setDoc(doc(packsCol(uid), clean.id), { json: JSON.stringify(clean), name: clean.name, edition: clean.edition, updatedAt: serverTimestamp() })
}

export async function deletePack(uid: string, packId: string) {
  if (memory) return void useHomebrew.setState({ packs: useHomebrew.getState().packs.filter((p) => p.id !== packId) })
  await deleteDoc(doc(packsCol(uid), packId))
}
