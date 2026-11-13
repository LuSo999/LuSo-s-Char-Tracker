import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { signOut } from '../firebase'
import { languages, setLanguage, type Language } from '../i18n'
import { useAuth } from '../state/auth'
import { saveSettings } from '../state/settings'
import { ShortcutsButton } from './ShortcutsButton'
import { ThemeButton } from './ThemePicker'
import { AdminBulb } from './feedback/AdminBulb'
import { FeedbackButton } from './feedback/FeedbackButton'

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const user = useAuth((s) => s.user)
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link to="/" className="font-heading text-lg font-semibold">
          {t('appName')}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <AdminBulb />
          <FeedbackButton />
          {/* Phone: the character list sits here (the sheet's own bar is kept short). */}
          {pathname !== '/' && (
            <Link to="/" className="text-sm text-muted hover:underline sm:hidden" title={t('sheet.buttons.switch')} aria-label={t('sheet.buttons.switch')}>
              👥
            </Link>
          )}
          <div className="hidden sm:block">
            <ShortcutsButton />
          </div>
          <label className="flex items-center gap-1 text-sm text-muted">
            <span className="sr-only">{t('language')}</span>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-text"
              value={i18n.language}
              onChange={(e) => {
                const lang = e.target.value as Language
                setLanguage(lang)
                if (user) void saveSettings(user.uid, { language: lang })
              }}
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <ThemeButton />
          {user && (
            <>
              <Link to="/settings" className="text-sm text-muted hover:underline" aria-label={t('settings.title')}>
                <span aria-hidden>⚙️</span>
                <span className="hidden sm:inline"> {t('settings.title')}</span>
              </Link>
              <span className="hidden text-sm text-muted sm:inline">{user.displayName ?? user.email}</span>
              <button className="hidden rounded border border-border px-3 py-1 text-sm hover:bg-bg sm:inline-block" onClick={() => void signOut()}>
                {t('signOut')}
              </button>
            </>
          )}
        </div>
      </header>
      <main className="w-full flex-1">{children}</main>
      <footer className="px-4 py-4 text-center text-xs text-muted">
        {t('attribution')}{' '}
        <a className="underline" href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">
          SRD
        </a>
        {' · '}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
          CC-BY-4.0
        </a>
      </footer>
    </div>
  )
}
