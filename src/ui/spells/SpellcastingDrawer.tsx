import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { Choice, Spell } from '../../content/schema'
import { setResourceRemaining } from '../../engine/actions'
import { selections, type ActiveEntity } from '../../engine/derive'
import { addExtra } from '../../engine/extras'
import { endConcentration, setChoice, setClassSpell } from '../../engine/spellActions'
import { spellDice, type CasterState, type SpellRow } from '../../engine/spells'
import { RuleRef } from '../rules/RuleRef'
import { Dots } from '../sheet/common'
import { useRun, useSheet } from '../sheet/context'
import { useEditMode } from '../sheet/editMode'
import { signed } from '../sheet/format'
import { CastPrompt } from './CastPrompt'

type TFn = TFunction

const levelName = (t: TFn, level: number) => (level === 0 ? t('spells.cantrips') : t('spells.level', { level }))

function SpellTags({ spell }: { spell: Spell }) {
  return (
    <span className="ml-1 inline-flex gap-1 text-[10px] font-semibold uppercase">
      {spell.concentration && <span className="rounded bg-violet-500/15 px-1 text-violet-700 dark:text-violet-300" title="Concentration">🔮 C</span>}
      {spell.ritual && <span className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300" title="Ritual">📿 R</span>}
    </span>
  )
}

/** One castable spell with its numbers and the Cast button. */
function SpellLine({ row }: { row: SpellRow }) {
  const { t } = useTranslation()
  const { sheet, content } = useSheet()
  const [casting, setCasting] = useState(false)
  const s = row.spell
  const mod = sheet.mods[row.ability]
  const dice = spellDice(s, Math.max(1, s.level), sheet.characterLevel, mod)
  return (
    <li className={`py-1.5 ${row.ritualOnly ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <RuleRef entity={s} content={content} className="font-semibold">
          {s.name}
        </RuleRef>
        <SpellTags spell={s} />
        {row.always && (
          <span className="rounded border border-border px-1 text-[10px] text-muted" title={row.grantedBy?.entity.name}>
            ★ {row.grantedBy?.entity.name ?? t('spells.always')}
          </span>
        )}
        {row.ritualOnly && <span className="text-[10px] text-muted">{t('spells.ritualOnly')}</span>}
        <button className="ml-auto rounded border border-violet-500/60 px-2 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300" onClick={() => setCasting(true)}>
          ✨ {t('spells.cast')}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted">
        <span>{s.castingTime}</span>
        <span>{s.range}</span>
        <span>{s.duration}</span>
        {s.attack && <strong className="text-text">{signed(row.attackBonus)} {t('spells.toHit')}</strong>}
        {s.save && <strong className="text-text">DC {row.dc} {s.save.toUpperCase()}</strong>}
        {dice.damage && <span className="text-text">{dice.damage}</span>}
        {dice.heal && <span className="text-text">❤️ {dice.heal}</span>}
      </div>
      {casting && <CastPrompt row={row} onDone={() => setCasting(false)} />}
    </li>
  )
}

/** Picker for choices of entities that grant spells (Magic Initiate: list, cantrips, spell, ability). */
function GrantChoices({ ae }: { ae: ActiveEntity }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [query, setQuery] = useState<Record<string, string>>({})
  const edit = useEditMode((s) => s.on)
  const choices = ae.entity.choices.filter((c) => ['option', 'spell', 'ability'].includes(c.kind) && !(ae.presets?.[c.id]))
  // Only open choices are shown; edit mode shows all of them to change.
  const open = choices.some((c) => selections(character, ae, c.id).length < (typeof c.count === 'number' ? c.count : 1))
  if (!choices.length || (!open && !edit)) return null
  const count = (c: Choice) => (typeof c.count === 'number' ? c.count : 1)
  const set = (c: Choice, values: string[]) => void run(setChoice(character, ae, c.id, values, `${ae.entity.name}: ${c.label}`))

  return (
    <div className="space-y-2 rounded border border-accent/60 bg-accent/5 p-2 text-sm">
      <p className="font-semibold">🧩 {ae.entity.name}</p>
      {choices.map((c) => {
        const chosen = selections(character, ae, c.id)
        const toggle = (v: string) => set(c, chosen.includes(v) ? chosen.filter((x) => x !== v) : count(c) === 1 ? [v] : [...chosen, v].slice(-count(c)))
        if (c.kind !== 'spell') {
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-1">
              <span className="mr-1">{c.label}:</span>
              {(c.options ?? []).map((o) => (
                <button
                  key={o}
                  className={`rounded-full border px-2 py-0.5 text-xs ${chosen.includes(o) ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                  onClick={() => toggle(o)}
                >
                  {o.length <= 3 ? o.toUpperCase() : content.get(o)?.name ?? o}
                </button>
              ))}
            </div>
          )
        }
        const lists = c.classesFromChoice ? selections(character, ae, c.classesFromChoice) : (c.spellClasses ?? [])
        const q = (query[c.id] ?? '').toLowerCase()
        const pool = content
          .all('spell')
          .filter((s) => s.level === c.spellLevel && (!lists.length || s.classes.some((k) => lists.includes(k))) && (!q || s.name.toLowerCase().includes(q)))
          .sort((a, b) => a.name.localeCompare(b.name))
        return (
          <div key={c.id}>
            <div className="flex items-center gap-2">
              <span>
                {c.label} ({chosen.length}/{count(c)})
              </span>
              <input
                className="min-w-0 flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs"
                placeholder={t('spells.search')}
                value={query[c.id] ?? ''}
                onChange={(e) => setQuery({ ...query, [c.id]: e.target.value })}
              />
            </div>
            {c.classesFromChoice && !lists.length ? (
              <p className="text-xs text-muted">{t('spells.chooseListFirst')}</p>
            ) : (
              <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {pool.map((s) => (
                  <button
                    key={s.id}
                    className={`rounded-full border px-2 py-0.5 text-xs ${chosen.includes(s.id) ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                    onClick={() => toggle(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Choose cantrips, known / spellbook and prepared spells of one class, within its limits. */
function ManageSpells({ caster }: { caster: CasterState }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | 'all'>('all')
  const pool = useMemo(
    () => content.all('spell').filter((s) => s.classes.includes(caster.classId) && s.level <= caster.maxSpellLevel).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [content, caster.classId, caster.maxSpellLevel],
  )
  const q = query.trim().toLowerCase()
  const shown = pool.filter((s) => (level === 'all' || s.level === level) && (!q || s.name.toLowerCase().includes(q)))

  async function toggle(list: 'known' | 'prepared', s: Spell, on: boolean) {
    const r = setClassSpell(character, sheet, content, caster.classId, list, s.id, on)
    if (!r.ok && ['limitSpells', 'limitCantrips', 'spellTooHigh'].includes(r.error)) {
      if (confirm(t('spells.overLimit'))) await run(setClassSpell(character, sheet, content, caster.classId, list, s.id, on, true))
      return
    }
    await run(r)
  }

  const counted = caster.mode === 'known' ? caster.known.length : caster.prepared.length
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {t('spells.cantrips')}: <strong className={caster.cantrips.length > caster.cantripsMax ? 'text-danger' : ''}>{caster.cantrips.length}</strong>/{caster.cantripsMax} ·{' '}
        {t(caster.mode === 'known' ? 'spells.known' : 'spells.prepared')}: <strong className={counted > caster.spellsMax ? 'text-danger' : ''}>{counted}</strong>/{caster.spellsMax}
        {caster.spellbook && ` · 📖 ${t('spells.spellbook')}: ${caster.known.length}`}
      </p>
      <input className="w-full rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('spells.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {(['all', ...Array.from({ length: caster.maxSpellLevel + 1 }, (_, i) => i)] as (number | 'all')[]).map((l) => (
          <button
            key={l}
            className={`rounded-full border px-2 py-0.5 text-xs ${level === l ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setLevel(l)}
          >
            {l === 'all' ? t('itemFilters.categories.all') : levelName(t, l)}
          </button>
        ))}
      </div>
      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto text-sm">
        {shown.map((s) => {
          const known = caster.cantrips.includes(s.id) || caster.known.includes(s.id)
          const prepared = caster.prepared.includes(s.id)
          return (
            <li key={s.id} className="flex items-center gap-2 py-1">
              <span className="w-8 text-xs text-muted">{s.level || 'C'}</span>
              <RuleRef entity={s} content={content} className="flex-1">
                {s.name}
                <SpellTags spell={s} />
              </RuleRef>
              {(s.level === 0 || caster.mode === 'known' || caster.spellbook) && (
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={known} onChange={(e) => void toggle('known', s, e.target.checked)} />
                  {s.level === 0 ? t('spells.knownShort') : caster.spellbook ? '📖' : t('spells.knownShort')}
                </label>
              )}
              {s.level > 0 && caster.mode === 'prepared' && (
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={prepared}
                    disabled={caster.spellbook && !known}
                    onChange={(e) => void toggle('prepared', s, e.target.checked)}
                  />
                  {t('spells.preparedShort')}
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Add a spell from the DM (always prepared, not counted): edit mode. */
function AddDmSpell() {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const q = query.trim().toLowerCase()
  const found = q.length < 2 ? [] : content.all('spell').filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30)
  return (
    <div className="rounded border-2 border-dashed border-accent p-2 text-sm">
      <p className="font-semibold">➕ {t('spells.addDm')}</p>
      <p className="text-xs text-muted">{t('spells.addDmHint')}</p>
      <div className="mt-1 flex gap-1">
        <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-0.5" placeholder={t('spells.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <input className="w-32 rounded border border-border bg-card px-2 py-0.5" placeholder={t('addFeature.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {found.map((s) => (
          <button
            key={s.id}
            className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-bg"
            onClick={async () => {
              if (await run(addExtra(character, content, s.id, note || undefined))) setQuery('')
            }}
          >
            {s.name} <span className="text-muted">({levelName(t, s.level)})</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Spellcasting panel: slots, concentration, spells by level, managing the spell list. */
export function SpellcastingDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [manage, setManage] = useState<string>()
  const sc = sheet.spellcasting
  const slotState = (key: string) => sheet.resources.find((r) => r.key === key)
  const granters = sheet.active.filter((ae) => ae.entity.spells.length > 0)
  const byLevel = new Map<number, SpellRow[]>()
  for (const r of sc.rows) byLevel.set(r.spell.level, [...(byLevel.get(r.spell.level) ?? []), r])

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-black/40" onClick={onClose}>
      <aside className="flex h-full w-full flex-col border-r border-border bg-card shadow-xl sm:max-w-lg" onClick={(e) => e.stopPropagation()} aria-label={t('spells.title')}>
        <header className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">✨ {t('spells.title')}</h2>
            <button className="text-2xl leading-none text-muted" aria-label={t('close')} onClick={onClose}>
              ×
            </button>
          </div>
          {sc.casters.map((c) => (
            <div key={c.classId} className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
              <strong>{c.name}</strong>
              <span>{c.ability.toUpperCase()}</span>
              <span>DC {c.dc}</span>
              <span>{signed(c.attack)} {t('spells.toHit')}</span>
              <button className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => setManage(manage === c.classId ? undefined : c.classId)}>
                {manage === c.classId ? `✅ ${t('edit.done')}` : `📖 ${t('spells.manage')}`}
              </button>
            </div>
          ))}
          {(sc.slots.length > 0 || sc.pact) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {sc.slots.map((s) => {
                const st = slotState(s.key)!
                return (
                  <span key={s.key} className="flex items-center gap-1">
                    <span className="text-xs text-muted">{s.level}.</span>
                    <Dots remaining={st.remaining} max={st.max} onSet={(n) => void run(setResourceRemaining(character, sheet, s.key, n))} />
                  </span>
                )
              })}
              {sc.pact && (
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted">{t('spells.pactShort', { level: sc.pact.level })}</span>
                  <Dots remaining={slotState('pact')!.remaining} max={slotState('pact')!.max} onSet={(n) => void run(setResourceRemaining(character, sheet, 'pact', n))} />
                </span>
              )}
            </div>
          )}
          {character.concentration && (
            <div className="mt-2 flex items-center gap-2 rounded border border-violet-500/60 bg-violet-500/10 px-2 py-1 text-sm">
              🔮 {t('spells.concentrating', { name: character.concentration.name })}
              <button className="ml-auto rounded border border-border bg-card px-2 py-0.5 text-xs" onClick={() => void run(endConcentration(character))}>
                {t('spells.endConcentration')}
              </button>
            </div>
          )}
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {granters.map((ae) => (
            <GrantChoices key={ae.grantKey} ae={ae} />
          ))}
          {manage ? (
            <ManageSpells caster={sc.casters.find((c) => c.classId === manage)!} />
          ) : (
            [...byLevel.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([level, rows]) => (
                <section key={level}>
                  <h3 className="text-xs font-semibold uppercase text-muted">{levelName(t, level)}</h3>
                  <ul className="divide-y divide-border">
                    {rows.map((r) => (
                      <SpellLine key={r.key} row={r} />
                    ))}
                  </ul>
                </section>
              ))
          )}
          {!manage && sc.rows.length === 0 && <p className="text-sm text-muted">{t('spells.none')}</p>}
          {edit && <AddDmSpell />}
        </div>
      </aside>
    </div>
  )
}
