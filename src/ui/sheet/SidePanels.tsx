import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { Entity, RechargeOn } from '../../content/schema'
import { setExhaustion, setResourceRemaining, toggleCondition, toggleEffect } from '../../engine/actions'
import type { ActiveEntity, Sheet } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { Dots, Panel } from './common'
import { addReminder, removeReminder } from '../../engine/edits'
import { endConcentration } from '../../engine/spellActions'
import { removeExtra } from '../../engine/extras'
import { AddFeatureDialog } from './AddFeatureDialog'
import { useRun, useSheet } from './context'
import { Editable } from './Editable'
import { useEditMode } from './editMode'

const rechargeLabel: Record<RechargeOn, string> = {
  shortRest: 'Short',
  longRest: 'Long',
  dawn: 'Dawn',
  turnStart: 'Turn start',
}

export function ResourcesPanel() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  return (
    <Panel title={t('sheet.resources')} icon="🔋">
      {sheet.resources.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
      <ul className="space-y-1">
        {sheet.resources.map((r) => {
          const recharge = r.resource.recharge
            .map((x) => `${rechargeLabel[x.on]}${x.amount === 'all' ? '' : ` (+${typeof x.amount === 'number' ? x.amount : '…'})`}`)
            .join(' / ')
          return (
            <li key={r.key} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <RuleRef entity={r.source.entity} content={content} className="text-sm font-semibold" editable>
                  {r.resource.name}
                  {r.die ? <span className="ml-1 font-normal text-muted">d{r.die}</span> : null}
                </RuleRef>
                {recharge && <span className="ml-1.5 text-xs text-muted">↻ {recharge}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Dots remaining={r.remaining} max={r.max} onSet={(n) => void run(setResourceRemaining(character, sheet, r.key, n))} />
                {(edit || r.maxOverridden) && (
                  <span className="text-xs text-muted">
                    max{' '}
                    <Editable
                      value={{ value: r.max, computed: r.maxComputed, overridden: r.maxOverridden, parts: [] }}
                      overrideKey={`resource:${r.key}:max`}
                      label={`${r.resource.name}: max`}
                    />
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export function ConditionsPanel() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [adding, setAdding] = useState(false)
  const exhaustion = content.get('exhaustion')
  const options = content.all('condition').filter((c) => c.id !== 'exhaustion' && !character.conditions.includes(c.id))

  return (
    <Panel title={t('sheet.conditions')} icon="🩹">
      <ul className="flex flex-wrap items-center gap-1.5">
        {character.conditions.map((c) => {
          const name = content.get(c)?.name ?? c
          return (
            <li key={c} className="flex items-center rounded-full border border-danger text-sm text-danger">
              <RuleRef entity={content.get(c)} content={content} className="pl-2">
                {name}
              </RuleRef>
              <button className="px-1.5" aria-label={t('sheet.removeCondition', { name })} onClick={() => void run(toggleCondition(character, c, name))}>
                ×
              </button>
            </li>
          )
        })}
        {character.concentration && (
          <li className="flex items-center rounded-full border border-violet-500 text-sm text-violet-700 dark:text-violet-300">
            <RuleRef entity={content.get(character.concentration.spellId)} content={content} className="pl-2">
              🔮 {character.concentration.name}
            </RuleRef>
            <button className="px-1.5" aria-label={t('spells.endConcentration')} title={t('spells.endConcentration')} onClick={() => void run(endConcentration(character))}>
              ×
            </button>
          </li>
        )}
        <li className="flex items-center gap-1 text-sm">
          <RuleRef entity={exhaustion} content={content} className={character.exhaustion ? 'font-semibold text-danger' : 'text-muted'}>
            Exhaustion {character.exhaustion}
          </RuleRef>
          <button className="rounded border border-border px-1.5 leading-5" aria-label="Exhaustion −1" onClick={() => void run(setExhaustion(character, character.exhaustion - 1))}>
            −
          </button>
          <button className="rounded border border-border px-1.5 leading-5" aria-label="Exhaustion +1" onClick={() => void run(setExhaustion(character, character.exhaustion + 1))}>
            +
          </button>
        </li>
        <li>
          {adding ? (
            <select
              autoFocus
              className="rounded border border-border bg-card px-1 text-sm"
              value=""
              onBlur={() => setAdding(false)}
              onChange={(e) => {
                const c = content.get(e.target.value)
                setAdding(false)
                if (c) void run(toggleCondition(character, c.id, c.name))
              }}
            >
              <option value="">{t('sheet.chooseCondition')}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <button className="rounded-full border border-dashed border-border px-2 text-sm text-muted hover:bg-bg" onClick={() => setAdding(true)}>
              + {t('sheet.addCondition')}
            </button>
          )}
        </li>
      </ul>
      {sheet.toggles.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <h3 className="text-xs font-semibold uppercase text-muted">{t('sheet.situational')}</h3>
          <ul className="space-y-0.5 text-sm">
            {sheet.toggles.map((tg) => (
              <li key={tg.key}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={tg.on} onChange={() => void run(toggleEffect(character, tg.key, tg.label))} />
                  <span>
                    {tg.label} <span className="text-xs text-muted">({tg.source.entity.name})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

type Group = { key: string; title: string; items: ActiveEntity[] }

function groupFor(ae: ActiveEntity, content: ContentIndex): string {
  if (ae.grantKey.startsWith('extra:')) return 'extras'
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

export function FeaturesPanel() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [adding, setAdding] = useState(false)
  // Subspecies are shown through their traits; the "choose a subclass" placeholder feature is skipped.
  const shown = sheet.active.filter(
    (ae) =>
      !ae.hidden &&
      ['feature', 'feat', 'trait'].includes(ae.entity.type) &&
      !ae.entity.tags.includes('core') &&
      !(ae.entity.type === 'feature' && ae.entity.id.endsWith('-subclass')),
  )
  const order = ['class', 'subclass', 'species', 'background', 'feats', 'extras', 'other']
  const groups: Group[] = order
    .map((key) => ({ key, title: t(`sheet.featureGroups.${key}`), items: shown.filter((ae) => groupFor(ae, content) === key) }))
    .filter((g) => g.items.length)
  /** The extra behind an entity granted as "extra:<uid>" (only the top-level one can be removed). */
  const extraOf = (ae: ActiveEntity) => (/^extra:([^/]+)$/.exec(ae.grantKey) ? character.extras.find((x) => `extra:${x.uid}` === ae.grantKey) : undefined)

  return (
    <Panel title={t('sheet.features')} icon="📜">
      {groups.map((g) => (
        <div key={g.key} className="mb-2">
          <h3 className="text-xs font-semibold uppercase text-muted">{g.title}</h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {g.items.map((ae) => {
              const extra = extraOf(ae)
              return (
                <li key={ae.grantKey} className="inline-flex items-baseline gap-1">
                  <FeatureName entity={ae.entity} content={content} editable={!extra?.custom} />
                  {extra?.note && <span className="text-[10px] text-muted">({extra.note})</span>}
                  {edit && extra && (
                    <button
                      className="text-xs text-danger"
                      aria-label={t('inventory.remove')}
                      title={t('inventory.remove')}
                      onClick={() => {
                        if (confirm(t('addFeature.confirmRemove', { name: ae.entity.name }))) void run(removeExtra(character, content, extra.uid))
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {edit && (
        <button className="mt-1 w-full rounded border-2 border-dashed border-accent py-1 text-sm font-semibold text-accent hover:bg-accent/10" onClick={() => setAdding(true)}>
          ➕ {t('addFeature.title')}
        </button>
      )}
      {adding && <AddFeatureDialog onClose={() => setAdding(false)} />}
    </Panel>
  )
}

function FeatureName({ entity, content, editable = true }: { entity: Entity; content: ContentIndex; editable?: boolean }) {
  return (
    <RuleRef entity={entity} content={content} editable={editable}>
      {entity.name.replace(/^Giant Ancestry: /, '')}
      {entity.isNew && <sup className="ml-0.5 text-[9px] font-semibold uppercase text-accent">new</sup>}
      {!entity.verified && <sup className="ml-0.5 text-danger">?</sup>}
    </RuleRef>
  )
}

/** Effects that are rules reminders rather than numbers (advantages, damage reduction). */
function reminders(sheet: Sheet) {
  return sheet.active.flatMap((ae) => ae.entity.effects.filter((e) => e.note).map((e) => ({ note: e.note!, entity: ae.entity })))
}

/** Rules to keep in mind, shown right under the vitals so they are always in sight. Edit mode adds own ones. */
export function Reminders() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [text, setText] = useState('')
  const notes = reminders(sheet)
  if (!notes.length && !sheet.notes.length && !character.reminders.length && !edit) return null
  return (
    <section aria-label={t('sheet.reminders')} className="rounded-card border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 shadow-sm">
      <ul className="flex flex-wrap gap-x-5 gap-y-0.5 text-sm">
        {sheet.notes.map((n) => (
          <li key={n} className="font-semibold text-danger">
            <span aria-hidden>⚠️ </span>
            {n}
          </li>
        ))}
        {notes.map((n, i) => (
          <li key={i}>
            <span aria-hidden>❗ </span>
            <RuleRef entity={n.entity} content={content}>
              {n.note}
            </RuleRef>
          </li>
        ))}
        {character.reminders.map((r) => (
          <li key={r.uid}>
            <span aria-hidden>📌 </span>
            {r.text}
            {edit && (
              <button className="ml-1 text-xs text-danger" aria-label={t('inventory.remove')} onClick={() => void run(removeReminder(character, r.uid))}>
                ×
              </button>
            )}
          </li>
        ))}
        {edit && (
          <li className="min-w-60 flex-1">
            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault()
                if (await run(addReminder(character, text))) setText('')
              }}
            >
              <input
                className="min-w-0 flex-1 rounded border border-dashed border-accent bg-card px-2 py-0.5 text-sm"
                placeholder={`📌 ${t('reminders.placeholder')}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="rounded border border-accent px-2 text-sm font-semibold text-accent disabled:opacity-40" disabled={!text.trim()} type="submit">
                ➕
              </button>
            </form>
          </li>
        )}
      </ul>
    </section>
  )
}
