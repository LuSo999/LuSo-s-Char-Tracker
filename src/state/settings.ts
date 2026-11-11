// Per-user app settings, stored with the account (users/{uid}/meta/settings).
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { create } from 'zustand'
import type { LinkSite } from '../content/links'
import type { Edition } from '../content/schema'
import { db } from '../firebase'

export type Settings = {
  linkSite: Record<Edition, LinkSite>
}

export const defaultSettings: Settings = {
  linkSite: { '2014': 'wikidot', '2024': 'wikidot' },
}

export const useSettings = create<Settings>(() => defaultSettings)

let unsubscribe: (() => void) | undefined

export function watchSettings(uid: string | undefined) {
  unsubscribe?.()
  unsubscribe = undefined
  useSettings.setState(defaultSettings, true)
  if (!uid || !db) return
  unsubscribe = onSnapshot(doc(db, 'users', uid, 'meta', 'settings'), (snap) => {
    const data = snap.data() as Partial<Settings> | undefined
    useSettings.setState({ ...defaultSettings, ...data, linkSite: { ...defaultSettings.linkSite, ...data?.linkSite } }, true)
  })
}

export async function saveSettings(uid: string, patch: Partial<Settings>) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'settings'), patch, { merge: true })
}
