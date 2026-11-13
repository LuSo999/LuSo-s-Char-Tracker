import { RuleRef } from '../rules/RuleRef'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { crLabel, grantCreatures, type CompanionSource } from '../../engine/creatures'
import { addCompanion, adjustCompanionHp, endShape, removeCompanion, setCompanionHp, setCompanionTempHp, setShapeHp } from '../../engine/shape'
import { adjustHp } from '../../engine/actions'
import { Panel } from '../sheet/common'
import { useRun, useSheet } from '../sheet/context'
import { NumberAdjust } from '../sheet/NumberAdjust'
import { Dialog } from '../sheet/RestDialog'
import { StatBlock } from './StatBlock'

type Companion = ReturnType<typeof useSheet>['sheet']['companions'][number]

/** Familiars, steeds, beast companions and summons: HP, AC, and the stat block on demand. */
export function CompanionsPanel() {
  const { t } = useTranslation()
  const { sheet } = useSheet()
  const [adding, setAdding] = useState(false)
  if (!sheet.companionSources.length && !sheet.companions.length) return null
  return (
    <Panel title={t('companions.title')} icon="🐾">
      {sheet.companions.length === 0 && <p className="text-sm text-muted">{t('companions.none')}</p>}
      <ul className="space-y-2">
        {sheet.companions.map((c) => (
          <CompanionCard key={c.entry.uid} c={c} />
        ))}
      </ul>
      {sheet.companionSources.length > 0 && (
        <button className="mt-2 rounded border border-dashed border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent/10" onClick={() => setAdding(true)}>
          + {t('companions.add')}
        </button>
      )}
      {adding && <AddCompanion onClose={() => setAdding(false)} />}
    </Panel>
  )
}

function CompanionCard({ c }: { c: Companion }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [open, setOpen] = useState(false)
  const name = c.entry.name ?? c.creature.name
  const pct = Math.max(0, Math.min(100, (c.entry.hp / c.hpMax) * 100))
  const kind = c.source ? t(`companions.kinds.${c.source.grant.kind}`) : ''
  return (
    <li className="rounded border border-border p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <RuleRef entity={c.creature} content={content} className="font-semibold">
            {name}
          </RuleRef>
          <button className="block text-left text-xs text-muted" onClick={() => setOpen(!open)} aria-expanded={open}>
            {kind}
            {c.entry.slot ? ` · L${c.entry.slot}` : ''}
            {c.entry.choice ? ` · ${c.entry.choice}` : ''} · AC {c.ac} · {open ? '▴' : '▾'} {t('shape.statBlock')}
          </button>
        </div>
        <button
          className="text-sm text-danger hover:underline"
          title={t('companions.remove')}
          aria-label={t('companions.remove')}
          onClick={() => confirm(t('companions.removeConfirm', { name })) && void run(removeCompanion(character, c.entry.uid, name))}
        >
          🗑
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 text-sm">
          ❤️
          <NumberAdjust
            label={`${name} HP`}
            value={c.entry.hp}
            valueClassName="font-semibold"
            onSet={(v) => void run(setCompanionHp(character, c.entry.uid, c.hpMax, v, name))}
            onDelta={(d) => void run(adjustCompanionHp(character, c.entry.uid, c.hpMax, d, name))}
          />
          <span className="text-muted">/ {c.hpMax}</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
          💠
          <NumberAdjust label={`${name} temp HP`} value={c.entry.tempHp} onSet={(v) => void run(setCompanionTempHp(character, c.entry.uid, v, name))} onDelta={(d) => void run(setCompanionTempHp(character, c.entry.uid, c.entry.tempHp + d, name))} />
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-border">
        <div className={`h-full ${c.entry.hp <= c.hpMax / 2 ? 'bg-danger' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
      </div>
      {c.source?.grant.note && <p className="mt-1 text-xs text-muted">{c.source.grant.note}</p>}
      {open && (
        <div className="mt-2">
          <StatBlock view={c} hp={`${c.entry.hp} / ${c.hpMax}`} />
        </div>
      )}
    </li>
  )
}

function AddCompanion({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const sources = sheet.companionSources
  const [sourceIndex, setSourceIndex] = useState(0)
  const source: CompanionSource = sources[sourceIndex]
  const spellLevel = source.entity.type === 'spell' ? source.entity.level : 1
  const [slot, setSlot] = useState(Math.max(1, spellLevel))
  const [choice, setChoice] = useState<string>()
  const [query, setQuery] = useState('')
  const creatures = useMemo(() => grantCreatures(source.grant, content), [source, content])
  const list = creatures.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function add(creatureId: string) {
    const pick = source.grant.choose ? (choice ?? source.grant.choose.options[0]) : undefined
    const r = addCompanion(character, sheet, content, source, creatureId, source.grant.slot && !source.grant.fixed?.slot ? slot : undefined, pick)
    if (await run(r)) onClose()
  }

  return (
    <Dialog title={`🐾 ${t('companions.addTitle')}`} onClose={onClose} wide>
      <label className="block text-sm">
        <span className="font-semibold">{t('companions.from')}</span>
        <select className="ml-2 rounded border border-border bg-card px-2 py-1" value={sourceIndex} onChange={(e) => setSourceIndex(Number(e.target.value))}>
          {sources.map((s, i) => (
            <option key={`${s.entity.id}/${s.grant.id}`} value={i}>
              {s.entity.name} · {t(`companions.kinds.${s.grant.kind}`)}
            </option>
          ))}
        </select>
      </label>
      {source.grant.choose && (
        <label className="mt-2 block text-sm">
          <span className="font-semibold">{source.grant.choose.label}</span>
          <select className="ml-2 rounded border border-border bg-card px-2 py-1" value={choice ?? source.grant.choose.options[0]} onChange={(e) => setChoice(e.target.value)}>
            {source.grant.choose.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )}
      {source.grant.slot && !source.grant.fixed?.slot && (
        <label className="mt-2 block text-sm">
          <span className="font-semibold">{t('companions.slot')}</span>
          <select className="ml-2 rounded border border-border bg-card px-2 py-1" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
            {Array.from({ length: 10 - spellLevel }, (_, i) => spellLevel + i).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {source.grant.note && <p className="mt-2 text-xs text-muted">{source.grant.note}</p>}
      {creatures.length > 8 && <input className="mt-2 w-full rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('companions.search')} value={query} onChange={(e) => setQuery(e.target.value)} />}
      <p className="mt-2 text-sm font-semibold">{t('companions.choose')}</p>
      <ul className="mt-1 divide-y divide-border">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{c.name}</span> <span className="text-xs text-muted">{c.description || `CR ${crLabel(c.cr)}`}</span>
            </span>
            <button className="shrink-0 rounded bg-accent px-2.5 py-1 text-sm font-semibold text-accent-text" onClick={() => void add(c.id)}>
              + {t('companions.add')}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

/** While in Wild Shape: the form, its HP (2014), its stat block and the way back. */
export function ShapeBanner() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [open, setOpen] = useState(false)
  const shape = sheet.shape
  if (!shape) return null
  return (
    <div className="framed-sm rounded-card border-2 border-emerald-600/60 bg-emerald-600/10 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">
          🐾 {t('shape.in')}:{' '}
          <RuleRef entity={shape.creature} content={content}>
            {shape.creature.name}
          </RuleRef>
        </span>
        {shape.hp && (
          <span className="flex items-center gap-1 text-sm">
            {t('shape.beastHp')}
            <NumberAdjust
              label={t('shape.beastHp')}
              value={shape.hp.current}
              valueClassName="font-semibold"
              onSet={(v) => void run(setShapeHp(character, sheet, content, v))}
              onDelta={(d) => void run(adjustHp(character, sheet, d))}
            />
            <span className="text-muted">/ {shape.hp.max}</span>
          </span>
        )}
        <button className="text-sm text-accent underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          {t('shape.statBlock')}
        </button>
        <button className="ml-auto rounded border border-border px-2.5 py-1 text-sm font-semibold hover:bg-bg" onClick={() => void run(endShape(character, content))}>
          ↩ {t('shape.revert')}
        </button>
      </div>
      <p className="text-xs text-muted">{t('shape.noSpells')}</p>
      {open && (
        <div className="mt-2 rounded border border-border bg-card p-2">
          <StatBlock view={shape} hp={shape.hp ? `${shape.hp.current} / ${shape.hp.max}` : undefined} />
        </div>
      )}
    </div>
  )
}
