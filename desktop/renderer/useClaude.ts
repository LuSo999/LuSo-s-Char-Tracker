// A Claude request from a page: waiting state (elapsed seconds), error and cancel.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { luso, type ClaudeRequest } from './bridge'

export function useClaude() {
  const { t } = useTranslation()
  const [started, setStarted] = useState<number>()
  const [now, setNow] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!started) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [started])
  return {
    busy: !!started,
    seconds: started ? Math.max(0, Math.round((now - started) / 1000)) : 0,
    error,
    cancel: () => void luso().cancelClaude(),
    async run<T>(req: ClaudeRequest): Promise<T | undefined> {
      setError('')
      const at = Date.now()
      setStarted(at)
      setNow(at)
      try {
        const r = await luso().claude<T>(req)
        if (r.ok) return r.data
        const known = t(`desk.errors.${r.error}`, { defaultValue: '' })
        setError(t('desk.claudeError', { error: known || r.error }))
      } catch (e) {
        setError(t('desk.claudeError', { error: e instanceof Error ? e.message : String(e) }))
      } finally {
        setStarted(undefined)
      }
      return undefined
    },
  }
}

