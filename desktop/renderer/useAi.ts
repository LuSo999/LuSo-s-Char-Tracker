// An AI request from a page: which provider (the default from Settings unless picked at the
// button), waiting state (elapsed seconds), error and cancel.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { luso, type AiRequest } from './bridge'
import { modelOf, providerInfo, providers, useAiPrefs, type Provider } from './providers'

export type KeyStatus = Awaited<ReturnType<Window['luso']['keyStatus']>>

export function useAi(keys: KeyStatus | undefined) {
  const { t } = useTranslation()
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
