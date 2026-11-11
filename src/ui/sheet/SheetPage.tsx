import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import type { ContentIndex } from '../../content'
import type { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import { useCharacter } from '../../state/characters'
import { useContent } from '../../state/content'
import { useOfficial } from '../../state/official'
import { RuleRef } from '../rules/RuleRef'
import { AbilitiesPanel } from './AbilitiesPanel'
import { ActionList } from './ActionList'
import { EquippedPanel } from './EquippedPanel'
import { ConditionsPanel, FeaturesPanel, ResourcesPanel } from './SidePanels'
import { Vitals } from './Vitals'

export function SheetPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { character, loading, invalid, error } = useCharacter(uid, id)
  const content = useContent(character?.edition)

  if (loading || (character && !content)) return <p className="p-4 text-muted">{t('loading')}</p>
  if (error) return <Message text={t('sheet.loadFailed', { message: error.message })} />
  if (invalid) return <Message text={t('sheet.invalid')} />
  if (!character || !content) return <Message text={t('sheet.notFound')} />
  return <SheetView character={character} content={content} />
}

function Message({ text }: { text: string }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-xl p-4">
      <p className="rounded-card border border-border bg-card p-4">{text}</p>
      <Link className="mt-3 inline-block text-accent underline" to="/">
        {t('sheet.backToList')}
      </Link>
    </div>
  )
}

export function SheetView({ character, content }: { character: Character; content: ContentIndex }) {
  const { t } = useTranslation()
  const official = useOfficial()
  const result = useMemo(() => {
    try {
      return { sheet: computeSheet(character, content) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [character, content])

  if (!result.sheet) {
    const hint = official.status === 'noAccess' ? t('content.noAccess') : official.status === 'empty' ? t('content.empty') : ''
    return <Message text={`${t('sheet.computeFailed', { message: result.error })} ${hint}`} />
  }
  const sheet = result.sheet
  const classes = character.classes.map((c) => ({ entry: c, cls: content.getTyped(c.classId, 'class'), sub: c.subclassId ? content.getTyped(c.subclassId, 'subclass') : undefined }))

  return (
    <div className="mx-auto w-full max-w-[1920px] px-3 py-3">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-card px-4 py-1.5 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-semibold">{character.name}</h1>
          <div className="text-sm text-muted">
            {classes.map(({ entry, cls, sub }, i) => (
              <span key={entry.classId}>
                {i > 0 && ' / '}
                <RuleRef entity={cls} content={content}>
                  {cls?.name ?? entry.classId} {entry.level}
                </RuleRef>
                {sub && (
                  <>
                    {' · '}
                    <RuleRef entity={sub} content={content}>
                      {sub.name}
                    </RuleRef>
                  </>
                )}
              </span>
            ))}
            {' · '}
            <RuleRef entity={content.get(character.speciesId)} content={content}>
              {content.get(character.speciesId)?.name}
            </RuleRef>
            {' · '}
            <RuleRef entity={content.get(character.backgroundId)} content={content}>
              {content.get(character.backgroundId)?.name}
            </RuleRef>
          </div>
        </div>
        <span className="rounded-full border border-accent px-2.5 py-0.5 text-xs font-semibold text-accent" title={t('sheet.editionHint')}>
          {character.edition === '2014' ? '5e (2014)' : '5.5e (2024)'}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {/* Wired up in later milestones; visible now so the layout is final. */}
          {(['shortRest', 'longRest', 'levelUp', 'editMode', 'history'] as const).map((k) => (
            <button key={k} disabled className="rounded border border-border px-3 py-1.5 text-sm opacity-50" title={t('sheet.comingSoon')}>
              {t(`sheet.buttons.${k}`)}
            </button>
          ))}
          <Link to="/" className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg">
            {t('sheet.buttons.switch')}
          </Link>
        </div>
      </div>

      {/* Desktop: three columns. Phone: vitals and actions first, then the rest. */}
      {/* On large screens the columns fill the viewport and scroll inside, so nothing important needs page scrolling. */}
      <div className="grid grid-cols-1 gap-3 xl:h-[calc(100vh-17rem)] xl:min-h-[34rem] xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(260px,340px)]">
        <div className="order-3 xl:order-1 xl:min-h-0 xl:overflow-y-auto">
          <AbilitiesPanel sheet={sheet} content={content} />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-2 xl:min-h-0">
          <Vitals character={character} sheet={sheet} />
          <ActionList sheet={sheet} content={content} />
        </div>
        <div className="order-2 flex flex-col gap-3 xl:order-3 xl:min-h-0 xl:overflow-y-auto">
          <ResourcesPanel sheet={sheet} content={content} />
          <ConditionsPanel character={character} sheet={sheet} content={content} />
          <FeaturesPanel sheet={sheet} content={content} />
        </div>
      </div>
      <div className="mt-3">
        <EquippedPanel character={character} sheet={sheet} content={content} />
      </div>
      <p className="mt-3 text-center text-xs text-muted">{t('rules.ctrlHint')}</p>
    </div>
  )
}
