// The random table of an action: dice, rows by range, and what each outcome does
// (turn into a creature, effects while it lasts, or just text).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { diceRange, tableProblems } from '../../engine/shape'
import { describeEffect } from './describe'
import { EffectFields } from './EffectFields'
import { Check, Field, Label, Num, Rows, Text } from './fields'
import { inputBase } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '2d6']

/** "3, 5–8, 12" */
const spans = (ns: number[]) => {
  const out: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    out.push(i === j ? String(ns[i]) : `${ns[i]}–${ns[j]}`)
    i = j
  }
  return out.join(', ')
}

export function TableEditor({ a, setA, content, choiceIds }: { a: Raw; setA: (a: Raw) => void; content?: ContentIndex; choiceIds: string[] }) {
  const { t } = useTranslation()
  const table = a.table as Raw
  const rows = (table.rows as Raw[] | undefined) ?? []
  const setTable = (patch: Raw) => setA({ ...a, table: { ...table, ...patch } })
  const [split, setSplit] = useState(4)
  const custom = !DICE.includes(table.dice)
  const { gaps, overlaps } = tableProblems(table.dice, rows as { min: number; max: number }[])
  const creatureName = (id?: string) => (id ? (content?.get(id)?.name ?? id) : undefined)

  const splitEvenly = () => {
    if (!/^\d+d\d+$/.test(table.dice) || split < 1) return
    const { min, max } = diceRange(table.dice)
    const size = (max - min + 1) / split
    setTable({
      rows: Array.from({ length: split }, (_, i) => ({
        text: '',
        effects: [],
        ...rows[i],
        min: min + Math.round(i * size),
        max: i === split - 1 ? max : min + Math.round((i + 1) * size) - 1,
      })),
    })
  }

  return (
    <section className="mt-2 space-y-2 rounded border border-accent/40 bg-accent/5 p-2">
      <h4 className="text-sm">
        <Label text={`🎲 ${t('homebrew.table.title')}`} help="activity.table" />
      </h4>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('homebrew.table.dice')} help="table.dice">
          <span className="flex gap-1">
            <select className={`${inputBase} w-auto`} value={custom ? 'custom' : table.dice} onChange={(e) => setTable({ dice: e.target.value === 'custom' ? '3d6' : e.target.value })}>
              {DICE.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="custom">{t('homebrew.table.customDice')}</option>
            </select>
            {custom && <input className={`${inputBase} w-20`} value={table.dice} onChange={(e) => setTable({ dice: e.target.value.trim() })} placeholder="3d6" />}
          </span>
        </Field>
        <span className="flex items-center gap-1 text-xs">
          <button type="button" className="rounded border border-border px-2 py-1 hover:bg-bg" onClick={splitEvenly}>
            ✂️ {t('homebrew.table.split')}
          </button>
          <input className={`${inputBase} w-14`} inputMode="numeric" value={split} onChange={(e) => setSplit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} aria-label={t('homebrew.table.splitCount')} />
          <span className="text-muted">{t('homebrew.table.rows')}</span>
        </span>
      </div>
      <Check value={table.noOwnAbilities} onChange={(v) => setTable({ noOwnAbilities: v || undefined })} label={t('homebrew.table.noOwnAbilities')} help="table.noOwnAbilities" />
      <Rows
        title={t('homebrew.table.outcomes')}
        help="table.row"
        rows={rows}
        onChange={(v) => setTable({ rows: v })}
        make={() => {
          const last = rows.at(-1)?.max ?? diceRange(/^\d+d\d+$/.test(table.dice) ? table.dice : '1d20').min - 1
          return { min: last + 1, max: last + 1, text: '', effects: [] }
        }}
        summary={(r) => {
          const range = r.min === r.max ? String(r.min) : `${r.min}–${r.max}`
          const what = [r.text, r.creature && `🐾 ${creatureName(r.creature)}`, ...((r.effects as Raw[] | undefined) ?? []).map((e) => describeEffect(e, { t, content }))].filter(Boolean).join(' · ')
          return `${range}: ${what || '…'}`
        }}
        place={(r) => (r.creature ? 'shape' : (r.effects as Raw[] | undefined)?.length ? 'situational' : 'reminders')}
        render={(r, setR) => (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[5rem_5rem_1fr]">
              <Field label={t('homebrew.table.from')}>
                <Num value={r.min} onChange={(v) => setR({ ...r, min: v ?? 1 })} />
              </Field>
              <Field label={t('homebrew.table.to')}>
                <Num value={r.max} onChange={(v) => setR({ ...r, max: v ?? r.min })} />
              </Field>
              <Field label={t('homebrew.table.text')}>
                <Text value={r.text} onChange={(v) => setR({ ...r, text: v })} placeholder={t('homebrew.table.textPh')} />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t('homebrew.table.creature')} help="table.creature" hint={creatureName(r.creature)}>
                <Text value={r.creature} list="hb-creatures" onChange={(v) => setR({ ...r, creature: v.trim() || undefined })} placeholder={t('homebrew.table.creaturePh')} />
              </Field>
              <Field label={t('homebrew.table.state')} help="table.effects">
                <Text value={r.state} onChange={(v) => setR({ ...r, state: v || undefined })} placeholder={`${a.name}: ${r.text || '…'}`} />
              </Field>
            </div>
            <Rows
              title={t('homebrew.table.effects')}
              help="table.effects"
              rows={r.effects as Raw[]}
              onChange={(v) => setR({ ...r, effects: v })}
              make={() => ({ target: 'ac', op: 'add', value: 1 })}
              summary={(e) => describeEffect(e, { t, content })}
              render={(e, setE) => <EffectFields e={e} setE={setE} content={content} choiceIds={choiceIds} entityName={a.name} />}
            />
          </div>
        )}
      />
      {(gaps.length > 0 || overlaps.length > 0) && rows.length > 0 && (
        <p className="text-xs text-danger">
          {gaps.length > 0 && <>⚠️ {t('homebrew.table.gaps', { list: spans(gaps) })} </>}
          {overlaps.length > 0 && <>⚠️ {t('homebrew.table.overlaps', { list: spans(overlaps) })}</>}
        </p>
      )}
    </section>
  )
}
