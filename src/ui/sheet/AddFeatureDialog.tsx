import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { abilities, skills, type ActionType, type Entity, type RechargeOn } from '../../content/schema'
import { addCustomFeature, addExtra } from '../../engine/extras'
import { RuleRef } from '../rules/RuleRef'
import { useRun, useSheet } from './context'
import { Dialog } from './RestDialog'

type Tab = 'rules' | 'custom'
type Kind = 'all' | 'feat' | 'feature' | 'trait'

/** Targets offered for the simple bonus of an own feature. */
function bonusTargets(t: (k: string) => string) {
  return [
    ['ac', 'AC'],
    ['initiative', t('sheet.initiative')],
    ['speed', t('sheet.speed')],
    ['hpMax', t('sheet.hpMax')],
    ['save:all', t('addFeature.allSaves')],
    ['check:all', t('addFeature.allChecks')],
    ['attack', t('addFeature.weaponAttack')],
    ['damage', t('addFeature.weaponDamage')],
    ['passive:perception', t('sheet.passivePerception')],
    ...abilities.map((a) => [`save:${a}`, `${t('sheet.save')} ${a.toUpperCase()}`]),
    ...abilities.map((a) => [`score:${a}`, a.toUpperCase()]),
    ...Object.keys(skills).map((s) => [`skill:${s}`, s.replace(/-/g, ' ')]),
  ] as [string, string][]
}

/** Edit mode: give the character a feature from the rules or its own one. */
export function AddFeatureDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [tab, setTab] = useState<Tab>('rules')
  const [note, setNote] = useState('')

  // From the rules
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [picked, setPicked] = useState<Entity>()
  const pool = useMemo(
    () =>
      [...content.all('feat'), ...content.all('feature'), ...content.all('trait')]
        .filter((e) => !e.tags.includes('core'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  )
  const q = query.trim().toLowerCase()
  const found = pool.filter((e) => (kind === 'all' || e.type === kind) && (!q || e.name.toLowerCase().includes(q)))

  // Own feature
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState<ActionType | 'none'>('none')
  const [uses, setUses] = useState('')
  const [recharge, setRecharge] = useState<RechargeOn | 'none'>('longRest')
  const [effects, setEffects] = useState<{ target: string; value: string }[]>([])
  const targets = bonusTargets(t)

  async function add() {
    const result =
      tab === 'rules'
        ? addExtra(character, content, picked!.id, note)
        : addCustomFeature(character, {
            name,
            description,
            note,
            actionType,
            uses: Number.parseInt(uses, 10) || undefined,
            recharge,
            effects: effects.map((e) => ({ target: e.target, value: Number.parseInt(e.value, 10) || 0 })),
          })
    if (await run(result)) onClose()
  }

  const input = 'mt-1 block w-full rounded border border-border bg-card px-2 py-1'
  const tabBtn = (x: Tab, label: string) => (
    <button
      className={`rounded-full border px-3 py-1 text-sm ${tab === x ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
      onClick={() => setTab(x)}
    >
      {label}
    </button>
  )

  return (
    <Dialog title={`➕ ${t('addFeature.title')}`} onClose={onClose}>
      <div className="mb-3 flex gap-2">
        {tabBtn('rules', `📜 ${t('addFeature.fromRules')}`)}
        {tabBtn('custom', `✍️ ${t('addFeature.custom')}`)}
      </div>

      {tab === 'rules' ? (
        picked ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{picked.name}</p>
            <p className="text-muted">{picked.description}</p>
          </div>
        ) : (
          <>
            <input autoFocus className={input} placeholder={t('addFeature.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1">
              {(['all', 'feat', 'feature', 'trait'] as Kind[]).map((k) => (
                <button
                  key={k}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${kind === k ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                  onClick={() => setKind(k)}
                >
                  {t(`addFeature.kinds.${k}`)}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted">{t('itemFilters.found', { count: found.length })}</span>
            </div>
            <ul className="mt-2 max-h-[45vh] divide-y divide-border overflow-y-auto">
              {found.slice(0, 150).map((e) => (
                <li key={e.id}>
                  <button className="flex w-full items-baseline gap-2 px-1 py-1.5 text-left hover:bg-bg" onClick={() => setPicked(e)}>
                    <RuleRef entity={e} content={content} className="flex-1 font-medium">
                      {e.name}
                    </RuleRef>
                    <span className="text-xs text-muted">
                      {t(`addFeature.kinds.${e.type}`)} · {content.pack(e.id)?.name ?? e.source.book}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <div className="space-y-2 text-sm">
          <label className="block">
            {t('edit.name')} *
            <input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            {t('edit.description')}
            <textarea className={`${input} h-20`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label>
              {t('addFeature.actionType')}
              <select className={input} value={actionType} onChange={(e) => setActionType(e.target.value as ActionType | 'none')}>
                <option value="none">{t('addFeature.passive')}</option>
                <option value="action">⚔️ Action</option>
                <option value="bonusAction">✨ Bonus action</option>
                <option value="reaction">↩️ Reaction</option>
                <option value="other">◆ Other</option>
              </select>
            </label>
            <label>
              {t('addFeature.uses')}
              <input inputMode="numeric" className={`${input} w-20`} placeholder="—" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, ''))} />
            </label>
            {uses && (
              <label>
                {t('addFeature.recharge')}
                <select className={input} value={recharge} onChange={(e) => setRecharge(e.target.value as RechargeOn | 'none')}>
                  <option value="shortRest">☕ Short / Long rest</option>
                  <option value="longRest">🌙 Long rest</option>
                  <option value="dawn">🌅 Dawn</option>
                  <option value="none">{t('addFeature.noRecharge')}</option>
                </select>
              </label>
            )}
          </div>
          <div>
            {t('addFeature.bonuses')}
            {effects.map((e, i) => (
              <div key={i} className="mt-1 flex items-center gap-2">
                <select className="rounded border border-border bg-card px-1 py-0.5" value={e.target} onChange={(ev) => setEffects(effects.map((x, j) => (j === i ? { ...x, target: ev.target.value } : x)))}>
                  {targets.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="w-16 rounded border border-border bg-card px-1 py-0.5 text-center"
                  placeholder="+1"
                  value={e.value}
                  onChange={(ev) => setEffects(effects.map((x, j) => (j === i ? { ...x, value: ev.target.value.replace(/[^\d+-]/g, '') } : x)))}
                />
                <button className="text-danger" aria-label={t('inventory.remove')} onClick={() => setEffects(effects.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <button className="mt-1 text-accent underline" onClick={() => setEffects([...effects, { target: 'ac', value: '1' }])}>
              + {t('addFeature.addBonus')}
            </button>
          </div>
        </div>
      )}

      <label className="mt-3 block text-sm">
        {t('addFeature.note')}
        <input className={input} placeholder={t('addFeature.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        {tab === 'rules' && picked && (
          <button className="mr-auto rounded border border-border px-4 py-2" onClick={() => setPicked(undefined)}>
            ← {t('inventory.back')}
          </button>
        )}
        <button className="rounded border border-border px-4 py-2" onClick={onClose}>
          {t('cancel')}
        </button>
        <button
          className="rounded bg-accent px-4 py-2 font-semibold text-accent-text disabled:opacity-50"
          disabled={tab === 'rules' ? !picked : !name.trim()}
          onClick={() => void add()}
        >
          {t('inventory.addConfirm')}
        </button>
      </div>
    </Dialog>
  )
}
