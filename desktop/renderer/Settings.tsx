// Settings: the Claude API key (kept by the main process) and the language.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { luso } from './bridge'
import { setLanguage } from './i18n'
import { Section } from './ui'

export type KeyStatus = Awaited<ReturnType<Window['luso']['keyStatus']>>

export function Settings({ status, onChange }: { status: KeyStatus | undefined; onChange: () => void }) {
  const { t, i18n } = useTranslation()
  const [key, setKey] = useState('')
  return (
    <div className="space-y-4">
      <Section title={t('desk.keyTitle')} hint={t('desk.keyHint', { enc: status?.encrypted ? t('desk.keyEncrypted') : t('desk.keyPlain') })}>
        <p className="text-sm">{status?.source === 'saved' ? `✅ ${t('desk.keySaved')}` : status?.source === 'env' ? `✅ ${t('desk.keyEnv')}` : t('desk.keyNone')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="password" className="min-w-64 flex-1 rounded border border-border bg-card px-2 py-1 text-sm" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <button
            className="rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-text disabled:opacity-40"
            disabled={!key.trim()}
            onClick={() => void luso().setKey(key).then(() => (setKey(''), onChange()))}
          >
            {t('desk.keySave')}
          </button>
          {status?.source === 'saved' && (
            <button className="rounded border border-border px-3 py-1 text-sm hover:bg-bg" onClick={() => void luso().clearKey().then(onChange)}>
              {t('desk.keyClear')}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">{t('desk.model')}</p>
        <p className="text-xs text-muted">{t('desk.privacy')}</p>
      </Section>
      <Section title={t('desk.language')}>
        <select className="rounded border border-border bg-card px-2 py-1 text-sm" value={i18n.language} onChange={(e) => setLanguage(e.target.value as 'en' | 'cs')}>
          <option value="cs">Čeština</option>
          <option value="en">English</option>
        </select>
      </Section>
    </div>
  )
}
