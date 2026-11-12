import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { ContentIndex } from '../../content'
import { abilities, type Ability, type Edition, type EquipmentChoice } from '../../content/schema'
import type { Character } from '../../engine/character'
import {
  buildCharacter,
  gearComplete,
  gearInventory,
  POINT_BUDGET,
  POINT_COST,
  pointsSpent,
  roll4d6,
  STANDARD_ARRAY,
  STANDARD_BY_CLASS,
  startingGear,
  validBackgroundBonuses,
  XP_FOR_LEVEL,
  type Draft,
  type EquipmentSelection,
} from '../../engine/create'
import { computeSheet } from '../../engine/derive'
import { pendingChoices } from '../../engine/levelup'
import { addCharacter } from '../../state/characters'
import { useContent } from '../../state/content'
import { RuleRef } from '../rules/RuleRef'
import { DraftSheet } from '../levelup/DraftSheet'
import { DecisionList } from '../levelup/LevelUpDialog'
import { signed } from '../sheet/format'

type Step = 'basics' | 'class' | 'species' | 'background' | 'abilities' | 'choices' | 'equipment' | 'details'
const STEPS: Step[] = ['basics', 'class', 'species', 'background', 'abilities', 'choices', 'equipment', 'details']

type Method = 'standard' | 'pointBuy' | 'roll'

/** Creating a character step by step; a higher starting level continues with Level up on the sheet. */
export function CreatePage({ uid, onCreate }: { uid: string; onCreate?: (c: Character, levelTo: number) => void }) {
  const { t } = useTranslation()
  const [edition, setEdition] = useState<Edition>('2024')
  const content = useContent(edition)
  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 font-heading text-2xl font-semibold">{t('create.title')}</h1>
      {!content ? <p className="text-muted">{t('loading')}</p> : <Wizard key={edition} uid={uid} edition={edition} setEdition={setEdition} content={content} onCreate={onCreate} />}
    </div>
  )
}

const emptyScores = (): Record<Ability, number> => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })

function Wizard({
  uid,
  edition,
  setEdition,
  content,
  onCreate,
}: {
  uid: string
  edition: Edition
  setEdition: (e: Edition) => void
  content: ContentIndex
  onCreate?: (c: Character, levelTo: number) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('basics')
  const [level, setLevel] = useState(1)
  const classes = content.all('class').filter((c) => c.edition === edition)
  const allSpecies = content.all('species').filter((s) => s.edition === edition)
  const backgrounds = content.all('background').filter((b) => b.edition === edition)
  const [draft, setDraft] = useState<Draft>(() => ({
    edition,
    name: '',
    classId: classes[0]?.id ?? '',
    speciesId: allSpecies[0]?.id ?? '',
    backgroundId: backgrounds[0]?.id ?? '',
    baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    backgroundBonuses: {},
    choices: {},
    spells: {},
    inventory: [],
    gp: 0,
    notes: '',
  }))
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const [method, setMethod] = useState<Method>('standard')
  const [rolls, setRolls] = useState<number[]>([])
  const [gearSel, setGearSel] = useState<{ cls: EquipmentSelection; bg: EquipmentSelection }>({ cls: [], bg: [] })
  const [goldInstead, setGoldInstead] = useState<string>('')
  const [useGold, setUseGold] = useState(false)
  const [saving, setSaving] = useState(false)

  const cls = content.getTyped(draft.classId, 'class')
  const species = content.getTyped(draft.speciesId, 'species')
  const background = content.getTyped(draft.backgroundId, 'background')
  const subspecies = (species?.subspecies ?? []).map((id) => content.getTyped(id, 'subspecies')).filter((s) => !!s)

  // The character as it stands (level 1), for choices and the summary.
  const character = useMemo(() => {
    try {
      return buildCharacter(content, draft)
    } catch {
      return undefined
    }
  }, [content, draft])
  const sheet = useMemo(() => (character ? computeSheet(character, content) : undefined), [character, content])
  const onDraftChange = useCallback((c: Character) => setDraft((d) => ({ ...d, choices: c.choices, spells: c.spells })), [])

  const gear = useMemo(() => {
    if (useGold) return { items: [], gp: Number.parseInt(goldInstead, 10) || 0 }
    const a = cls ? startingGear(cls, gearSel.cls) : { items: [], gp: 0 }
    const b = background ? startingGear(background, gearSel.bg) : { items: [], gp: 0 }
    return { items: [...a.items, ...b.items], gp: a.gp + b.gp }
  }, [cls, background, gearSel, useGold, goldInstead])

  const valid: Record<Step, boolean> = {
    basics: true,
    class: !!cls,
    species: !!species && (subspecies.length === 0 || !!draft.subspeciesId),
    background: !!background && (edition === '2014' || validBackgroundBonuses(background.abilityOptions, draft.backgroundBonuses)),
    abilities: method !== 'pointBuy' || pointsSpent(draft.baseScores) <= POINT_BUDGET,
    choices: true,
    equipment: useGold || ((!cls || gearComplete(cls.startingEquipment, gearSel.cls)) && (!background || gearComplete(background.startingEquipment, gearSel.bg))),
    details: draft.name.trim().length > 0,
  }
  const index = STEPS.indexOf(step)
  const open = character && sheet ? pendingChoices(character, content, sheet).length : 0

  async function create() {
    if (!character) return
    setSaving(true)
    const final = buildCharacter(content, { ...draft, inventory: gearInventory(content, gear), gp: gear.gp })
    if (onCreate) return onCreate({ ...final, xp: XP_FOR_LEVEL[level] }, level)
    const { id: _id, ...rest } = { ...final, xp: XP_FOR_LEVEL[level] }
    void _id
    const id = await addCharacter(uid, rest)
    navigate(`/c/${id}`, { state: level > 1 ? { levelTo: level } : undefined })
  }

  const nav = (
    <div className="mt-5 flex items-center gap-2">
      {index > 0 && (
        <button className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg" onClick={() => setStep(STEPS[index - 1])}>
          ‹ {t('levelUp.back')}
        </button>
      )}
      {step !== 'details' ? (
        <button className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text disabled:opacity-50" disabled={!valid[step]} onClick={() => setStep(STEPS[index + 1])}>
          {t('levelUp.next')} ›
        </button>
      ) : (
        <button className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text disabled:opacity-50" disabled={!valid.details || saving || !STEPS.every((s) => valid[s])} onClick={() => void create()}>
          ✅ {t(level > 1 ? 'create.createAndLevel' : 'create.create', { level })}
        </button>
      )}
    </div>
  )

  const radio = (on: boolean) => `flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${on ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg'}`

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-sm">
      <ol className="mb-4 flex flex-wrap gap-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              className={`rounded-full border px-2 py-0.5 ${s === step ? 'border-accent bg-accent text-accent-text' : 'border-border text-muted'} disabled:opacity-40`}
              disabled={i > index && !STEPS.slice(0, i).every((x) => valid[x])}
              onClick={() => setStep(s)}
            >
              {i + 1}. {t(`create.steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {step === 'basics' && (
        <section className="space-y-3 text-sm">
          <div>
            <h2 className="mb-1 font-semibold">{t('create.edition')}</h2>
            {(['2024', '2014'] as Edition[]).map((e) => (
              <label key={e} className={`${radio(edition === e)} mb-1`}>
                <input type="radio" checked={edition === e} onChange={() => setEdition(e)} />
                <span>
                  <strong>{e === '2024' ? '5.5e (2024)' : '5e (2014)'}</strong>
                  <span className="block text-xs text-muted">{t(`create.editionHint.${e}`)}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="font-semibold">{t('create.startLevel')}</span>
            <input type="number" min={1} max={20} className="w-16 rounded border border-border bg-card px-1.5 py-0.5" value={level} onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          {level > 1 && <p className="text-xs text-muted">{t('create.higherLevelHint', { level })}</p>}
        </section>
      )}

      {step === 'class' && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id}>
              <label className={radio(draft.classId === c.id)}>
                <input type="radio" className="mt-1" checked={draft.classId === c.id} onChange={() => { set({ classId: c.id, choices: {}, spells: {} }); setGearSel((g) => ({ ...g, cls: [] })) }} />
                <span>
                  <RuleRef entity={c} content={content} className="font-semibold">
                    {c.name}
                  </RuleRef>
                  <span className="ml-2 text-xs text-muted">
                    d{c.hitDie} · {c.primaryAbility.map((a) => a.toUpperCase()).join('/')} · {t('create.saves')} {c.savingThrows.map((a) => a.toUpperCase()).join(', ')}
                  </span>
                  {c.description && <span className="block text-xs text-muted">{c.description}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {step === 'species' && (
        <section className="space-y-3">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {allSpecies.map((s) => (
              <li key={s.id}>
                <label className={radio(draft.speciesId === s.id)}>
                  <input type="radio" className="mt-1" checked={draft.speciesId === s.id} onChange={() => set({ speciesId: s.id, subspeciesId: undefined })} />
                  <span>
                    <RuleRef entity={s} content={content} className="font-semibold">
                      {s.name}
                    </RuleRef>
                    <span className="ml-2 text-xs text-muted">
                      {s.size} · {s.speed} ft
                      {s.abilityBonuses.length > 0 && ` · ${s.abilityBonuses.map((b) => `${b.ability.toUpperCase()} ${signed(b.bonus)}`).join(', ')}`}
                    </span>
                    <span className="block text-xs text-muted">{s.traits.map((id) => content.get(id)?.name ?? id).join(', ')}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {subspecies.length > 0 && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">{t('create.subspecies', { species: species?.name })}</h2>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {subspecies.map((s) => (
                  <li key={s.id}>
                    <label className={radio(draft.subspeciesId === s.id)}>
                      <input type="radio" className="mt-1" checked={draft.subspeciesId === s.id} onChange={() => set({ subspeciesId: s.id })} />
                      <span>
                        <RuleRef entity={s} content={content} className="font-semibold">
                          {s.name}
                        </RuleRef>
                        {s.abilityBonuses.length > 0 && <span className="ml-2 text-xs text-muted">{s.abilityBonuses.map((b) => `${b.ability.toUpperCase()} ${signed(b.bonus)}`).join(', ')}</span>}
                        <span className="block text-xs text-muted">{s.description}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {step === 'background' && (
        <section className="space-y-3">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {backgrounds.map((b) => (
              <li key={b.id}>
                <label className={radio(draft.backgroundId === b.id)}>
                  <input type="radio" className="mt-1" checked={draft.backgroundId === b.id} onChange={() => { set({ backgroundId: b.id, backgroundBonuses: {} }); setGearSel((g) => ({ ...g, bg: [] })) }} />
                  <span>
                    <RuleRef entity={b} content={content} className="font-semibold">
                      {b.name}
                    </RuleRef>
                    <span className="block text-xs text-muted">
                      {[
                        b.skills.map((s) => content.get(`skill-${s}`)?.name ?? s).join(', '),
                        b.feat && content.get(b.feat)?.name,
                        b.abilityOptions.length > 0 && b.abilityOptions.map((a) => a.toUpperCase()).join('/'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {edition === '2024' && background && <BackgroundBonuses options={background.abilityOptions} value={draft.backgroundBonuses} onChange={(v) => set({ backgroundBonuses: v })} />}
        </section>
      )}

      {step === 'abilities' && sheet && (
        <AbilitiesStep
          method={method}
          setMethod={(m) => {
            setMethod(m)
            if (m === 'pointBuy') set({ baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } })
            if (m === 'standard') set({ baseScores: suggested(draft.classId) })
            if (m === 'roll') set({ baseScores: emptyScores() })
          }}
          scores={draft.baseScores}
          setScores={(s) => set({ baseScores: s })}
          classId={draft.classId}
          rolls={rolls}
          setRolls={setRolls}
          final={Object.fromEntries(abilities.map((a) => [a, sheet.scores[a].value])) as Record<Ability, number>}
        />
      )}

      {step === 'choices' && character && (
        <DraftSheet character={character} content={content} onChange={onDraftChange}>
          <p className="mb-2 text-xs text-muted">{t('create.choicesHint')}</p>
          <DecisionList />
        </DraftSheet>
      )}

      {step === 'equipment' && (
        <section className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useGold} onChange={(e) => setUseGold(e.target.checked)} />
            {t(edition === '2014' ? 'create.goldInstead2014' : 'create.goldInstead2024')}
            {useGold && <input className="w-20 rounded border border-border bg-card px-1.5 py-0.5" inputMode="numeric" value={goldInstead} onChange={(e) => setGoldInstead(e.target.value.replace(/\D/g, ''))} placeholder="GP" />}
          </label>
          {!useGold && cls && <GearChoices title={cls.name} choices={cls.startingEquipment} fixed={cls.startingItems} gold={cls.startingGold} content={content} value={gearSel.cls} onChange={(v) => setGearSel((g) => ({ ...g, cls: v }))} />}
          {!useGold && background && (
            <GearChoices title={background.name} choices={background.startingEquipment} fixed={background.startingItems} gold={background.startingGold} content={content} value={gearSel.bg} onChange={(v) => setGearSel((g) => ({ ...g, bg: v }))} />
          )}
          <p className="rounded border border-border p-2">
            <strong>{t('create.youGet')}:</strong> {gearText(content, gear.items)}
            {gear.gp > 0 && ` · ${gear.gp} GP`}
          </p>
          {level >= 2 && <p className="text-xs text-muted">{t(edition === '2024' ? 'create.higherGear2024' : 'create.higherGear2014')}</p>}
        </section>
      )}

      {step === 'details' && sheet && (
        <section className="space-y-3 text-sm">
          <label className="block">
            <span className="font-semibold">{t('create.name')}</span>
            <input autoFocus className="mt-1 w-full rounded border border-border bg-card px-2 py-1" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="block">
            <span className="font-semibold">{t('create.notes')}</span>
            <textarea className="mt-1 w-full rounded border border-border bg-card px-2 py-1" rows={3} placeholder={t('create.notesHint')} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <div className="rounded border border-border p-2">
            <p className="font-semibold">{t('create.summary')}</p>
            <p>
              {cls?.name} 1 · {species?.name}
              {draft.subspeciesId && ` (${content.get(draft.subspeciesId)?.name})`} · {background?.name}
            </p>
            <p>
              HP {sheet.hpMax.value} · AC {sheet.ac.value} · {abilities.map((a) => `${a.toUpperCase()} ${sheet.scores[a].value}`).join(' · ')}
            </p>
            {level > 1 && <p className="text-xs text-muted">{t('create.thenLevelUp', { level })}</p>}
            {open > 0 && <p className="text-xs text-accent">⚠️ {t('create.openChoices', { count: open })}</p>}
          </div>
        </section>
      )}

      {nav}
    </div>
  )
}

const suggested = (classId: string): Record<Ability, number> => {
  const row = STANDARD_BY_CLASS[classId] ?? STANDARD_ARRAY
  return Object.fromEntries(abilities.map((a, i) => [a, row[i]])) as Record<Ability, number>
}

function BackgroundBonuses({ options, value, onChange }: { options: Ability[]; value: Partial<Record<Ability, number>>; onChange: (v: Partial<Record<Ability, number>>) => void }) {
  const { t } = useTranslation()
  const ok = validBackgroundBonuses(options, value)
  return (
    <div className="text-sm">
      <h2 className="font-semibold">{t('create.bgBonuses')}</h2>
      <p className="mb-1 text-xs text-muted">{t('create.bgBonusesHint')}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((a) => (
          <span key={a} className="flex items-center gap-1 rounded border border-border px-2 py-0.5">
            <strong className="w-8">{a.toUpperCase()}</strong>
            {[0, 1, 2].map((n) => (
              <button key={n} className={`rounded border px-1.5 text-xs ${(value[a] ?? 0) === n ? 'border-accent bg-accent text-accent-text' : 'border-border'}`} onClick={() => onChange({ ...value, [a]: n })}>
                +{n}
              </button>
            ))}
          </span>
        ))}
        <button className="rounded border border-border px-2 text-xs hover:bg-bg" onClick={() => onChange(Object.fromEntries(options.map((a) => [a, 1])))}>
          +1/+1/+1
        </button>
      </div>
      {!ok && <p className="mt-1 text-xs text-danger">{t('create.bgBonusesInvalid')}</p>}
    </div>
  )
}

function AbilitiesStep({
  method,
  setMethod,
  scores,
  setScores,
  classId,
  rolls,
  setRolls,
  final,
}: {
  method: Method
  setMethod: (m: Method) => void
  scores: Record<Ability, number>
  setScores: (s: Record<Ability, number>) => void
  classId: string
  rolls: number[]
  setRolls: (r: number[]) => void
  final: Record<Ability, number>
}) {
  const { t } = useTranslation()
  const [rollDetail, setRollDetail] = useState<string[]>([])
  // Standard array / rolled values: each value goes to one ability (swap on conflict).
  const pool = method === 'standard' ? STANDARD_ARRAY : rolls
  const assign = (a: Ability, v: number) => {
    const other = abilities.find((x) => x !== a && scores[x] === v)
    setScores({ ...scores, [a]: v, ...(other ? { [other]: scores[a] } : {}) })
  }
  const spent = pointsSpent(scores)
  return (
    <section className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1">
        {(['standard', 'pointBuy', 'roll'] as Method[]).map((m) => (
          <button key={m} className={`rounded-full border px-3 py-1 text-xs ${method === m ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => setMethod(m)}>
            {t(`create.method.${m}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{t(`create.methodHint.${method}`)}</p>
      {method === 'roll' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-border px-2 py-1 text-xs hover:bg-bg"
            onClick={() => {
              const r = Array.from({ length: 6 }, () => roll4d6())
              setRolls(r.map((x) => x.total).sort((a, b) => b - a))
              setRollDetail(r.map((x) => `${x.dice.join('+')} → ${x.total}`))
              const sorted = r.map((x) => x.total).sort((a, b) => b - a)
              setScores(Object.fromEntries(abilities.map((a, i) => [a, sorted[i]])) as Record<Ability, number>)
            }}
          >
            🎲 {t('create.roll4d6')}
          </button>
          <span className="text-xs text-muted">{t('create.orEnter')}</span>
          {rollDetail.length > 0 && <span className="w-full text-xs text-muted">{rollDetail.join(' · ')}</span>}
        </div>
      )}
      {method === 'standard' && (
        <button className="rounded border border-border px-2 py-1 text-xs hover:bg-bg" onClick={() => setScores(suggested(classId))}>
          ✨ {t('create.suggest')}
        </button>
      )}
      {method === 'pointBuy' && (
        <p className={spent > POINT_BUDGET ? 'text-danger' : ''}>
          {t('create.points', { spent, budget: POINT_BUDGET })}
        </p>
      )}
      <table className="w-full max-w-md text-left">
        <thead className="text-xs text-muted">
          <tr>
            <th />
            <th>{t('create.base')}</th>
            <th>{t('create.final')}</th>
            <th>{t('create.mod')}</th>
          </tr>
        </thead>
        <tbody>
          {abilities.map((a) => (
            <tr key={a}>
              <td className="py-0.5 font-semibold">{a.toUpperCase()}</td>
              <td>
                {method === 'pointBuy' ? (
                  <span className="flex items-center gap-1">
                    <button className="rounded border border-border px-1.5 disabled:opacity-30" disabled={scores[a] <= 8} onClick={() => setScores({ ...scores, [a]: scores[a] - 1 })}>
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{scores[a]}</span>
                    <button
                      className="rounded border border-border px-1.5 disabled:opacity-30"
                      disabled={scores[a] >= 15 || spent - POINT_COST[scores[a]] + POINT_COST[scores[a] + 1] > POINT_BUDGET}
                      onClick={() => setScores({ ...scores, [a]: scores[a] + 1 })}
                    >
                      +
                    </button>
                  </span>
                ) : method === 'roll' && rolls.length === 0 ? (
                  <input className="w-14 rounded border border-border bg-card px-1" inputMode="numeric" value={scores[a]} onChange={(e) => setScores({ ...scores, [a]: Math.min(18, Math.max(3, Number(e.target.value.replace(/\D/g, '')) || 3)) })} />
                ) : (
                  <select className="rounded border border-border bg-card px-1" value={scores[a]} onChange={(e) => assign(a, Number(e.target.value))}>
                    {[...new Set([...pool, scores[a]])].sort((x, y) => y - x).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="font-semibold tabular-nums">{final[a]}</td>
              <td className="tabular-nums">{signed(Math.floor((final[a] - 10) / 2))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const gearText = (content: ContentIndex, items: { id: string; count: number }[]) =>
  items.map((it) => `${it.count > 1 ? `${it.count}× ` : ''}${content.get(it.id)?.name ?? it.id}`).join(', ') || '—'

function GearChoices({
  title,
  choices,
  fixed,
  gold,
  content,
  value,
  onChange,
}: {
  title: string
  choices: EquipmentChoice[]
  fixed: { id: string; count: number }[]
  gold: number
  content: ContentIndex
  value: EquipmentSelection
  onChange: (v: EquipmentSelection) => void
}) {
  const { t } = useTranslation()
  const sel = (i: number) => value[i] ?? { option: 0, picks: [] }
  const update = (i: number, s: EquipmentSelection[number]) => {
    const next = choices.map((_, j) => (j === i ? s : sel(j)))
    onChange(next)
  }
  if (!choices.length && !fixed.length && !gold) return null
  return (
    <div>
      <h2 className="mb-1 font-semibold">{title}</h2>
      {(fixed.length > 0 || gold > 0) && (
        <p className="mb-1 text-xs">
          {t('create.always')}: {gearText(content, fixed)}
          {gold > 0 && ` · ${gold} GP`}
        </p>
      )}
      {choices.map((c, i) => (
        <div key={i} className="mb-2 rounded border border-border p-2">
          {c.options.length > 1 &&
            c.options.map((o, oi) => (
              <label key={oi} className="flex cursor-pointer items-start gap-2 py-0.5">
                <input type="radio" className="mt-1" checked={sel(i).option === oi} onChange={() => update(i, { option: oi, picks: [] })} />
                <span>
                  <strong>{String.fromCharCode(65 + oi)}.</strong> {[gearText(content, o.items) !== '—' ? gearText(content, o.items) : '', ...o.picks.map((p) => `${p.count > 1 ? `${p.count}× ` : ''}${p.label}`), o.gp ? `${o.gp} GP` : ''].filter(Boolean).join(', ')}
                </span>
              </label>
            ))}
          {c.options.length === 1 && <p>{[gearText(content, c.options[0].items) !== '—' ? gearText(content, c.options[0].items) : '', c.options[0].gp ? `${c.options[0].gp} GP` : ''].filter(Boolean).join(', ')}</p>}
          {(c.options[sel(i).option]?.picks ?? []).map((p, pi) => (
            <div key={pi} className="mt-1 flex flex-wrap items-center gap-1 pl-6">
              <span className="text-xs text-muted">{p.label}:</span>
              {Array.from({ length: p.count }, (_, k) => (
                <select
                  key={k}
                  className="rounded border border-border bg-card px-1 text-xs"
                  value={sel(i).picks[pi]?.[k] ?? ''}
                  onChange={(e) => {
                    const picks = [...sel(i).picks]
                    const list = [...(picks[pi] ?? [])]
                    list[k] = e.target.value
                    picks[pi] = list.filter(Boolean)
                    update(i, { option: sel(i).option, picks })
                  }}
                >
                  <option value="">—</option>
                  {p.from.map((id) => (
                    <option key={id} value={id}>
                      {content.get(id)?.name ?? id}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
