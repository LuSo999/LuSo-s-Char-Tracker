import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { CreatePage } from './ui/create/CreatePage'
import { ThemeApplier } from './ui/ThemePicker'
import { HomebrewPage } from './ui/homebrew/HomebrewPage'
import { PackPage } from './ui/homebrew/PackPage'
import { EntityEditor } from './ui/homebrew/EntityEditor'
import { watchHomebrew } from './state/homebrew'
import { ADMIN_UIDS } from './config'
import { isFirebaseConfigured } from './firebase/config'
import { useAuth } from './state/auth'
import { loadOfficial } from './state/official'
import { watchSettings } from './state/settings'
import { AdminPage } from './ui/AdminPage'
import { FeedbackPage } from './ui/feedback/FeedbackPage'
import { Card } from './ui/Card'
import { CharacterList } from './ui/CharacterList'
import { Layout } from './ui/Layout'
import { PinnedPreview, RulePreview } from './ui/rules/RulePreview'
import { SettingsPage } from './ui/SettingsPage'
import { SheetPage } from './ui/sheet/SheetPage'
import { SignIn } from './ui/SignIn'
import { Toasts } from './ui/Toasts'
import { Effects } from './ui/fx/Effects'

// Dev-only sheet preview without sign-in; compiled out of production builds.
const DevPreview = import.meta.env.DEV ? lazy(() => import('./ui/DevPreview')) : null

// Hash router: GitHub Pages has no SPA fallback, so the route lives after '#'.
export default function App() {
  return (
    <HashRouter>
      <ThemeApplier />
      <Layout>
        <Main />
      </Layout>
      <RulePreview />
      <PinnedPreview />
      <Toasts />
      <Effects />
    </HashRouter>
  )
}

function Main() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const uid = user?.uid

  useEffect(() => {
    watchSettings(uid)
    watchHomebrew(uid)
    if (uid) void loadOfficial(true)
  }, [uid])

  if (DevPreview && location.hash.startsWith('#/dev')) {
    return (
      <Suspense>
        <DevPreview />
      </Suspense>
    )
  }
  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <h2 className="font-heading text-xl">{t('notConfigured.title')}</h2>
          <p className="mt-2 text-muted">{t('notConfigured.body')}</p>
        </Card>
      </div>
    )
  }
  if (loading) return <p className="p-4 text-muted">{t('loading')}</p>
  if (!user || !uid) return <SignIn />

  return (
    <Routes>
      <Route path="/" element={<CharacterList uid={uid} />} />
      <Route path="/c/:id" element={<SheetPage uid={uid} />} />
      <Route path="/new" element={<CreatePage uid={uid} />} />
      <Route path="/homebrew" element={<HomebrewPage uid={uid} />} />
      <Route path="/homebrew/:packId" element={<PackPage uid={uid} />} />
      <Route path="/homebrew/:packId/:entityId" element={<EntityEditor uid={uid} />} />
      <Route path="/settings" element={<SettingsPage uid={uid} />} />
      {ADMIN_UIDS.includes(uid) && <Route path="/admin" element={<AdminPage />} />}
      {ADMIN_UIDS.includes(uid) && <Route path="/feedback" element={<FeedbackPage />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
