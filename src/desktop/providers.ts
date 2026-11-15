// The AI providers the app can use, their models (best / cheaper) and the user's choices
// (default provider, model tier per provider; kept in this computer's app storage).
import { useSyncExternalStore } from 'react'

export const providers = ['claude', 'openai', 'gemini'] as const
export type Provider = (typeof providers)[number]
export type Tier = 'best' | 'fast'

export const providerInfo: Record<Provider, { name: string; console: string; keyHint: string; models: Record<Tier, { id: string; name: string }> }> = {
  claude: {
    name: 'Claude',
    console: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    models: { best: { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' }, fast: { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' } },
  },
  openai: {
    name: 'ChatGPT',
    console: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    models: { best: { id: 'gpt-6-astra', name: 'GPT-6 Astra' }, fast: { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra' } },
  },
  gemini: {
    name: 'Gemini',
    console: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    models: { best: { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon' }, fast: { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen' } },
  },
}

export type AiPrefs = { provider: Provider; tiers: Record<Provider, Tier> }
const KEY = 'aiPrefs'
const defaults: AiPrefs = { provider: 'claude', tiers: { claude: 'best', openai: 'best', gemini: 'best' } }

let prefs: AiPrefs = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AiPrefs> | null
    return { provider: providers.includes(v?.provider as Provider) ? v!.provider! : defaults.provider, tiers: { ...defaults.tiers, ...v?.tiers } }
  } catch {
    return defaults
  }
})()
const listeners = new Set<() => void>()

export function setAiPrefs(patch: Partial<AiPrefs>) {
  prefs = { ...prefs, ...patch, tiers: { ...prefs.tiers, ...patch.tiers } }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // no storage
  }
  listeners.forEach((l) => l())
}

export const useAiPrefs = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => prefs,
  )

export const modelOf = (p: Provider, tiers = prefs.tiers) => providerInfo[p].models[tiers[p]]
