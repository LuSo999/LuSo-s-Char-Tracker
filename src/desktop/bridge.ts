// The desktop app (desktop/, Electron) shows this web app and adds window.luso: AI requests
// with the keys kept on the computer, saving files and signing in through the system browser.
// In a normal browser window.luso is missing and the desktop-only parts stay hidden.
import type { Provider } from './providers'

/** Text and images, the same for every provider (the desktop app converts them). */
export type AiContent = { type: 'text'; text: string } | { type: 'image'; mime: 'image/jpeg' | 'image/png'; data: string }
export type AiRequest = {
  system: string
  content: AiContent[]
  schema: object
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
}
export type AiResult<T> = { ok: true; data: T; usage: { input: number; output: number } } | { ok: false; error: string; usage?: { input: number; output: number } }
export type KeyStatus = { encrypted: boolean } & Record<Provider, { has: boolean; source: 'saved' | 'env' | null }>

export type Bridge = {
  version: string
  keyStatus(): Promise<KeyStatus>
  setKey(provider: Provider, key: string): Promise<boolean>
  clearKey(provider: Provider): Promise<boolean>
  saveFile(name: string, data: Uint8Array | string, filters: { name: string; extensions: string[] }[]): Promise<string | null>
  ai<T>(req: AiRequest & { provider: Provider; model: string }): Promise<AiResult<T>>
  cancelAi(): Promise<boolean>
  /** Google sign-in in the system browser (Google doesn't allow it inside apps); resolves with its tokens. */
  signIn(): Promise<{ ok: true; idToken: string; accessToken?: string } | { ok: false; error: string }>
  cancelSignIn(): Promise<boolean>
}

declare global {
  interface Window {
    luso?: Bridge
  }
}

/** The desktop app's bridge, or undefined in a normal browser. */
export const desktop = (): Bridge | undefined => (typeof window !== 'undefined' ? window.luso : undefined)
export const isDesktop = () => !!desktop()
/** Only for code that runs in the desktop app (behind isDesktop()). */
export const luso = (): Bridge => {
  const b = desktop()
  if (!b) throw new Error('Not in the desktop app')
  return b
}

export const DESKTOP_URL = 'https://github.com/LuSo999/LuSo-s-Char-Tracker/releases'

/** Save a file: the desktop app asks where, a browser downloads it. */
export async function saveAs(name: string, data: Uint8Array | string, mime: string, extension: string): Promise<string | undefined> {
  const b = desktop()
  if (b) return (await b.saveFile(name, data, [{ name: extension.toUpperCase(), extensions: [extension] }])) ?? undefined
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return name
}
