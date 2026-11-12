import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { signOut } from '../firebase'
import { languages, setLanguage, type Language } from '../i18n'
import { useAuth } from '../state/auth'
import { ShortcutsButton } from './ShortcutsButton'

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const user = useAuth((s) => s.user)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link to="/" className="font-heading text-lg font-semibold">
          {t('appName')}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <ShortcutsButton />
          <label className="flex items-center gap-1 text-sm text-muted">
            <span className="sr-only">{t('language')}</span>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-text"
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          {user && (
            <>
              <Link to="/settings" className="text-sm text-muted hover:underline">
                <span aria-hidden>⚙️ </span>
                {t('settings.title')}
              </Link>
              <span className="hidden text-sm text-muted sm:inline">{user.displayName ?? user.email}</span>
              <button className="rounded border border-border px-3 py-1 text-sm hover:bg-bg" onClick={() => void signOut()}>
                {t('signOut')}
              </button>
            </>
          )}
        </div>
      </header>
      <main className="w-full flex-1">{children}</main>
      <footer className="px-4 py-4 text-center text-xs text-muted">{t('attribution')}</footer>
    </div>
  )
}
