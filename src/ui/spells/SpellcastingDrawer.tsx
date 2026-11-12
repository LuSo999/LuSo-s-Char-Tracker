import { useCallback, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { Choice, Spell } from '../../content/schema'
import { setResourceRemaining } from '../../engine/actions'
import { selections, type ActiveEntity } from '../../engine/derive'
import { addExtra } from '../../engine/extras'
import { castOptions, endConcentration, setChoice, setClassSpell, toggleFavoriteSpell } from '../../engine/spellActions'
import { spellBrief, spellDice, upcastNote, type CasterState, type SpellRow } from '../../engine/spells'
import { RuleRef } from '../rules/RuleRef'
import { Dots } from '../sheet/common'
import { useRun, useSheet } from '../sheet/context'
import { useEditMode } from '../sheet/editMode'
import { signed } from '../sheet/format'
import { useCastSpell } from './useCastSpell'
import { CastPrompt } from './CastPrompt'
import { defaultSpellFilters, filterSpells, type SpellFilters } from './spellFilters'
import { adjustHp, setHp } from '../../engine/actions'
import { useSettings } from '../../state/settings'
import { TurnBar } from '../sheet/ActionList'
import { NumberAdjust } from '../sheet/NumberAdjust'
import { SidePanel } from '../sheet/SidePanel'
import { useOnResetFilters } from '../sheet/shortcuts'
import { centerOf } from '../fx/fx'

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
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [casting, setCasting] = useState(false)
  const fav = character.favoriteSpells.includes(row.spell.id)
  const s = row.spell
  const mod = sheet.mods[row.ability]
  const dice = spellDice(s, Math.max(1, s.level), sheet.characterLevel, mod)
  const options = castOptions(row, sheet)
  const { quickCast } = useCastSpell()
  return (
    <li className={`py-1.5 ${row.ritualOnly ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <button
          className={`text-lg leading-none ${fav ? 'text-amber-500' : 'text-muted opacity-40 hover:opacity-100'}`}
          aria-pressed={fav}
          title={t(fav ? 'spells.unfavorite' : 'spells.favorite')}
          onClick={() => void run(toggleFavoriteSpell(character, s.id, s.name), { quiet: true })}
        >
          {fav ? '★' : '☆'}
        </button>
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
        <span className="ml-auto flex">
          <button
            className={`border border-violet-500/60 px-2 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300 ${options.length > 1 ? 'rounded-l' : 'rounded'}`}
            title={t('spells.castHint')}
            onClick={(e) => void quickCast(row, undefined, centerOf(e.currentTarget))}
          >
            ✨ {t('spells.cast')}
          </button>
          {options.length > 1 && (
            <button
              className="rounded-r border border-l-0 border-violet-500/60 px-1.5 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
              title={t('spells.castHow')}
              aria-label={t('spells.castHow')}
              onClick={() => setCasting(!casting)}
            >
              ▾
            </button>
          )}
        </span>
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
      <p className="text-sm leading-snug">
        {spellBrief(s)} {upcastNote(s) && <span className="whitespace-nowrap text-xs font-semibold text-violet-700 dark:text-violet-300">{upcastNote(s)}</span>}
      </p>
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
              <div className="min-w-0 flex-1">
                <RuleRef entity={s} content={content}>
                  {s.name}
                  <SpellTags spell={s} />
                </RuleRef>
                <p className="truncate text-xs text-muted" title={spellBrief(s)}>
                  {spellBrief(s)}
                </p>
              </div>
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

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      title={title}
      className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Filters for the spell list: text, level, action type, ★, castable now, concentration, ritual, kind, school, source, sorting. */
function Filters({ f, set, rows }: { f: SpellFilters; set: (p: Partial<SpellFilters>) => void; rows: SpellRow[] }) {
  const { t } = useTranslation()
  const { sheet } = useSheet()
  const levels = [...new Set(rows.map((r) => r.spell.level))].sort((a, b) => a - b)
  const schools = [...new Set(rows.map((r) => r.spell.school))].sort()
  const select = 'rounded border border-border bg-card px-1 py-0.5 text-xs'
  const toggleLevel = (l: number) => set({ levels: f.levels.includes(l) ? f.levels.filter((x) => x !== l) : [...f.levels, l] })
  return (
    <div className="space-y-1.5">
      <input className="w-full rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('spells.search')} value={f.query} onChange={(e) => set({ query: e.target.value })} />
      <div className="flex flex-wrap gap-1">
        <Chip on={f.levels.length === 0} onClick={() => set({ levels: [] })}>
          {t('itemFilters.categories.all')}
        </Chip>
        {levels.map((l) => (
          <Chip key={l} on={f.levels.includes(l)} onClick={() => toggleLevel(l)}>
            {l === 0 ? t('spells.cantrips') : l}
          </Chip>
        ))}
        <span className="mx-1 border-l border-border" />
        {(['all', 'action', 'bonusAction', 'reaction', 'other'] as const).map((a) => (
          <Chip key={a} on={f.actionType === a} onClick={() => set({ actionType: a })}>
            {t(`actionFilter.${a}`)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Chip on={f.favorites} onClick={() => set({ favorites: !f.favorites })} title={t('spells.favoritesHint')}>
          ★ {t('spells.favorites')}
        </Chip>
        <Chip on={f.castable} onClick={() => set({ castable: !f.castable })}>
          ✨ {t('spells.castableNow')}
        </Chip>
        <Chip on={f.concentration === 'yes'} onClick={() => set({ concentration: f.concentration === 'yes' ? 'all' : 'yes' })}>
          🔮 {t('spells.concentration')}
        </Chip>
        <Chip on={f.concentration === 'no'} onClick={() => set({ concentration: f.concentration === 'no' ? 'all' : 'no' })}>
          {t('spells.noConcentration')}
        </Chip>
        <Chip on={f.ritual} onClick={() => set({ ritual: !f.ritual })}>
          📿 {t('spells.ritual')}
        </Chip>
        <select className={select} value={f.kind} onChange={(e) => set({ kind: e.target.value as SpellFilters['kind'] })} aria-label={t('spells.kind')}>
          <option value="all">{t('spells.kinds.all')}</option>
          <option value="attack">🎯 {t('spells.kinds.attack')}</option>
          <option value="save">🛡️ {t('spells.kinds.save')}</option>
          <option value="damage">💥 {t('spells.kinds.damage')}</option>
          <option value="heal">❤️ {t('spells.kinds.heal')}</option>
        </select>
        {schools.length > 1 && (
          <select className={select} value={f.school} onChange={(e) => set({ school: e.target.value })} aria-label={t('spells.school')}>
            <option value="">{t('spells.anySchool')}</option>
            {schools.map((sc) => (
              <option key={sc} value={sc}>
                {sc[0].toUpperCase() + sc.slice(1)}
              </option>
            ))}
          </select>
        )}
        {(sheet.spellcasting.casters.length > 1 || rows.some((r) => r.always)) && (
          <select className={select} value={f.source} onChange={(e) => set({ source: e.target.value })} aria-label={t('spells.source')}>
            <option value="">{t('spells.anySource')}</option>
            {sheet.spellcasting.casters.map((c) => (
              <option key={c.classId} value={`class:${c.classId}`}>
                {c.name}
              </option>
            ))}
            <option value="granted">★ {t('spells.granted')}</option>
          </select>
        )}
        <select className={select} value={f.sort} onChange={(e) => set({ sort: e.target.value as SpellFilters['sort'] })} aria-label={t('itemFilters.sort')}>
          <option value="level">↕ {t('spells.byLevel')}</option>
          <option value="name">↕ {t('itemFilters.sortName')}</option>
        </select>
        {JSON.stringify(f) !== JSON.stringify(defaultSpellFilters) && (
          <button className="text-xs text-muted underline" onClick={() => set(defaultSpellFilters)}>
            {t('itemFilters.reset')}
          </button>
        )}
      </div>
    </div>
  )
}

/** HP, concentration and the turn tracker, so the panel never needs closing during a turn. */
function StatusStrip() {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const mode = useSettings((s) => s.turnMode)
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1">
          ❤️
          <NumberAdjust
            label={t('sheet.hitPoints')}
            value={character.hp.current}
            valueClassName="font-semibold"
            onSet={(v) => void run(setHp(character, sheet, v))}
            onDelta={(d) => void run(adjustHp(character, sheet, d))}
          />
          <span className="text-muted">/ {sheet.hpMax.value}</span>
          {character.hp.temp > 0 && <span className="text-xs text-sky-700 dark:text-sky-300">+{character.hp.temp}</span>}
        </span>
        {character.concentration ? (
          <span className="ml-auto flex items-center gap-1 rounded border border-violet-500/60 bg-violet-500/10 px-2 py-0.5">
            🔮 {character.concentration.name}
            <button className="text-xs text-muted underline" onClick={() => void run(endConcentration(character))}>
              {t('spells.endConcentration')}
            </button>
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted">🔮 {t('spells.noConcentrationNow')}</span>
        )}
      </div>
      {mode !== 'off' && <TurnBar />}
    </div>
  )
}

/** Spellcasting panel: everything for casting in one place (status, slots, filters, spells, managing the list). */
export function SpellcastingDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [manage, setManage] = useState<string>()
  const [filters, setFilters] = useState<SpellFilters>(defaultSpellFilters)
  useOnResetFilters(useCallback(() => setFilters(defaultSpellFilters), []))
  const set = (p: Partial<SpellFilters>) => setFilters((f) => ({ ...f, ...p }))
  const sc = sheet.spellcasting
  const slotState = (key: string) => sheet.resources.find((r) => r.key === key)
  const granters = sheet.active.filter((ae) => (ae.entity.spells ?? []).length > 0)
  const shown = filterSpells(sc.rows, filters, sheet, character.favoriteSpells)
  const groups = new Map<number | 'all', SpellRow[]>()
  for (const r of shown) {
    const k = filters.sort === 'level' ? r.spell.level : 'all'
    groups.set(k, [...(groups.get(k) ?? []), r])
  }

  return (
    <SidePanel
      side="left"
      title={`✨ ${t('spells.title')}`}
      onClose={onClose}
      header={
        <>
          <StatusStrip />
          {sc.casters.map((c) => (
            <div key={c.classId} className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
              <strong>{c.name}</strong>
              <span>{c.ability.toUpperCase()}</span>
              <span>DC {c.dc}</span>
              <span>
                {signed(c.attack)} {t('spells.toHit')}
              </span>
              <button className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => setManage(manage === c.classId ? undefined : c.classId)}>
                {manage === c.classId ? `✅ ${t('edit.done')}` : `📖 ${t('spells.manage')}`}
              </button>
            </div>
          ))}
          {(sc.slots.length > 0 || sc.pact) && (
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {sc.slots.map((sl) => {
                const st = slotState(sl.key)!
                return (
                  <span key={sl.key} className="flex items-center gap-1">
                    <span className="text-xs text-muted">{sl.level}.</span>
                    <Dots remaining={st.remaining} max={st.max} onSet={(n) => void run(setResourceRemaining(character, sheet, sl.key, n))} />
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
          {!manage && sc.rows.length > 0 && (
            <div className="mt-2">
              <Filters f={filters} set={set} rows={sc.rows} />
            </div>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {granters.map((ae) => (
          <GrantChoices key={ae.grantKey} ae={ae} />
        ))}
        {manage ? (
          <ManageSpells caster={sc.casters.find((c) => c.classId === manage)!} />
        ) : (
          [...groups.entries()].map(([level, rows]) => (
            <section key={String(level)}>
              {level !== 'all' && <h3 className="text-xs font-semibold uppercase text-muted">{levelName(t, level)}</h3>}
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <SpellLine key={r.key} row={r} />
                ))}
              </ul>
            </section>
          ))
        )}
        {!manage && sc.rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted">{t('inventory.noResults')}</p>}
        {!manage && sc.rows.length === 0 && <p className="text-sm text-muted">{t('spells.none')}</p>}
        {edit && <AddDmSpell />}
      </div>
    </SidePanel>
  )
}
