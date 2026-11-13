import { RuleRef } from '../rules/RuleRef'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { crLabel, eligibleShapes, viewCreature, type ShapeRules } from '../../engine/creatures'
import { setShapeForms } from '../../engine/shape'
import { Dialog } from '../sheet/RestDialog'
import { useRun, useSheet } from '../sheet/context'
import { StatBlock } from './StatBlock'

/**
 * Wild Shape: choose the beast form. 2024 druids pick from their known forms (★, a limited
 * number); 2014 druids from any beast within their CR and speed limits.
 */
export function ShapePicker({ rules, onPick, onClose }: { rules: ShapeRules; onPick: (creatureId: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const all = useMemo(() => eligibleShapes(content, rules), [content, rules])
  const maxForms = rules.forms
  const known = all.filter((c) => character.shapeForms.includes(c.id))
  const [tab, setTab] = useState<'known' | 'all'>(maxForms && known.length ? 'known' : 'all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string>()
  const list = (tab === 'known' ? known : all).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
  const canPick = (id: string) => !maxForms || character.shapeForms.includes(id)

  const toggleKnown = (id: string) => {
    const has = character.shapeForms.includes(id)
    if (!has && maxForms && character.shapeForms.length >= maxForms) return
    void run(setShapeForms(character, has ? character.shapeForms.filter((x) => x !== id) : [...character.shapeForms, id]), { quiet: true })
  }

  const limits = [t('shape.limits', { cr: crLabel(rules.maxCr) }), !rules.fly && t('shape.noFly'), !rules.swim && t('shape.noSwim')].filter(Boolean).join(' · ')
  const tabClass = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`

  return (
    <Dialog title={`🐾 ${t('shape.pick')}`} onClose={onClose} wide>
      <p className="text-sm text-muted">{limits}</p>
      {maxForms !== undefined && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            <button className={tabClass(tab === 'known')} onClick={() => setTab('known')}>
              ★ {t('shape.knownCount', { count: known.length, max: maxForms })}
            </button>
            <button className={tabClass(tab === 'all')} onClick={() => setTab('all')}>
              {t('shape.all')} {all.length}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">{t('shape.knownHint')}</p>
        </>
      )}
      <input className="mt-2 w-full rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('shape.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      {tab === 'known' && !known.length && <p className="mt-3 text-sm text-muted">{t('shape.noKnown')}</p>}
      <ul className="mt-2 divide-y divide-border">
        {list.map((c) => {
          const view = viewCreature(c, {})
          const isOpen = open === c.id
          return (
            <li key={c.id} className="py-1.5">
              <div className="flex items-center gap-2">
                {maxForms !== undefined && (
                  <button
                    className={`text-lg leading-none ${character.shapeForms.includes(c.id) ? 'text-accent' : 'text-muted hover:text-accent'}`}
                    title={t('shape.known')}
                    aria-pressed={character.shapeForms.includes(c.id)}
                    onClick={() => toggleKnown(c.id)}
                  >
                    {character.shapeForms.includes(c.id) ? '★' : '☆'}
                  </button>
                )}
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? undefined : c.id)}>
                  <RuleRef entity={c} content={content} className="font-semibold">
                    {c.name}
                  </RuleRef>{' '}
                  <span className="text-xs text-muted">
                    CR {crLabel(c.cr)} · AC {view.ac} · HP {view.hpMax} · {Object.entries(view.speeds).map(([k, v]) => (k === 'walk' ? `${v} ft` : `${k} ${v}`)).join(', ')}
                  </span>
                </button>
                <button className="shrink-0 rounded bg-accent px-2.5 py-1 text-sm font-semibold text-accent-text disabled:opacity-40" disabled={!canPick(c.id)} onClick={() => onPick(c.id)}>
                  {t('shape.become')}
                </button>
              </div>
              {isOpen && (
                <div className="mt-2 rounded border border-border p-2">
                  <StatBlock view={view} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
