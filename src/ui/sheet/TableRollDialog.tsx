// Using an activity with a random table: roll (or type the physical roll), see the outcome, apply it.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Activity } from '../../content/schema'
import { diceRange, rollDice, tableOutcome } from '../../engine/shape'
import { RuleRef } from '../rules/RuleRef'
import { useSheet } from './context'
import { Dialog } from './RestDialog'

export function TableRollDialog({ activity, onApply, onClose }: { activity: Activity; onApply: (total: number) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { content } = useSheet()
  const table = activity.table!
  const range = diceRange(table.dice)
  const [value, setValue] = useState('')
  const total = Number.parseInt(value, 10)
  const valid = Number.isFinite(total) && total >= range.min && total <= range.max
  const row = valid ? tableOutcome(table, total) : undefined
  return (
    <Dialog title={`🎲 ${activity.name}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{table.dice}</span>
        <button type="button" className="rounded bg-accent px-3 py-1.5 font-medium text-accent-text" onClick={() => setValue(String(rollDice(table.dice)))}>
          🎲 {t('tableRoll.roll')}
        </button>
        <span className="text-muted">{t('tableRoll.or')}</span>
        <input
          className="w-20 rounded border border-border bg-card px-2 py-1 tabular-nums"
          inputMode="numeric"
          value={value}
          placeholder={`${range.min}–${range.max}`}
          aria-label={t('tableRoll.enter')}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        />
        {valid && <span className="text-2xl font-bold tabular-nums">{total}</span>}
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {table.rows.map((r, i) => {
            const hit = r === row
            const creature = r.creature ? content.get(r.creature) : undefined
            return (
              <tr key={i} className={hit ? 'bg-accent/15 font-semibold' : ''}>
                <td className="w-20 py-0.5 pr-2 align-top tabular-nums text-muted">{r.min === r.max ? r.min : `${r.min}–${r.max}`}</td>
                <td className="py-0.5">
                  {hit && '➤ '}
                  {r.text}
                  {creature && (
                    <>
                      {' '}
                      <span className="text-muted">
                        (🐾{' '}
                        <RuleRef entity={creature} content={content}>
                          {creature.name}
                        </RuleRef>
                        )
                      </span>
                    </>
                  )}
                  {r.effects.length > 0 && <span className="text-muted"> ⚡</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {valid && !row && <p className="mt-2 text-sm text-muted">{t('tableRoll.nothing')}</p>}
      {row?.creature &&
        (content.get(row.creature) ? (
          <p className="mt-2 text-xs text-muted">
            {t('tableRoll.shapeEnds', { reminders: t('sheet.reminders') })}
            {table.noOwnAbilities ? ` ${t('tableRoll.noOwn')}` : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs text-danger">⚠️ {t('tableRoll.missingCreature', { id: row.creature })}</p>
        ))}
      {row && row.effects.length > 0 && <p className="mt-2 text-xs text-muted">{t('tableRoll.effectsEnd', { reminders: t('sheet.reminders'), situational: `${t('sheet.conditions')} → ${t('sheet.situational')}` })}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!valid} className="rounded bg-accent px-4 py-2 font-medium text-accent-text disabled:opacity-40" onClick={() => onApply(total)}>
          {t('tableRoll.apply')}
        </button>
        <button type="button" className="rounded border border-border px-4 py-2" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </Dialog>
  )
}
