import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { Entity, RechargeOn } from '../../content/schema'
import type { Character } from '../../engine/character'
import type { ActiveEntity, Sheet } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { Dots, Panel } from './common'

const rechargeLabel: Record<RechargeOn, string> = {
  shortRest: 'Short',
  longRest: 'Long',
  dawn: 'Dawn',
  turnStart: 'Turn start',
}

export function ResourcesPanel({ sheet, content }: { sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  return (
    <Panel title={t('sheet.resources')}>
      {sheet.resources.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
      <ul className="space-y-1">
        {sheet.resources.map((r) => {
          const recharge = r.resource.recharge
            .map((x) => `${rechargeLabel[x.on]}${x.amount === 'all' ? '' : ` (+${typeof x.amount === 'number' ? x.amount : '…'})`}`)
            .join(' / ')
          return (
            <li key={r.key} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <RuleRef entity={r.source.entity} content={content} className="text-sm font-semibold">
                  {r.resource.name}
                  {r.die ? <span className="ml-1 font-normal text-muted">d{r.die}</span> : null}
                </RuleRef>
                {recharge && <span className="ml-1.5 text-xs text-muted">↻ {recharge}</span>}
              </span>
              <Dots remaining={r.remaining} max={r.max} />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export function ConditionsPanel({ character, sheet, content }: { character: Character; sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  const exhaustion = content.get('exhaustion')
  return (
    <Panel title={t('sheet.conditions')}>
      {character.conditions.length === 0 && character.exhaustion === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
      <ul className="flex flex-wrap gap-1.5">
        {character.conditions.map((c) => (
          <li key={c}>
            <RuleRef entity={content.get(c)} content={content} className="rounded-full border border-danger px-2 py-0.5 text-sm text-danger">
              {content.get(c)?.name ?? c}
            </RuleRef>
          </li>
        ))}
        {character.exhaustion > 0 && (
          <li>
            <RuleRef entity={exhaustion} content={content} className="rounded-full border border-danger px-2 py-0.5 text-sm text-danger">
              Exhaustion {character.exhaustion}
            </RuleRef>
          </li>
        )}
      </ul>
      {sheet.notes.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-danger">
          {sheet.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

type Group = { key: string; title: string; items: ActiveEntity[] }

function groupFor(ae: ActiveEntity, content: ContentIndex): string {
  switch (ae.entity.type) {
    case 'feature': {
      // Options picked through a choice (maneuvers) belong where their parent feature does.
      const base = ae.entity.optionOf ? content.get(ae.entity.optionOf) : undefined
      const parent = (base?.type === 'feature' ? base.parent : undefined) ?? ae.entity.parent
      if (!ae.classId) return 'background'
      return parent && parent !== ae.classId ? 'subclass' : 'class'
    }
    case 'subclass':
      return 'subclass'
    case 'species':
    case 'subspecies':
    case 'trait':
      return 'species'
    case 'feat':
      return 'feats'
    case 'background':
      return 'background'
    default:
      return 'other'
  }
}

/** Effects that are rules reminders rather than numbers (advantages, damage reduction). */
function reminders(sheet: Sheet) {
  return sheet.active.flatMap((ae) => ae.entity.effects.filter((e) => e.note).map((e) => ({ note: e.note!, entity: ae.entity })))
}

export function FeaturesPanel({ sheet, content }: { sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  // Subspecies are shown through their traits; the "choose a subclass" placeholder feature is skipped.
  const shown = sheet.active.filter(
    (ae) =>
      !ae.hidden &&
      ['feature', 'feat', 'trait'].includes(ae.entity.type) &&
      !(ae.entity.type === 'feature' && ae.entity.id.endsWith('-subclass')),
  )
  const order = ['class', 'subclass', 'species', 'background', 'feats', 'other']
  const groups: Group[] = order
    .map((key) => ({ key, title: t(`sheet.featureGroups.${key}`), items: shown.filter((ae) => groupFor(ae, content) === key) }))
    .filter((g) => g.items.length)
  const notes = reminders(sheet)

  return (
    <Panel title={t('sheet.features')}>
      {groups.map((g) => (
        <div key={g.key} className="mb-2">
          <h3 className="text-xs font-semibold uppercase text-muted">{g.title}</h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {g.items.map((ae) => (
              <li key={ae.grantKey}>
                <FeatureName entity={ae.entity} content={content} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {notes.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <h3 className="text-xs font-semibold uppercase text-muted">{t('sheet.reminders')}</h3>
          <ul className="space-y-0.5 text-sm">
            {notes.map((n, i) => (
              <li key={i}>
                <RuleRef entity={n.entity} content={content}>
                  {n.note}
                </RuleRef>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

function FeatureName({ entity, content }: { entity: Entity; content: ContentIndex }) {
  return (
    <RuleRef entity={entity} content={content}>
      {entity.name.replace(/^Giant Ancestry: /, '')}
      {entity.isNew && <sup className="ml-0.5 text-[9px] font-semibold uppercase text-accent">new</sup>}
      {!entity.verified && <sup className="ml-0.5 text-danger">?</sup>}
    </RuleRef>
  )
}
