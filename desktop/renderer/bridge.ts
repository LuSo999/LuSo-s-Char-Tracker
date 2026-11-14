// window.luso: what the main process offers (electron/preload.cjs), typed.
import type Anthropic from '@anthropic-ai/sdk'

export type ClaudeRequest = {
  system: string
  content: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
  schema: object
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}
export type ClaudeResult<T> = { ok: true; data: T; usage: { input: number; output: number } } | { ok: false; error: string; usage?: { input: number; output: number } }

type Bridge = {
  keyStatus(): Promise<{ has: boolean; source: 'saved' | 'env' | null; encrypted: boolean }>
  setKey(key: string): Promise<boolean>
  clearKey(): Promise<boolean>
  listTemplates(): Promise<unknown[]>
  saveTemplate(template: unknown, pdf?: Uint8Array): Promise<boolean>
  deleteTemplate(id: string): Promise<boolean>
  templatePdf(id: string): Promise<Uint8Array | null>
  saveFile(name: string, data: Uint8Array | string, filters: { name: string; extensions: string[] }[]): Promise<string | null>
  claude<T>(req: ClaudeRequest): Promise<ClaudeResult<T>>
  cancelClaude(): Promise<boolean>
}

declare global {
  interface Window {
    luso: Bridge
  }
}

export const luso = () => window.luso
