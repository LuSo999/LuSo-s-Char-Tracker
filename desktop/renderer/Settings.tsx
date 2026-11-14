// Settings: API keys of the three AI providers (kept by the main process), the default AI,
// the model of each (best / cheaper) and the language.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { luso } from './bridge'
import { setLanguage } from './i18n'
import { providerInfo, providers, setAiPrefs, useAiPrefs, type Provider, type Tier } from './providers'
import { Section } from './ui'
import type { KeyStatus } from './useAi'

function ProviderKey({ provider, status, onChange }: { provider: Provider; status: KeyStatus | undefined; onChange: () => void }) {
  const { t } = useTranslation()
  const prefs = useAiPrefs()
  const [key, setKey] = useState('')
  const info = providerInfo[provider]
  const s = status?.[provider]
  return (
    <div className="rounded border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 font-semibold">
          <input type="radio" name="defaultAi" checked={prefs.provider === provider} onChange={() => setAiPrefs({ provider })} disabled={!s?.has} />
          {info.name}
        </label>
        <span className="text-xs text-muted">{prefs.provider === provider && s?.has ? `· ${t('desk.default')}` : ''}</span>
        <span className="ml-auto text-sm">{s?.source === 'saved' ? `✅ ${t('desk.keySaved')}` : s?.source === 'env' ? `✅ ${t('desk.keyEnv')}` : t('desk.keyNone')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input type="password" className="min-w-56 flex-1 rounded border border-border bg-card px-2 py-1 text-sm" placeholder={info.keyHint} value={key} onChange={(e) => setKey(e.target.value)} />
        <button
          className="rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-text disabled:opacity-40"
          disabled={!key.trim()}
          onClick={() =>
            void luso()
              .setKey(provider, key)
              .then(() => {
                setKey('')
                // The first key: that AI becomes the default.
                if (!status?.[prefs.provider].has) setAiPrefs({ provider })
                onChange()
              })
          }
        >
          {t('desk.keySave')}
        </button>
        {s?.source === 'saved' && (
          <button className="rounded border border-border px-3 py-1 text-sm hover:bg-bg" onClick={() => void luso().clearKey(provider).then(onChange)}>
            {t('desk.keyClear')}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">{t('desk.model')}:</span>
        {(['best', 'fast'] as Tier[]).map((tier) => (
          <label key={tier} className="flex items-center gap-1">
            <input type="radio" name={`tier-${provider}`} checked={prefs.tiers[provider] === tier} onChange={() => setAiPrefs({ tiers: { ...prefs.tiers, [provider]: tier } })} />
            {info.models[tier].name} <span className="text-xs text-muted">({t(tier === 'best' ? 'desk.tierBest' : 'desk.tierFast')})</span>
          </label>
        ))}
        <a className="ml-auto text-xs text-accent hover:underline" href={info.console} target="_blank" rel="noreferrer">
          {t('desk.getKey')}
        </a>
      </div>
    </div>
  )
}

export function Settings({ status, onChange }: { status: KeyStatus | undefined; onChange: () => void }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="space-y-4">
      <Section title={t('desk.keyTitle')} hint={t('desk.keyHint', { enc: status?.encrypted ? t('desk.keyEncrypted') : t('desk.keyPlain') })}>
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderKey key={p} provider={p} status={status} onChange={onChange} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{t('desk.costs')}</p>
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
