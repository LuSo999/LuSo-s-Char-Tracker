// #/desktop-login?port=…&state=…: opened by the desktop app in the system browser. Signs in with
// Google here (Google doesn't allow it inside apps) and hands the Google tokens back to the app
// through its one-time local address (http://127.0.0.1:port), checked by the state value.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { googleTokensForDesktop } from '../firebase'
import { Card } from '../ui/Card'

export function DesktopLogin() {
  const { t } = useTranslation()
  const params = new URLSearchParams(useLocation().search)
  const port = params.get('port') ?? ''
  const state = params.get('state') ?? ''
  const valid = /^\d{2,5}$/.test(port) && /^[\w-]{16,}$/.test(state)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function go() {
    setError('')
    try {
      const { idToken, accessToken } = await googleTokensForDesktop()
      const q = new URLSearchParams({ state, id_token: idToken, ...(accessToken ? { access_token: accessToken } : {}) })
      setDone(true)
      // Replaces this page (no Back into it); the app answers with a redirect to a page without
      // the tokens, so they don't stay on screen or among visible history entries.
      window.location.replace(`http://127.0.0.1:${port}/callback?${q}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Card>
        <h2 className="font-heading text-xl">🖥️ {t('desk.loginTitle')}</h2>
        {!valid ? (
          <p className="mt-2 text-sm text-danger">{t('desk.loginInvalid')}</p>
        ) : done ? (
          <p className="mt-2 text-sm">✅ {t('desk.loginDone')}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t('desk.loginIntro')}</p>
            <button className="mt-4 rounded bg-accent px-4 py-2 font-medium text-accent-text" onClick={() => void go()}>
              {t('signIn')}
            </button>
          </>
        )}
        {error && <p className="mt-3 text-sm text-danger">{t('signInFailed', { message: error })}</p>}
      </Card>
    </div>
  )
}
