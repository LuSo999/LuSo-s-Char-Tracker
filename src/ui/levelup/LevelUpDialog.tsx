import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HistoryItem } from '../../engine/actions'
import type { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import { levelDown, levelUp, levelUpOptions, MAX_LEVEL, mergeItems, pendingId, setMulticlass } from '../../engine/levelup'
import type { CharacterStore } from '../../state/history'
import { itemText } from '../history/text'
import { RuleRef } from '../rules/RuleRef'
import { Term } from '../rules/Term'
import { SheetContext, useRun, useSheet } from '../sheet/context'
import { Dialog } from '../sheet/RestDialog'
import { PendingCard } from './ChoiceCards'
import { useDecisions } from './useDecisions'

function DecisionList() {
  const { t } = useTranslation()
  const { list, open } = useDecisions()
  if (!list.length) return <p className="text-sm text-muted">{t('levelUp.nothingToChoose')}</p>
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{open ? t('levelUp.openCount', { count: open }) : `✅ ${t('levelUp.allDone')}`}</p>
      {list.map((p) => (
        <PendingCard key={pendingId(p)} p={p} />
      ))}
    </div>
  )
}

/** Choices the character still has to make (from the ⚠️ badge). Changes save right away. */
export function ChoicesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog title={t('levelUp.choicesTitle')} onClose={onClose} wide>
      <DecisionList />
      <div className="mt-4 flex justify-end">
        <button className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text" onClick={onClose}>
          {t('edit.done')}
        </button>
      </div>
    </Dialog>
  )
}

type Draft = { character: Character; items: HistoryItem[] }

/** A copy of the character the wizard changes; nothing is saved until Confirm. */
function DraftProvider({ draft, setDraft, children }: { draft: Draft; setDraft: (f: (d: Draft) => Draft) => void; children: React.ReactNode }) {
  const real = useSheet()
  const sheet = useMemo(() => computeSheet(draft.character, real.content), [draft.character, real.content])
  const store: CharacterStore = useMemo(
    () => ({
      history: [],
      hasMore: false,
      loadMore() {},
      async commit(result) {
        setDraft((d) => ({ character: result.character, items: mergeItems(d.items, result.items) }))
        return { id: 'draft', at: Date.now(), kind: result.kind, groupType: result.groupType, items: result.items }
      },
      async undo() {},
      async addGroup() {},
    }),
    [setDraft],
  )
  return <SheetContext.Provider value={{ ...real, character: draft.character, sheet, store, draft: true }}>{children}</SheetContext.Provider>
}

type Step = 'class' | 'hp' | 'choices' | 'summary'

/**
 * Level up step by step: class (or a new one), Hit Points, new features and
 * every choice, then a summary. One history entry; Undo takes it all back.
 */
export function LevelUpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const [step, setStep] = useState<Step>('class')
  const [classId, setClassId] = useState<string>(character.classes[character.classes.length - 1].classId)
  const [hpMode, setHpMode] = useState<'avg' | 'roll'>('avg')
  const [roll, setRoll] = useState('')
  const [draft, setDraftState] = useState<Draft>()
  const setDraft = useMemo(() => (f: (d: Draft) => Draft) => setDraftState((d) => (d ? f(d) : d)), [])

  const options = levelUpOptions(character, content, sheet)
  const cls = content.getTyped(classId, 'class')
  const die = cls?.hitDie ?? 8
  const avg = die / 2 + 1
  const rollValue = Number.parseInt(roll, 10)
  const rollValid = hpMode === 'avg' || (rollValue >= 1 && rollValue <= die)
  const steps: Step[] = ['class', 'hp', 'choices', 'summary']

  function startDraft() {
    const r = levelUp(character, content, classId, hpMode === 'avg' ? null : rollValue)
    if (!r.ok) return
    setDraftState({ character: r.character, items: r.items })
    setStep('choices')
  }

  async function confirm() {
    if (!draft) return
    await run({ ok: true, character: draft.character, items: draft.items, groupType: 'levelUp', kind: 'sheet' })
    onClose()
  }

  async function undoLast() {
    const r = levelDown(character, content)
    if (!r.ok) return
    if (!window.confirm(t('levelUp.levelDownConfirm', { what: `${r.items[0].params?.class} ${r.items[0].params?.level}` }))) return
    await run(r)
    onClose()
  }

  const lastClass = (character.levelOrder.length ? character.levelOrder : character.classes.flatMap((c) => Array(c.level).fill(c.classId)))[sheet.characterLevel - 1]
  const lastEntry = character.classes.find((c) => c.classId === lastClass)

  return (
    <Dialog title={`⬆️ ${t('levelUp.title', { level: sheet.characterLevel + 1 })}`} onClose={onClose} wide>
      <ol className="mb-4 flex flex-wrap gap-1 text-xs">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full border px-2 py-0.5 ${s === step ? 'border-accent bg-accent text-accent-text' : 'border-border text-muted'}`}>
            {i + 1}. {t(`levelUp.steps.${s}`)}
          </li>
        ))}
      </ol>

      {step === 'class' && (
        <section>
          {sheet.characterLevel >= MAX_LEVEL && <p className="text-sm">{t('levelUp.maxLevel')}</p>}
          <ul className="space-y-1">
            {options.map((o) => (
              <li key={o.cls.id}>
                <label className={`flex items-start gap-2 rounded border p-2 text-sm ${classId === o.cls.id ? 'border-accent bg-accent/5' : 'border-border'} ${o.blocked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" className="mt-1" disabled={!!o.blocked} checked={classId === o.cls.id} onChange={() => setClassId(o.cls.id)} />
                  <span>
                    <RuleRef entity={o.cls} content={content} className="font-semibold">
                      {o.cls.name}
                    </RuleRef>{' '}
                    {o.isNew ? <span className="text-xs text-muted">({t('levelUp.newClass')})</span> : `${o.current} → ${o.current + 1}`}
                    <span className="ml-2 text-xs text-muted">d{o.cls.hitDie}</span>
                    {o.blocked && <span className="block text-xs text-danger">{t('levelUp.blocked.needs', { what: o.blocked.join(', ') })}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={character.settings.multiclass} onChange={(e) => void run(setMulticlass(character, e.target.checked))} />
            {t('levelUp.multiclassRule')}
          </label>
          {options.some((o) => o.isNew) && <p className="mt-2 text-xs text-muted">{t('levelUp.multiclassHint')}</p>}
          <div className="mt-4 flex items-center gap-2">
            {sheet.characterLevel > 1 && lastEntry && (
              <button className="rounded border border-border px-2 py-1 text-xs hover:bg-bg" onClick={() => void undoLast()}>
                ↩ {t('levelUp.levelDown', { what: `${content.get(lastClass)?.name} ${lastEntry.level}` })}
              </button>
            )}
            <button
              className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text disabled:opacity-50"
              disabled={!options.some((o) => o.cls.id === classId && !o.blocked)}
              onClick={() => setStep('hp')}
            >
              {t('levelUp.next')} ›
            </button>
          </div>
        </section>
      )}

      {step === 'hp' && (
        <section className="text-sm">
          <h3 className="mb-1 font-semibold">
            <Term id="rule-hit-points">{t('levelUp.hp')}</Term> ({cls?.name} d{die})
          </h3>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" checked={hpMode === 'avg'} onChange={() => setHpMode('avg')} />
            {t('levelUp.hpAverage', { value: avg })}
          </label>
          <label className="flex flex-wrap items-center gap-2 py-1">
            <input type="radio" checked={hpMode === 'roll'} onChange={() => setHpMode('roll')} />
            {t('levelUp.hpRoll', { die })}
            <input
              className="w-16 rounded border border-border bg-card px-1.5 py-0.5"
              inputMode="numeric"
              value={roll}
              onFocus={() => setHpMode('roll')}
              onChange={(e) => setRoll(e.target.value)}
            />
            <button
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-bg"
              onClick={() => {
                setHpMode('roll')
                setRoll(String(1 + Math.floor(Math.random() * die)))
              }}
            >
              🎲 {t('levelUp.rollForMe')}
            </button>
          </label>
          <p className="text-xs text-muted">{t('levelUp.hpCon', { con: sheet.mods.con >= 0 ? `+${sheet.mods.con}` : sheet.mods.con })}</p>
          <div className="mt-4 flex items-center gap-2">
            <button className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg" onClick={() => setStep('class')}>
              ‹ {t('levelUp.back')}
            </button>
            <button className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text disabled:opacity-50" disabled={!rollValid} onClick={startDraft}>
              {t('levelUp.next')} ›
            </button>
          </div>
        </section>
      )}

      {draft && (step === 'choices' || step === 'summary') && (
        <DraftProvider draft={draft} setDraft={setDraft}>
          {step === 'choices' ? (
            <ChoicesStep
              items={draft.items}
              onBack={() => {
                setDraftState(undefined)
                setStep('hp')
              }}
              onNext={() => setStep('summary')}
            />
          ) : (
            <SummaryStep items={draft.items} onBack={() => setStep('choices')} onConfirm={() => void confirm()} />
          )}
        </DraftProvider>
      )}
    </Dialog>
  )
}

function ChoicesStep({ items, onBack, onNext }: { items: HistoryItem[]; onBack: () => void; onNext: () => void }) {
  const { t } = useTranslation()
  const { content } = useSheet()
  const gained = items.filter((i) => i.type === 'featureGained')
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">{t('levelUp.newFeatures')}</h3>
      {gained.length ? (
        <ul className="mb-4 space-y-1 text-sm">
          {gained.map((i, n) => {
            const e = i.entity ? content.get(i.entity) : undefined
            return (
              <li key={n}>
                <RuleRef entity={e} content={content} className="font-semibold">
                  {String(i.params?.name)}
                </RuleRef>
                {e?.description && <span className="block text-xs text-muted">{e.description}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted">{t('levelUp.noNewFeatures')}</p>
      )}
      <h3 className="mb-1 text-sm font-semibold">{t('levelUp.choices')}</h3>
      <DecisionList />
      <div className="mt-4 flex items-center gap-2">
        <button className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg" onClick={onBack}>
          ‹ {t('levelUp.back')}
        </button>
        <button className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text" onClick={onNext}>
          {t('levelUp.next')} ›
        </button>
      </div>
    </section>
  )
}

function SummaryStep({ items, onBack, onConfirm }: { items: HistoryItem[]; onBack: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const { open } = useDecisions()
  return (
    <section>
      <ul className="space-y-0.5 text-sm">
        {items.map((i, n) => (
          <li key={n}>• {itemText(t, i)}</li>
        ))}
      </ul>
      {open > 0 && <p className="mt-3 rounded border border-accent/60 bg-accent/5 p-2 text-sm">⚠️ {t('levelUp.stillOpen', { count: open })}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg" onClick={onBack}>
          ‹ {t('levelUp.back')}
        </button>
        <button className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text" onClick={onConfirm}>
          ✅ {t('levelUp.confirm')}
        </button>
      </div>
    </section>
  )
}
