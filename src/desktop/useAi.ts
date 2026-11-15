// An AI request from a page (desktop app): which provider (the default from the AI settings
// unless picked at the button), waiting state (elapsed seconds), error and cancel.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { desktop, luso, type AiRequest, type KeyStatus } from './bridge'
import { modelOf, providerInfo, providers, useAiPrefs, type Provider } from './providers'

/** Which providers have a key (asked from the desktop app; refreshed after a change). */
const useKeys = create<{ keys?: KeyStatus }>(() => ({}))
export function refreshKeys() {
  void desktop()?.keyStatus().then((keys) => useKeys.setState({ keys }))
}
export function useKeyStatus() {
  const keys = useKeys((s) => s.keys)
  useEffect(() => {
    if (!useKeys.getState().keys) refreshKeys()
  }, [])
  return keys
}

export function useAi() {
  const { t } = useTranslation()
  const keys = useKeyStatus()
  const prefs = useAiPrefs()
  const [picked, setPicked] = useState<Provider>()
  const [started, setStarted] = useState<number>()
  const [now, setNow] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!started) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [started])
  const available = providers.filter((p) => keys?.[p].has)
  // The picked one, else the default, else any provider with a key.
  const provider = [picked, prefs.provider].find((p): p is Provider => !!p && available.includes(p)) ?? available[0]
  const model = provider ? modelOf(provider, prefs.tiers) : undefined
  return {
    available,
    provider,
    model,
    label: provider ? `${providerInfo[provider].name} (${model!.name})` : '',
    pick: setPicked,
    busy: !!started,
    seconds: started ? Math.max(0, Math.round((now - started) / 1000)) : 0,
    error,
    cancel: () => void luso().cancelAi(),
    async run<T>(req: AiRequest): Promise<T | undefined> {
      if (!provider || !model) return undefined
      setError('')
      const at = Date.now()
      setStarted(at)
      setNow(at)
      try {
        const r = await luso().ai<T>({ ...req, provider, model: model.id })
        if (r.ok) return r.data
        const known = t(`desk.errors.${r.error}`, { defaultValue: '' })
        setError(t('desk.aiError', { name: providerInfo[provider].name, error: known || r.error }))
      } catch (e) {
        setError(t('desk.aiError', { name: providerInfo[provider].name, error: e instanceof Error ? e.message : String(e) }))
      } finally {
        setStarted(undefined)
      }
      return undefined
    },
  }
}
export type Ai = ReturnType<typeof useAi>
