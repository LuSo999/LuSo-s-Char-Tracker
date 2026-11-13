import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { restItems } from '../../engine/actions'
import { dawnDice, longRest, shortRest } from '../../engine/rest'
import { itemText } from '../history/text'
import { useRun, useSheet } from './context'
import { Term } from '../rules/Term'
import { useBackClose } from '../useBackClose'

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useBackClose(onClose)
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-card border border-border bg-card p-5 shadow-xl sm:rounded-card ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-heading text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Shows what a rest restores before it happens; short rests can spend Hit Dice. */
export function RestDialog({ kind, onClose }: { kind: 'short' | 'long'; onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [rolls, setRolls] = useState<Record<number, string[]>>({})
  const [dawn, setDawn] = useState(true)
  const [dawnRolls, setDawnRolls] = useState<Record<string, string>>({})
  const dawnItems = kind === 'long' ? dawnDice(sheet) : []

  const parsedRolls = Object.fromEntries(
    Object.entries(rolls).map(([die, list]) => [die, list.map((v) => Number.parseInt(v, 10)).filter((n) => Number.isFinite(n) && n >= 1 && n <= Number(die))]),
  )
  const parsedDawn = Object.fromEntries(Object.entries(dawnRolls).map(([k, v]) => [k, Number.parseInt(v, 10)]).filter(([, n]) => Number.isFinite(n as number)))
  const result = kind === 'short' ? shortRest(character, content, parsedRolls) : longRest(character, content, { dawn, dawnRolls: parsedDawn })
  const items = restItems(result.changes)
  // Both editions: a Long Rest needs at least 1 HP to start.
  const atZero = kind === 'long' && character.hp.current === 0
  const invalid = atZero || Object.entries(rolls).some(([die, list]) => list.some((v) => v !== '' && !(Number(v) >= 1 && Number(v) <= Number(die))))

  async function confirm() {
    await run({ ok: true, character: result.character, items, groupType: kind === 'short' ? 'shortRest' : 'longRest', kind: 'game' })
    onClose()
  }

  return (
    <Dialog title={t(kind === 'short' ? 'rest.shortTitle' : 'rest.longTitle')} onClose={onClose}>
      {kind === 'short' && (
        <section className="mb-4">
          <h3 className="text-sm font-semibold">
            <Term id="rule-hit-point-dice">{t('rest.hitDice')}</Term>
          </h3>
          <p className="text-xs text-muted">{t('rest.hitDiceHint', { con: sheet.mods.con >= 0 ? `+${sheet.mods.con}` : sheet.mods.con })}</p>
          {sheet.hitDice.map((pool) => {
            const list = rolls[pool.die] ?? []
            const available = pool.total - pool.used
            return (
              <div key={pool.die} className="mt-2 flex flex-wrap items-center gap-2">
                <span className="w-28 text-sm">
                  d{pool.die}: {t('rest.available', { count: available - list.length, total: pool.total })}
                </span>
                {list.map((v, i) => (
                  <input
                    key={i}
                    autoFocus={i === list.length - 1}
                    inputMode="numeric"
                    aria-label={`d${pool.die} #${i + 1}`}
                    className={`w-12 rounded border bg-card px-1 text-center ${v !== '' && !(Number(v) >= 1 && Number(v) <= pool.die) ? 'border-danger' : 'border-border'}`}
                    value={v}
                    onChange={(e) => setRolls({ ...rolls, [pool.die]: list.map((x, j) => (j === i ? e.target.value.replace(/\D/g, '') : x)) })}
                  />
                ))}
                {list.length < available && (
                  <button className="rounded border border-border px-2 text-sm hover:bg-bg" onClick={() => setRolls({ ...rolls, [pool.die]: [...list, ''] })}>
                    + d{pool.die}
                  </button>
                )}
                {list.length > 0 && (
                  <button className="text-sm text-muted underline" onClick={() => setRolls({ ...rolls, [pool.die]: list.slice(0, -1) })}>
                    {t('rest.removeDie')}
                  </button>
                )}
              </div>
            )
          })}
        </section>
      )}
      {kind === 'long' && (
        <section className="mb-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={dawn} onChange={(e) => setDawn(e.target.checked)} />
            🌅 {t('rest.dawn')}
          </label>
          {dawn && dawnItems.length > 0 && (
            <ul className="mt-1 space-y-1 pl-6 text-sm">
              {dawnItems.map((d) => (
                <li key={d.key} className="flex items-center gap-2">
                  <span className="flex-1">
                    {d.name}: {t('rest.dawnRoll', { dice: d.dice })}
                  </span>
                  <input
                    inputMode="numeric"
                    aria-label={`${d.name} ${d.dice}`}
                    className="w-14 rounded border border-border bg-card px-1 text-center"
                    value={dawnRolls[d.key] ?? ''}
                    onChange={(e) => setDawnRolls({ ...dawnRolls, [d.key]: e.target.value.replace(/\D/g, '') })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold">{t('rest.willChange')}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t('rest.nothing')}</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {items.map((i, n) => (
              <li key={n}>{itemText(t, i)}</li>
            ))}
          </ul>
        )}
        {kind === 'long' && character.edition === '2014' && character.exhaustion > 0 && <p className="mt-2 text-xs text-muted">{t('rest.foodAndDrink')}</p>}
        {atZero && <p className="mt-2 rounded border border-danger bg-danger/5 p-2 text-sm text-danger">{t('rest.zeroHp')}</p>}
      </section>
      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded border border-border px-4 py-2" onClick={onClose}>
          {t('cancel')}
        </button>
        <button className="rounded bg-accent px-4 py-2 font-semibold text-accent-text disabled:opacity-50" disabled={invalid} onClick={() => void confirm()}>
          {t(kind === 'short' ? 'rest.confirmShort' : 'rest.confirmLong')}
        </button>
      </div>
    </Dialog>
  )
}
