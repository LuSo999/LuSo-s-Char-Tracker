import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import { signInWithGoogle } from '../firebase'

export function SignIn() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
        {error && <p className="mt-3 text-sm text-danger">{t('signInFailed', { message: error })}</p>}
      </Card>
    </div>
  )
}
