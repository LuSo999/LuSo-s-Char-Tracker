// The guided tour of character creation: started from ❓ on the creation page (and offered on the
// first visit). It walks through the first step on the page and tells what the next steps do.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { DESKTOP_URL, isDesktop } from '../../desktop/bridge'
import { Tour, type TourStep } from './Tour'

const SEEN = 'createTourSeen'
const seen = () => {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // no storage: offered again next time
  }
}

const useCreateTour = create<{ running: boolean; offered: boolean }>(() => ({ running: false, offered: !seen() }))
const start = () => {
  markSeen()
  useCreateTour.setState({ running: true, offered: false })
}

export function CreateTourButton() {
  const { t } = useTranslation()
  const running = useCreateTour((s) => s.running)
  return (
    <>
      <button className="rounded border border-border px-3 py-1 text-sm hover:bg-bg" onClick={start}>
        ❓ {t('createTour.open')}
      </button>
      {running && <CreateTour onClose={() => useCreateTour.setState({ running: false })} />}
    </>
  )
}

/** First visit: a short offer of the tour. */
export function CreateTourOffer() {
  const { t } = useTranslation()
  const offered = useCreateTour((s) => s.offered)
  if (!offered) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border-2 border-accent bg-accent/10 p-3 text-sm">
      <p className="min-w-0 flex-1">🧭 {t('createTour.offer')}</p>
      <button className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text" onClick={start}>
        {t('createTour.start')}
      </button>
      <button
        className="text-muted hover:underline"
        onClick={() => {
          markSeen()
          useCreateTour.setState({ offered: false })
        }}
      >
        {t('tour.notNow')}
      </button>
    </div>
  )
}

function CreateTour({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [desktopApp] = useState(isDesktop)
  const p = (key: string) => (t(key) as string).split('\n\n').map((text, i) => <p key={i}>{text}</p>)
  const step = (id: string, spots?: TourStep['spots'], extra?: React.ReactNode): TourStep => ({
    id,
    spots,
    title: t(`createTour.steps.${id}.title`),
    body: (
      <>
        {p(`createTour.steps.${id}.body`)}
        {extra}
      </>
    ),
  })
  const steps: TourStep[] = [
    step('welcome'),
    step(
      'fromSheet',
      ['create-from-sheet'],
      !desktopApp && (
        <p>
          🖥️{' '}
          <a className="font-semibold text-accent underline" href={DESKTOP_URL} target="_blank" rel="noreferrer">
            {t('desk.getApp')}
          </a>
        </p>
      ),
    ),
    step('edition', ['create-edition']),
    step('level', ['create-level']),
    step('books', ['create-books']),
    step('origins', ['create-steps']),
    step('rest', ['create-steps']),
    step('finish', ['create-next']),
  ]
  return <Tour steps={steps} onClose={onClose} />
}
