import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Ability, Choice } from '../../content/schema'
import { choiceKey } from '../../engine/derive'
import { choiceOptions, isComplete, setChoiceValues, setSubclass, type Option, type Pending, type PendingChoice } from '../../engine/levelup'
import { RuleRef } from '../rules/RuleRef'
import { useRun, useSheet } from '../sheet/context'
import { ManageSpells } from '../spells/SpellcastingDrawer'

const card = 'rounded border p-2.5 text-sm'
const chip = (on: boolean, blocked?: boolean) =>
  `rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : blocked ? 'cursor-not-allowed border-border opacity-40' : 'border-border hover:bg-bg'}`

/** One open decision: a choice, a subclass, or spells to pick. */
export function PendingCard({ p }: { p: Pending }) {
  if (p.kind === 'subclass') return <SubclassCard classId={p.classId} className={p.className} />
  if (p.kind === 'spells') return <SpellsCard classId={p.classId} />
  return <ChoiceCard p={p} />
}

function Header({ title, done, children }: { title: React.ReactNode; done: boolean; children?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2">
      <span className="font-semibold">
        {done ? '✅' : '🧩'} {title}
      </span>
      {children}
    </div>
  )
}

export function SubclassCard({ classId, className }: { classId: string; className: string }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const current = character.classes.find((c) => c.classId === classId)?.subclassId
  const subs = content.all('subclass').filter((s) => s.class === classId && s.edition === character.edition)
  return (
    <div className={`${card} ${current ? 'border-border' : 'border-accent/60 bg-accent/5'}`}>
      <Header title={`${className}: ${t('levelUp.subclass')}`} done={!!current} />
      <ul className="space-y-1">
        {subs.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-start gap-2">
              <input type="radio" className="mt-1" checked={current === s.id} onChange={() => void run(setSubclass(character, content, classId, s.id))} />
              <span>
                <RuleRef entity={s} content={content} className="font-semibold">
                  {s.name}
                </RuleRef>
                {s.description && <span className="block text-xs text-muted">{s.description}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {subs.length === 0 && <p className="text-xs text-muted">{t('levelUp.noSubclass')}</p>}
    </div>
  )
}

function SpellsCard({ classId }: { classId: string }) {
  const { t } = useTranslation()
  const { sheet } = useSheet()
  const [open, setOpen] = useState(false)
  const caster = sheet.spellcasting.casters.find((c) => c.classId === classId)
  if (!caster) return null
  const counted = caster.mode === 'known' ? caster.known.length : caster.prepared.length
  const parts = [
    `${t('spells.cantrips')} ${caster.cantrips.length}/${caster.cantripsMax}`,
    caster.spellbook ? `📖 ${t('spells.spellbook')} ${caster.known.length}` : undefined,
    `${t(caster.mode === 'known' ? 'spells.known' : 'spells.prepared')} ${counted}/${caster.spellsMax}`,
  ].filter(Boolean)
  const done = caster.cantrips.length >= caster.cantripsMax && counted >= caster.spellsMax
  return (
    <div className={`${card} ${done ? 'border-border' : 'border-accent/60 bg-accent/5'}`}>
      <Header title={`${caster.name}: ${t('levelUp.spells')}`} done={done}>
        <span className="text-xs text-muted">{parts.join(' · ')}</span>
        <button className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => setOpen(!open)}>
          {open ? t('edit.done') : `📖 ${t('spells.manage')}`}
        </button>
      </Header>
      {open && <ManageSpells caster={caster} />}
    </div>
  )
}

export function ChoiceCard({ p }: { p: PendingChoice }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const altChosen = p.alternative ? (character.choices[choiceKey(p.ae.grantKey, p.alternative.id)] ?? []) : []
  const [useAlt, setUseAlt] = useState(altChosen.length > 0)
  const active = useAlt && p.alternative ? p.alternative : p.choice
  const count = active === p.choice ? p.count : 1
  const chosen = character.choices[choiceKey(p.ae.grantKey, active.id)] ?? []
  const done = isComplete(active, chosen, count)
  return (
    <div className={`${card} ${done ? 'border-border' : 'border-accent/60 bg-accent/5'}`}>
      <Header
        title={
          <>
            <RuleRef entity={p.ae.entity} content={content}>
              {p.ae.entity.name}
            </RuleRef>
            {p.choice.label !== p.ae.entity.name && <span className="font-normal text-muted"> · {p.choice.label}</span>}
          </>
        }
        done={done}
      >
        {p.alternative && (
          <span className="flex gap-1">
            {[p.choice, p.alternative].map((c) => (
              <button key={c.id} className={chip(active === c)} onClick={() => setUseAlt(c === p.alternative)}>
                {c.label}
              </button>
            ))}
          </span>
        )}
        {active.kind !== 'abilityPoints' && (
          <span className="ml-auto text-xs text-muted">{t('levelUp.picked', { count: chosen.length, of: count })}</span>
        )}
      </Header>
      {active.kind === 'abilityPoints' ? <AbilityPoints p={p} choice={active} /> : <Options p={p} choice={active} count={count} chosen={chosen} />}
    </div>
  )
}

function Options({ p, choice, count, chosen }: { p: PendingChoice; choice: Choice; count: number; chosen: string[] }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [query, setQuery] = useState('')
  const [showBlocked, setShowBlocked] = useState(false)
  const all = choiceOptions(character, content, sheet, p.ae, choice)
  const q = query.trim().toLowerCase()
  const matching = all.filter((o) => !q || o.label.toLowerCase().includes(q))
  const blocked = matching.filter((o) => o.blocked)
  const shown = showBlocked ? matching : matching.filter((o) => !o.blocked)
  const toggle = (o: Option) => {
    if (o.blocked) return
    const on = chosen.includes(o.id)
    const next = on ? chosen.filter((x) => x !== o.id) : count === 1 ? [o.id] : chosen.length >= count ? chosen : [...chosen, o.id]
    void run(setChoiceValues(character, content, p.ae, choice, next))
  }
  const reason = (o: Option) => (o.blocked && ['taken', 'notProficient', 'melee'].includes(o.blocked) ? t(`levelUp.blocked.${o.blocked}`) : t('levelUp.blocked.needs', { what: o.blocked }))
  // Entities and spells get a row with their summary; short options are chips.
  const rows = choice.kind === 'entity' || choice.kind === 'spell'
  return (
    <div>
      {(all.length > 12 || blocked.length > 0) && (
        <div className="mb-1.5 flex items-center gap-2">
          {all.length > 12 && (
            <input className="min-w-0 flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs" placeholder={t(choice.kind === 'spell' ? 'spells.search' : 'levelUp.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {blocked.length > 0 && (
            <label className="ml-auto flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={showBlocked} onChange={(e) => setShowBlocked(e.target.checked)} />
              {t('levelUp.showBlocked', { count: blocked.length })}
            </label>
          )}
        </div>
      )}
      {rows ? (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {shown.map((o) => (
            <li key={o.id}>
              <label className={`flex items-start gap-2 py-1 ${o.blocked ? 'opacity-50' : 'cursor-pointer'}`} title={o.blocked ? reason(o) : undefined}>
                <input type={count === 1 ? 'radio' : 'checkbox'} className="mt-1" checked={chosen.includes(o.id)} disabled={!!o.blocked} onChange={() => toggle(o)} />
                <span className="min-w-0">
                  <RuleRef entity={o.entity} content={content} className="font-semibold">
                    {o.label}
                  </RuleRef>
                  {o.blocked && <span className="ml-1.5 text-xs text-danger">{reason(o)}</span>}
                  {o.entity?.description && <span className="block text-xs text-muted">{o.entity.description}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1">
          {shown.map((o) => (
            <button key={o.id} className={chip(chosen.includes(o.id), !!o.blocked)} title={o.blocked ? reason(o) : undefined} onClick={() => toggle(o)}>
              <RuleRef entity={o.entity} content={content}>
                {o.label}
              </RuleRef>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && <p className="text-xs text-muted">{t('levelUp.noOptions')}</p>}
    </div>
  )
}

/** Ability Score Improvement and similar: spend points, at most `perOption` per ability, up to the cap. */
function AbilityPoints({ p, choice }: { p: PendingChoice; choice: Choice }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const values = character.choices[choiceKey(p.ae.grantKey, choice.id)] ?? []
  const budget = (choice.points ?? 2) * Math.max(1, p.count)
  const per = choice.perOption ?? budget
  const cap = choice.scoreCap ?? 20
  const assigned = (a: string) => values.filter((v) => v.startsWith(`${a}+`)).reduce((s, v) => s + Number(v.split('+')[1]), 0)
  const spent = values.reduce((s, v) => s + Number(v.split('+')[1] ?? 0), 0)
  const set = (a: string, n: number) => {
    const rest = values.filter((v) => !v.startsWith(`${a}+`))
    void run(setChoiceValues(character, content, p.ae, choice, n > 0 ? [...rest, `${a}+${n}`] : rest))
  }
  const options = (choice.options ?? ['str', 'dex', 'con', 'int', 'wis', 'cha']) as Ability[]
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{t('levelUp.points', { spent, budget, cap })}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((a) => {
          const n = assigned(a)
          const score = sheet.scores[a].value
          return (
            <span key={a} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 ${n ? 'border-accent' : 'border-border'}`}>
              <span className="w-8 text-xs font-semibold">{a.toUpperCase()}</span>
              <span className="w-6 text-center tabular-nums">{score}</span>
              <button className="rounded border border-border px-1 leading-4 disabled:opacity-30" disabled={n <= 0} aria-label={`${a} −1`} onClick={() => set(a, n - 1)}>
                −
              </button>
              <span className="w-5 text-center text-xs tabular-nums">{n ? `+${n}` : ''}</span>
              <button
                className="rounded border border-border px-1 leading-4 disabled:opacity-30"
                disabled={n >= per || spent >= budget || score >= cap}
                aria-label={`${a} +1`}
                onClick={() => set(a, n + 1)}
              >
                +
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
