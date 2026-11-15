// The form of a whole class: hit die, proficiencies, features per level, spellcasting.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, skills } from '../../content/schema'
import { slug } from '../../engine/homebrew'
import { Card } from '../Card'
import { Check, Field, Label, Multi, Num, Rows, Select, Text } from './fields'
import { More } from './MechanicRows'
import { ARMOR_PROFS, WEAPON_PROFS } from './targets'
import { grid, input } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const commaList = (v: string) =>
  v
    .split(',')
    .map((x) => slug(x))
    .filter(Boolean)

/** Which class's table a new spellcasting progression starts from. */
const TABLE_FROM: Record<string, string[]> = { full: ['wizard', 'cleric'], half: ['paladin', 'ranger'], pact: ['warlock'], third: [] }

export function ClassFields({ draft, set, content, ownFeatures, newLinked }: { draft: Raw; set: (p: Raw) => void; content: ContentIndex; ownFeatures: { value: string; label: string }[]; newLinked: (link: (id: string) => Raw) => React.ReactNode }) {
  const { t } = useTranslation()
  const abilityOpts = abilities.map((a) => ({ value: a, label: a.toUpperCase() }))
  const skillOpts = Object.keys(skills).map((s) => ({ value: s, label: content.get(`skill-${s}`)?.name ?? s }))
  const casterClasses = content.all('class').filter((c) => c.spellcasting !== 'none' && Object.keys(c.spellTable).length)
  const subclassTables = content.all('subclass').filter((c) => c.spellcasting === 'third' && Object.keys(c.spellTable).length)
  const profs = draft.proficiencies ?? { armor: [], weapons: [], tools: [] }
  const mc = draft.multiclass as Raw | undefined

  const copyTable = (fromId: string) => {
    const from = content.get(fromId) as Raw | undefined
    if (!from?.spellTable) return
    set({ spellTable: structuredClone(from.spellTable), caster: draft.caster ?? structuredClone(from.caster) })
  }
  const setProgression = (v: string | undefined) => {
    const p = v ?? 'none'
    if (p === 'none') return set({ spellcasting: 'none', caster: undefined, spellTable: {} })
    const from = (p === 'third' ? subclassTables[0] : TABLE_FROM[p].map((id) => content.get(id)).find(Boolean)) as Raw | undefined
    set({ spellcasting: p, spellTable: from?.spellTable ? structuredClone(from.spellTable) : (draft.spellTable ?? {}), caster: draft.caster ?? (from?.caster ? structuredClone(from.caster) : { ability: 'int', mode: 'prepared', spellbook: false, ritual: 'prepared' }) })
  }
  const caster = draft.caster as Raw | undefined
  const setCaster = (patch: Raw) => set({ caster: { ...caster, ...patch } })

  return (
    <Card>
      <div className="space-y-2">
        <div className={grid}>
          <Field label={t('homebrew.f.hitDie')} help="class.hitDie">
            <Select value={String(draft.hitDie)} onChange={(v) => set({ hitDie: Number(v ?? 8) })} options={['6', '8', '10', '12'].map((d) => ({ value: d, label: `d${d}` }))} />
          </Field>
          <Field label={t('homebrew.f.subclassLevel')} help="class.subclassLevel">
            <Num value={draft.subclassLevel} onChange={(v) => set({ subclassLevel: v ?? 3 })} />
          </Field>
          <Field label={t('homebrew.f.skillCount')} help="class.skillChoice">
            <Num value={draft.skillChoice?.count} onChange={(v) => set({ skillChoice: { ...draft.skillChoice, count: v ?? 2 } })} />
          </Field>
          <Field label={t('homebrew.f.startingGold')}>
            <Num value={draft.startingGold} onChange={(v) => set({ startingGold: v ?? 0 })} />
          </Field>
        </div>
        <Field label={t('homebrew.f.primaryAbility')} help="class.primaryAbility">
          <Multi value={draft.primaryAbility} onChange={(v) => set({ primaryAbility: v })} options={abilityOpts} />
        </Field>
        <Field label={t('homebrew.f.savingThrows')} help="class.savingThrows">
          <Multi value={draft.savingThrows} onChange={(v) => set({ savingThrows: v })} options={abilityOpts} />
        </Field>
        <Field label={t('homebrew.f.skillOptions')} help="class.skillChoice">
          <Multi value={draft.skillChoice?.options} onChange={(v) => set({ skillChoice: { count: draft.skillChoice?.count ?? 2, options: v } })} options={skillOpts} />
        </Field>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={t('homebrew.f.armorProfs')} help="class.proficiencies">
            <Multi value={profs.armor} onChange={(v) => set({ proficiencies: { ...profs, armor: v } })} options={ARMOR_PROFS.map((x) => ({ value: x, label: t(`homebrew.armorProf.${x}`) }))} />
          </Field>
          <Field label={t('homebrew.f.weaponProfs')} help="class.proficiencies">
            <Multi value={profs.weapons} onChange={(v) => set({ proficiencies: { ...profs, weapons: v } })} options={WEAPON_PROFS.map((x) => ({ value: x, label: t(`homebrew.weaponProf.${x}`) }))} />
          </Field>
          <Field label={t('homebrew.f.tools')} hint={t('homebrew.f.commaList')} help="class.proficiencies">
            <Text value={(profs.tools ?? []).join(', ')} onChange={(v) => set({ proficiencies: { ...profs, tools: commaList(v) } })} />
          </Field>
        </div>
        <Rows
          title={t('homebrew.f.levels')}
          help="class.levels"
          hint={t('homebrew.f.levelsHint')}
          rows={draft.levels as Raw[]}
          onChange={(levels) => set({ levels: [...levels].sort((a, b) => a.level - b.level) })}
          make={() => ({ level: Math.min(20, ((draft.levels as Raw[] | undefined)?.at(-1)?.level ?? 0) + 1), features: [] })}
          summary={(row) => `${t('homebrew.f.level')} ${row.level}: ${(row.features as string[]).map((id) => ownFeatures.find((f) => f.value === id)?.label ?? content.get(id)?.name ?? id).join(', ') || '—'}`}
          render={(row, setRow) => (
            <div className="space-y-1">
              <Field label={t('homebrew.f.level')}>
                <Num value={row.level} onChange={(v) => setRow({ ...row, level: Math.max(1, Math.min(20, v ?? 1)) })} />
              </Field>
              <Multi value={row.features} onChange={(f) => setRow({ ...row, features: f })} options={ownFeatures} />
              {newLinked((id) => ({ levels: (draft.levels as Raw[]).map((l) => (l === row ? { ...l, features: [...l.features, id] } : l)) }))}
            </div>
          )}
        />
        <div className={grid}>
          <Field label={t('homebrew.f.spellcasting')} help="class.spellcasting">
            <Select value={draft.spellcasting ?? 'none'} onChange={setProgression} options={['none', 'full', 'half', 'third', 'pact'].map((x) => ({ value: x, label: t(`homebrew.progression.${x}`) }))} />
          </Field>
          {caster && (
            <>
              <Field label={t('homebrew.f.castingAbility')} help="class.caster">
                <Select value={caster.ability} onChange={(v) => setCaster({ ability: v ?? 'int' })} options={abilityOpts} />
              </Field>
              <Field label={t('homebrew.f.casterMode')} help="class.caster">
                <Select value={caster.mode} onChange={(v) => setCaster({ mode: v ?? 'prepared' })} options={['prepared', 'known'].map((x) => ({ value: x, label: t(`homebrew.casterMode.${x}`) }))} />
              </Field>
              <Field label={t('homebrew.f.ritualCasting')} help="class.caster">
                <Select value={caster.ritual} onChange={(v) => setCaster({ ritual: v ?? 'none' })} options={['none', 'prepared', 'book'].map((x) => ({ value: x, label: t(`homebrew.ritual.${x}`) }))} />
              </Field>
            </>
          )}
        </div>
        {caster && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Check value={caster.spellbook} onChange={(v) => setCaster({ spellbook: v })} label={t('homebrew.f.spellbook')} help="class.caster" />
              <label className="flex items-center gap-1 text-xs">
                <span className="text-muted">{t('homebrew.f.copyTable')}</span>
                <select className={`${input} w-auto`} value="" onChange={(e) => e.target.value && copyTable(e.target.value)}>
                  <option value="">—</option>
                  {[...casterClasses, ...subclassTables].map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SpellTable table={draft.spellTable ?? {}} onChange={(spellTable) => set({ spellTable })} mode={caster.mode} />
            <p className="text-xs text-muted">{t('homebrew.f.classSpellsHint', { id: draft.id })}</p>
          </>
        )}
        <More>
          <p className="text-sm">
            <Label text={t('homebrew.f.multiclass')} help="class.multiclass" />
          </p>
          <Rows
            title={t('homebrew.f.multiclassMin')}
            rows={(mc?.prerequisites as Raw[][] | undefined)?.map((g) => g[0])}
            onChange={(v) => set({ multiclass: { proficiencies: mc?.proficiencies ?? { armor: [], weapons: [], tools: [], skills: 0 }, prerequisites: v.map((x) => [x]) } })}
            make={() => ({ ability: draft.primaryAbility?.[0] ?? 'str', min: 13 })}
            render={(row, setRow) => (
              <div className={grid}>
                <Select value={row.ability} onChange={(v) => setRow({ ...row, ability: v ?? 'str' })} options={abilityOpts} />
                <Num value={row.min} onChange={(v) => setRow({ ...row, min: v ?? 13 })} />
              </div>
            )}
          />
          {mc && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={t('homebrew.f.armorProfs')}>
                <Multi value={mc.proficiencies?.armor} onChange={(v) => set({ multiclass: { ...mc, proficiencies: { ...mc.proficiencies, armor: v } } })} options={ARMOR_PROFS.map((x) => ({ value: x, label: t(`homebrew.armorProf.${x}`) }))} />
              </Field>
              <Field label={t('homebrew.f.weaponProfs')}>
                <Multi value={mc.proficiencies?.weapons} onChange={(v) => set({ multiclass: { ...mc, proficiencies: { ...mc.proficiencies, weapons: v } } })} options={WEAPON_PROFS.map((x) => ({ value: x, label: t(`homebrew.weaponProf.${x}`) }))} />
              </Field>
              <Field label={t('homebrew.f.multiclassSkills')}>
                <Num value={mc.proficiencies?.skills} onChange={(v) => set({ multiclass: { ...mc, proficiencies: { ...mc.proficiencies, skills: v ?? 0 } } })} />
              </Field>
            </div>
          )}
        </More>
      </div>
    </Card>
  )
}

type TableRow = { cantrips: number; known?: number; prepared?: number; slots: number[] }

/** Cantrips, spells prepared / known and slots per class level (one row per level that changes). */
function SpellTable({ table, onChange, mode }: { table: Record<string, TableRow>; onChange: (t: Record<string, TableRow>) => void; mode: 'prepared' | 'known' }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const levels = Array.from({ length: 20 }, (_, i) => String(i + 1))
  const count = mode === 'known' ? 'known' : 'prepared'
  const setRow = (l: string, patch: Partial<TableRow>) => onChange({ ...table, [l]: { ...{ cantrips: 0, slots: [] }, ...table[l], ...patch } })
  return (
    <div className="rounded border border-border p-2 text-xs">
      <button type="button" className="font-semibold" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {t('homebrew.f.spellTable')} ({Object.keys(table).length})
      </button>
      {open && (
        <table className="mt-1 w-full">
          <thead>
            <tr className="text-left text-muted">
              <th>{t('homebrew.f.level')}</th>
              <th>{t('homebrew.f.cantrips')}</th>
              <th>{t(`homebrew.casterMode.${mode}`)}</th>
              <th>{t('homebrew.f.slots')}</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => {
              const row = table[l]
              return (
                <tr key={l}>
                  <td className="pr-2 tabular-nums">{l}</td>
                  <td className="pr-1">
                    <input className={`${input} w-14`} inputMode="numeric" value={row?.cantrips ?? ''} onChange={(e) => setRow(l, { cantrips: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="pr-1">
                    <input className={`${input} w-14`} inputMode="numeric" value={row?.[count] ?? ''} onChange={(e) => setRow(l, { [count]: e.target.value === '' ? undefined : Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input
                      className={input}
                      value={(row?.slots ?? []).join(', ')}
                      placeholder="4, 2"
                      onChange={(e) =>
                        setRow(l, {
                          slots: e.target.value
                            .split(',')
                            .filter((x) => x.trim() !== '')
                            .map((x) => Number(x.trim()))
                            .filter((x) => Number.isFinite(x)),
                        })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
