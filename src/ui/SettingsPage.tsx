import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ADMIN_UIDS } from '../config'
import { linkSiteLabels, linkSites, type LinkSite } from '../content/links'
import { editions } from '../content/schema'
import { useAuth } from '../state/auth'
import { saveSettings, useSettings } from '../state/settings'
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
