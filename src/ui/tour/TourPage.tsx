// #/tour: the guided tour on a sample character kept in memory (try anything, nothing is saved).
// Closing the tour leaves the sample open to play with; ❓ in the header starts it again.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { sampleChampion } from '../../data/samples'
import { Character } from '../../engine/character'
import type { ContentIndex } from '../../content'
import { useContent } from '../../state/content'
import { useMemoryStore } from '../../state/history'
import { SheetView } from '../sheet/SheetPage'
import { Tour, type TourStep } from './Tour'
import { DESKTOP_URL } from '../../desktop/bridge'
import { markTourSeen } from './seen'

export function TourPage() {
  const content = useContent('2024')
  const character = useMemo(() => Character.parse({ id: 'tour', ...sampleChampion, name: 'Valdric (sample)' }), [])
  const { t } = useTranslation()
  if (!content) return <p className="p-4 text-muted">{t('loading')}</p>
  return <TourSheet character={character} content={content} />
}

function TourSheet({ character, content }: { character: Character; content: ContentIndex }) {
  const { t } = useTranslation()
  const store = useMemoryStore(character)
  const [running, setRunning] = useState(true)
  const p = (key: string) => (t(key) as string).split('\n\n').map((text, i) => <p key={i}>{text}</p>)
  const step = (id: string, spots?: TourStep['spots'], extra?: React.ReactNode): TourStep => ({
    id,
    spots,
    title: t(`tour.steps.${id}.title`),
    body: (
      <>
        {p(`tour.steps.${id}.body`)}
        {extra}
      </>
    ),
  })
  const steps: TourStep[] = [
    step('welcome'),
    step('identity', ['identity']),
    step('vitals', ['vitals']),
    step('abilities', ['abilities']),
    step('actions', ['actions']),
    step('resources', ['resources']),
    step('features', ['features']),
    step('rest', ['rest']),
    step('undo', ['undo']),
    step('levelup', ['levelup', 'more']),
    step('edit', ['edit', 'more']),
    step('spells', ['spells']),
    step('inventory', [['inventory', 'equipped'], 'inventory']),
    step('history', ['history']),
    step(
      'export',
      ['export', 'more'],
      <p>
        🖥️{' '}
        <a className="font-semibold text-accent underline" href={DESKTOP_URL} target="_blank" rel="noreferrer">
          {t('tour.desktopLink')}
        </a>
      </p>,
    ),
    step('look', [['theme', 'language', 'settings']]),
    step('finish'),
  ]
  const close = () => {
    markTourSeen()
    setRunning(false)
  }

  return (
    <>
      <div className="mx-auto mt-3 flex w-full max-w-[1920px] flex-wrap items-center gap-2 px-3 sm:px-11">
        <p className="flex-1 rounded-card border-2 border-dashed border-accent bg-accent/10 px-3 py-1.5 text-sm">🧭 {t('tour.sampleBanner')}</p>
        {!running && (
          <button className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text" onClick={() => setRunning(true)}>
            ▶ {t('tour.again')}
          </button>
        )}
        <Link to="/" className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:bg-bg">
          👥 {t('tour.toCharacters')}
        </Link>
      </div>
      <SheetView character={store.character} content={content} store={store} />
      {running && (
        <Tour
          steps={steps}
          onClose={close}
          finish={
            <div className="flex flex-wrap gap-2">
              <Link to="/new" onClick={() => markTourSeen()} className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-text">
                ➕ {t('create.new')}
              </Link>
              <Link to="/" onClick={() => markTourSeen()} className="rounded border border-border px-3 py-1.5 hover:bg-bg">
                👥 {t('tour.toCharacters')}
              </Link>
            </div>
          }
        />
      )}
    </>
  )
}
