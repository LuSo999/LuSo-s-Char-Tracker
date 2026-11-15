import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import { signInWithGoogle, signInWithGoogleTokens } from '../firebase'
import { desktop } from '../desktop/bridge'

export function SignIn() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  async function handleSignIn() {
    setError(null)
    try {
      const app = desktop()
      if (app) {
        // The desktop app: Google sign-in happens in the system browser.
        setWaiting(true)
        const r = await app.signIn()
        if (!r.ok) throw new Error(r.error === 'cancelled' ? t('desk.signInCancelled') : r.error)
        await signInWithGoogleTokens(r.idToken, r.accessToken)
      } else await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWaiting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <p className="text-muted">{t('signInIntro')}</p>
        <button
          className="mt-4 rounded bg-accent px-4 py-2 font-medium text-accent-text hover:opacity-90"
          onClick={() => void handleSignIn()}
        >
          {t('signIn')}
        </button>
        {waiting && (
          <p className="mt-3 text-sm text-muted">
            🌐 {t('desk.signInBrowser')}{' '}
            <button className="underline" onClick={() => void desktop()?.cancelSignIn()}>
              {t('cancel')}
            </button>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{t('signInFailed', { message: error })}</p>}
      </Card>
    </div>
  )
}
