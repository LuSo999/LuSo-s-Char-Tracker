import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ADMIN_UIDS } from '../config'
import { linkSiteLabels, linkSites, type LinkSite } from '../content/links'
import { editions } from '../content/schema'
import { useAuth } from '../state/auth'
import { effectLevels, saveSettings, turnModes, useSettings } from '../state/settings'
import { fx } from './fx/fx'
import { Card } from './Card'

export function SettingsPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const user = useAuth((s) => s.user)

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <Card>
        <h2 className="font-heading text-xl">{t('settings.links')}</h2>
        <p className="mt-1 text-sm text-muted">{t('settings.linksHint')}</p>
        <div className="mt-3 space-y-2">
          {editions.map((ed) => (
            <label key={ed} className="flex items-center justify-between gap-3">
              <span>{ed === '2014' ? '5e (2014)' : '5.5e (2024)'}</span>
              <select
                className="rounded border border-border bg-card px-2 py-1"
                value={settings.linkSite[ed]}
                onChange={(e) => void saveSettings(uid, { linkSite: { ...settings.linkSite, [ed]: e.target.value as LinkSite } })}
              >
                {linkSites.map((s) => (
                  <option key={s} value={s}>
                    {linkSiteLabels[s][ed]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-heading text-xl">🎲 {t('settings.play')}</h2>
        <fieldset className="mt-3">
          <legend className="font-semibold">{t('settings.turnMode')}</legend>
          {turnModes.map((m) => (
            <label key={m} className="mt-1 flex items-start gap-2">
              <input type="radio" name="turnMode" className="mt-1" checked={settings.turnMode === m} onChange={() => void saveSettings(uid, { turnMode: m })} />
              <span>
                <span className="font-medium">{t(`settings.turnModes.${m}`)}</span>
                <span className="block text-sm text-muted">{t(`settings.turnModeHints.${m}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-4">
          <legend className="font-semibold">{t('settings.effects')}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {effectLevels.map((l) => (
              <label key={l} className={`cursor-pointer rounded border px-3 py-1 ${settings.effects === l ? 'border-accent bg-accent text-accent-text' : 'border-border'}`}>
                <input type="radio" name="effects" className="sr-only" checked={settings.effects === l} onChange={() => void saveSettings(uid, { effects: l })} />
                {t(`settings.effectLevels.${l}`)}
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">{t('settings.effectsHint')}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {(['physical', 'magic', 'damage', 'heal', 'temp'] as const).map((k) => (
              <button key={k} className="rounded border border-border px-2 py-0.5 hover:bg-bg" onClick={(e) => fx(k, { x: e.clientX, y: e.clientY })}>
                ▶ {t(`settings.preview.${k}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>
      <Card>
        <h2 className="font-heading text-xl">{t('settings.account')}</h2>
        <p className="mt-2 text-sm">{user?.email}</p>
        <p className="mt-1 text-sm">
          UID: <code className="select-all rounded bg-bg px-1">{uid}</code>
        </p>
        {ADMIN_UIDS.includes(uid) && (
          <Link className="mt-3 inline-block text-accent underline" to="/admin">
            {t('admin.title')}
          </Link>
        )}
      </Card>
    </div>
  )
}
