// Shared official (non-SRD) content: uploaded by the admin, read by everyone
// allowed. Stored as JSON strings split into parts below Firestore's 1 MB
// document limit, cached in IndexedDB by version so it downloads only once.
import { FirebaseError } from 'firebase/app'
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { create } from 'zustand'
import { Pack, type OfficialContent } from '../content/schema'
import { db } from '../firebase'
import { cacheGet, cacheSet } from './idb'

const PART_SIZE = 800_000
const CACHE_KEY = 'official-content'

type Meta = { version: string; parts: { id: string; pack: string }[]; packs: { id: string; name: string; edition: string; entities: number }[] }

export type OfficialState = {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'noAccess' | 'error'
  packs: Pack[]
  version?: string
  error?: string
}

export const useOfficial = create<OfficialState>(() => ({ status: 'idle', packs: [] }))

const officialDoc = () => doc(db!, 'content', 'official')
const partsCol = () => collection(db!, 'content', 'official', 'packs')
const accessDoc = () => doc(db!, 'content', 'access')

export async function loadOfficial(force = false) {
  if (!db) return
  const current = useOfficial.getState()
  if (!force && (current.status === 'loading' || current.status === 'ready')) return
  useOfficial.setState({ status: 'loading', error: undefined })
  try {
    const metaSnap = await getDoc(officialDoc())
    if (!metaSnap.exists()) {
      useOfficial.setState({ status: 'empty', packs: [], version: undefined })
      return
    }
    const meta = metaSnap.data() as Meta
    const cached = await cacheGet<{ version: string; packs: Pack[] }>(CACHE_KEY)
    if (cached?.version === meta.version) {
      // The cache may come from an older app version: parse it again so new fields get their defaults.
      const packs = cached.packs.map((p) => Pack.safeParse(p)).filter((r) => r.success).map((r) => r.data)
      useOfficial.setState({ status: 'ready', packs, version: meta.version })
      return
    }
    const snap = await getDocs(partsCol())
    const byId = new Map(snap.docs.map((d) => [d.id, d.data().data as string]))
    const json = new Map<string, string>()
    for (const part of meta.parts) json.set(part.pack, (json.get(part.pack) ?? '') + (byId.get(part.id) ?? ''))
    const packs = [...json.values()].map((s) => Pack.parse(JSON.parse(s)))
    await cacheSet(CACHE_KEY, { version: meta.version, packs })
    useOfficial.setState({ status: 'ready', packs, version: meta.version })
  } catch (e) {
    if (e instanceof FirebaseError && e.code === 'permission-denied') {
      useOfficial.setState({ status: 'noAccess', packs: [] })
    } else {
      useOfficial.setState({ status: 'error', packs: [], error: e instanceof Error ? e.message : String(e) })
    }
  }
}

/** Admin: replace all shared official content with the uploaded file. */
export async function uploadOfficial(content: OfficialContent, onProgress?: (done: number, total: number) => void) {
  const parts: { id: string; pack: string; data: string }[] = []
  for (const pack of content.packs) {
    const s = JSON.stringify(pack)
    for (let i = 0, n = 0; i < s.length; i += PART_SIZE, n++) parts.push({ id: `${pack.id}__${n}`, pack: pack.id, data: s.slice(i, i + PART_SIZE) })
  }
  const existing = await getDocs(partsCol())
  const total = parts.length + existing.size
  let done = 0
  // Parts are written one by one: a batch would exceed the 10 MB request limit.
  for (const p of parts) {
    await setDoc(doc(partsCol(), p.id), { pack: p.pack, data: p.data })
    onProgress?.(++done, total)
  }
  for (const d of existing.docs) {
    if (!parts.some((p) => p.id === d.id)) await deleteDoc(d.ref)
    onProgress?.(++done, total)
  }
  const meta: Meta = {
    version: content.version,
    parts: parts.map(({ id, pack }) => ({ id, pack })),
    packs: content.packs.map((p) => ({ id: p.id, name: p.name, edition: p.edition, entities: p.entities.length })),
  }
  // Access settings exist from the first upload on; content starts invite-only.
  const access = await getDoc(accessDoc())
  if (!access.exists()) await setDoc(accessDoc(), { restricted: true, invited: [] })
  await setDoc(officialDoc(), { ...meta, uploadedAt: serverTimestamp() })
  await loadOfficial(true)
}

export async function getOfficialMeta(): Promise<Meta | undefined> {
  const snap = await getDoc(officialDoc())
  return snap.exists() ? (snap.data() as Meta) : undefined
}

export type Access = { restricted: boolean; invited: string[] }

export async function getAccess(): Promise<Access> {
  const snap = await getDoc(accessDoc())
  return snap.exists() ? (snap.data() as Access) : { restricted: true, invited: [] }
}

export async function setAccess(access: Access) {
  await setDoc(accessDoc(), { restricted: access.restricted, invited: access.invited.map((e) => e.trim().toLowerCase()).filter(Boolean) })
}
