import { HashRouter, Route, Routes } from 'react-router'
import { useTranslation } from 'react-i18next'
import { isFirebaseConfigured } from './firebase/config'
import { useAuth } from './state/auth'
import { CharacterList } from './ui/CharacterList'
import { Layout } from './ui/Layout'
import { SignIn } from './ui/SignIn'

// Hash router: GitHub Pages has no SPA fallback, so the route lives after '#'.
export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Main />
      </Layout>
    </HashRouter>
  )
}

function Main() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (!isFirebaseConfigured) {
    return (
      <Card>
        <h2 className="font-heading text-xl">{t('notConfigured.title')}</h2>
        <p className="mt-2 text-muted">{t('notConfigured.body')}</p>
      </Card>
    )
  }
  if (loading) return <p className="text-muted">{t('loading')}</p>
  if (!user) return <SignIn />

  return (
    <Routes>
      <Route path="*" element={<CharacterList uid={user.uid} />} />
    </Routes>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-card p-6 shadow-sm">{children}</section>
}
