// Per-user app settings, stored with the account (users/{uid}/meta/settings).
import i18n, { setLanguage } from '../i18n'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { create } from 'zustand'
import type { LinkSite } from '../content/links'
import type { Edition } from '../content/schema'
import { db } from '../firebase'

export const turnModes = ['strict', 'track', 'off'] as const
export type TurnMode = (typeof turnModes)[number]

export const effectLevels = ['off', 'subtle', 'standard', 'strong'] as const
export type EffectLevel = (typeof effectLevels)[number]

export type Settings = {
  linkSite: Record<Edition, LinkSite>
  /** Turn economy: block what was already used, only warn, or don't track turns at all. */
  turnMode: TurnMode
  /** Size and visibility of visual effects. */
  effects: EffectLevel
  /** Theme id (src/themes) or "system"; a character may override it. */
  theme: string
  /** Ornate themed frames around the boxes; a character may override it. */
  frames: boolean
  /** Interface language, kept with the account (all devices). */
  language?: 'en' | 'cs'
}

export const defaultSettings: Settings = {
  linkSite: { '2014': 'wikidot', '2024': 'wikidot' },
  turnMode: 'track',
  effects: 'standard',
  theme: 'system',
  frames: false,
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
    if (data?.language && data.language !== i18n.language) setLanguage(data.language)
  })
}

export async function saveSettings(uid: string, patch: Partial<Settings>) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'settings'), patch, { merge: true })
}
