import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { signOut } from '../firebase'
import { languages, setLanguage, type Language } from '../i18n'
import { useAuth } from '../state/auth'
import { saveSettings } from '../state/settings'
import { ShortcutsButton } from './ShortcutsButton'
import { isDesktop } from '../desktop/bridge'
import { ThemeButton } from './ThemePicker'
import { AdminBulb } from './feedback/AdminBulb'
import { FeedbackButton } from './feedback/FeedbackButton'

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const user = useAuth((s) => s.user)
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 sm:sticky sm:top-0 sm:z-40 sm:bg-transparent">
        {/* Frosted glass on its own layer: a backdrop-filter on the header itself would trap the
            header's own fixed dialogs (feedback, theme picker) inside it. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden bg-card/80 backdrop-blur-md sm:block" />
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
          <label data-tour="language" className="flex items-center gap-1 text-sm text-muted">
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
          <span data-tour="theme" className="inline-flex">
            <ThemeButton />
          </span>
          {!user && pathname.startsWith('/dev') && (
            <Link to="/dev/settings" className="hit-target text-sm text-muted hover:text-text" aria-label={t('settings.title')}>
              <span aria-hidden>⚙️</span>
              <span className="hidden sm:inline"> {t('settings.title')}</span>
            </Link>
          )}
          {user && (
            <>
              <Link to="/settings" data-tour="settings" className="hit-target text-sm text-muted hover:text-text" aria-label={t('settings.title')}>
                <span aria-hidden>⚙️</span>
                <span className="hidden sm:inline"> {t('settings.title')}</span>
              </Link>
              <AccountMenu name={user.displayName ?? user.email ?? ''} />
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

/** Hick's law: the things used once in a while (who is signed in, the tour, PDF, signing out)
 *  sit behind one button, so the header shows fewer choices at once. */
function AccountMenu({ name }: { name: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])
  const item = 'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-bg'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div ref={ref} className="relative">
      <button
        className="hit-target flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-text"
        aria-label={t('accountMenu')}
        title={t('accountMenu')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {initial}
      </button>
      {open && (
        <div className="anim-drop absolute right-0 top-full z-40 mt-2 w-60 origin-top-right rounded-[calc(var(--radius)+0.25rem)] border border-border bg-card p-1 shadow-lg" onClick={() => setOpen(false)}>
          <p className="truncate px-3 py-2 text-xs text-muted">{name}</p>
          <Link to="/tour" className={item}>
            <span aria-hidden>❓</span> {t('tour.open')}
          </Link>
          {isDesktop() && (
            <Link to="/pdf" className={item}>
              <span aria-hidden>📄</span> {t('desk.pdfTitle')}
            </Link>
          )}
          <div className="my-1 border-t border-border" />
          <button className={`${item} text-danger`} onClick={() => void signOut()}>
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
