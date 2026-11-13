import { useTranslation } from 'react-i18next'
import { abilities } from '../../content/schema'
import { crLabel, type CreatureView } from '../../engine/creatures'
import { actionSummary } from './format'
import { signed } from '../sheet/format'

const speedText = (speeds: Record<string, number>) =>
  Object.entries(speeds)
    .sort(([a], [b]) => (a === 'walk' ? -1 : b === 'walk' ? 1 : a.localeCompare(b)))
    .map(([k, v]) => (k === 'walk' ? `${v} ft` : `${k} ${v} ft`))
    .join(', ')

/** A creature's stat block with the numbers it has in play (scaled by slot level, beast form). */
export function StatBlock({ view, hp }: { view: CreatureView; hp?: string }) {
  const { t } = useTranslation()
  const c = view.creature
  const line = (label: string, value: string) =>
    value ? (
      <p>
        <span className="font-semibold">{label}</span> {value}
      </p>
    ) : null
  const groups = [
    ['action', t('statBlock.actions')],
    ['bonusAction', t('statBlock.bonusActions')],
    ['reaction', t('statBlock.reactions')],
  ] as const
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs italic text-muted">
        {c.size} {c.creatureType}
        {c.cr > 0 || c.tags.includes('beast') ? ` · ${t('statBlock.cr')} ${crLabel(c.cr)}` : ''}
      </p>
      <div className="flex flex-wrap gap-x-4">
        {line(t('statBlock.ac'), String(view.ac))}
        {line(t('statBlock.hp'), hp ?? `${view.hpMax}${c.hitDice && !/slot/.test(c.hitDice) ? ` (${c.hitDice})` : ''}`)}
        {line(t('statBlock.speed'), speedText(view.speeds))}
      </div>
      {c.scores && (
        <div className="grid grid-cols-6 gap-1 text-center">
          {abilities.map((a) => (
            <div key={a} className="rounded border border-border px-1 py-0.5">
              <div className="text-[10px] font-semibold uppercase text-muted">{a}</div>
              <div className="font-semibold tabular-nums">{c.scores![a]}</div>
              <div className="text-xs tabular-nums text-muted">{signed(view.mods[a])}</div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-0.5 text-xs">
        {line(t('statBlock.saves'), Object.entries(view.saves).map(([a, v]) => `${a.toUpperCase()} ${signed(v)}`).join(', '))}
        {line(t('statBlock.skills'), Object.entries(view.skills).map(([s, v]) => `${s.replace(/-/g, ' ')} ${signed(v)}`).join(', '))}
        {line(t('statBlock.resistances'), view.resistances.join(', '))}
        {line(t('statBlock.immunities'), view.immunities.join(', '))}
        {line(t('statBlock.conditionImmunities'), c.conditionImmunities.join(', '))}
        {line(
          t('statBlock.senses'),
          [...Object.entries(view.senses).map(([k, v]) => `${k} ${v} ft`), view.passivePerception ? `${t('statBlock.passive')} ${view.passivePerception}` : ''].filter(Boolean).join(', '),
        )}
        {line(t('statBlock.languages'), c.languages && c.languages !== 'None' ? c.languages : '')}
      </div>
      {c.traits.length > 0 && (
        <div className="space-y-1">
          {c.traits.map((tr) => (
            <p key={tr.name}>
              <span className="font-semibold italic">{tr.name}.</span> {tr.description}
            </p>
          ))}
        </div>
      )}
      {groups.map(([type, label]) => {
        const list = view.actions.filter((a) => a.actionType === type)
        if (!list.length) return null
        return (
          <div key={type}>
            <h4 className="border-b border-border font-heading text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
            {list.map((a) => (
              <div key={a.name} className="mt-1">
                <p>
                  <span className="font-semibold italic">{a.name}.</span> <span className="font-semibold text-accent">{actionSummary(a, t('statBlock.toHit'))}</span>
                </p>
                {a.description && <p className="text-xs text-muted">{a.description}</p>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
