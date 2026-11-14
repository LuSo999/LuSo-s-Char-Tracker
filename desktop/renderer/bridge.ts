// window.luso: what the main process offers (electron/preload.cjs), typed.
import type { Provider } from './providers'

/** Text and images, the same for every provider (the main process converts them). */
export type AiContent = { type: 'text'; text: string } | { type: 'image'; mime: 'image/jpeg' | 'image/png'; data: string }
export type AiRequest = {
  system: string
  content: AiContent[]
  schema: object
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
}
export type AiResult<T> = { ok: true; data: T; usage: { input: number; output: number } } | { ok: false; error: string; usage?: { input: number; output: number } }

type Bridge = {
  keyStatus(): Promise<{ encrypted: boolean } & Record<Provider, { has: boolean; source: 'saved' | 'env' | null }>>
  setKey(provider: Provider, key: string): Promise<boolean>
  clearKey(provider: Provider): Promise<boolean>
  listTemplates(): Promise<unknown[]>
  saveTemplate(template: unknown, pdf?: Uint8Array): Promise<boolean>
  deleteTemplate(id: string): Promise<boolean>
  templatePdf(id: string): Promise<Uint8Array | null>
  saveFile(name: string, data: Uint8Array | string, filters: { name: string; extensions: string[] }[]): Promise<string | null>
  ai<T>(req: AiRequest & { provider: Provider; model: string }): Promise<AiResult<T>>
  cancelAi(): Promise<boolean>
}

declare global {
  interface Window {
    luso: Bridge
  }
}

export const luso = () => window.luso
