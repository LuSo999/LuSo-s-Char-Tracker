// Forms of the mechanics rows other than effects: resources, actions, choices, granted spells,
// creatures (companions / summons) and natural attacks.
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, skills } from '../../content/schema'
import { slug } from '../../engine/homebrew'
import { Check, Field, IdList, Label, Multi, Num, ScaledInput, Segmented, Select, Text } from './fields'
import type { HelpId } from './help/text.en'
import { COMPANION_KINDS, CREATURE_TYPES, DAMAGE_TYPES } from './targets'
import { ACTION_TYPES, grid } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }))
const abilityOpts = abilities.map((x) => ({ value: x, label: x.toUpperCase() }))
const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation']
const SPELL_CLASSES = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
const commaList = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** "More options": advanced fields folded away so the common ones stay readable. */
export function More({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <details className="rounded border border-dashed border-border px-2 py-1">
      <summary className="cursor-pointer text-xs text-muted">{t('homebrew.m.more')}</summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  )
}

const RECHARGES = ['short', 'long', 'dawn', 'none'] as const
const rechargeOf = (r: Raw) => (r.recharge?.length === 2 ? 'short' : r.recharge?.[0]?.on === 'longRest' ? 'long' : r.recharge?.[0]?.on === 'dawn' ? 'dawn' : 'none')
const rechargeFor = (v: string | undefined) =>
  v === 'short' ? [{ on: 'shortRest', amount: 'all' }, { on: 'longRest', amount: 'all' }] : v === 'long' ? [{ on: 'longRest', amount: 'all' }] : v === 'dawn' ? [{ on: 'dawn', amount: 'all' }] : []

export function ResourceFields({ r, setR }: { r: Raw; setR: (r: Raw) => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label={t('homebrew.f.name')} help="resource.name">
          <Text value={r.name} onChange={(v) => setR({ ...r, name: v, id: r.id?.startsWith('res-') || r.id === slug(r.name ?? '') ? slug(v) || r.id : r.id })} />
        </Field>
        <Field label={t('homebrew.m.max')} help="resource.max">
          <ScaledInput value={r.max} onChange={(v) => setR({ ...r, max: v ?? 1 })} placeholder="3, pb, cha" />
        </Field>
        <Field label={t('homebrew.m.die')} help="resource.die" hint="6 = d6">
          <ScaledInput value={r.die} onChange={(v) => setR({ ...r, die: v })} preview={false} />
        </Field>
        <Field label={t('homebrew.m.recharge')} help="resource.recharge">
          <Select value={rechargeOf(r)} onChange={(v) => setR({ ...r, recharge: rechargeFor(v) })} options={RECHARGES.map((x) => ({ value: x, label: t(`homebrew.recharge.${x}`) }))} />
        </Field>
      </div>
      <More>
        <div className={grid}>
          <Field label="id" help="resource.id">
            <Text value={r.id} onChange={(v) => setR({ ...r, id: slug(v) })} />
          </Field>
          <Field label={t('homebrew.m.resetWith')} help="resource.resetWith">
            <Text value={r.resetWith} onChange={(v) => setR({ ...r, resetWith: v || undefined })} placeholder="Raging" />
          </Field>
          <Check value={r.hidden} onChange={(v) => setR({ ...r, hidden: v || undefined })} label={t('homebrew.m.hidden')} help="resource.hidden" />
        </div>
      </More>
    </div>
  )
}

export function ActivityFields({ a, setA }: { a: Raw; setA: (a: Raw) => void }) {
  const { t } = useTranslation()
  const costs = (a.cost as Raw[] | undefined) ?? []
  const setCost = (i: number, c: Raw | undefined) => setA({ ...a, cost: c ? costs.map((x, j) => (j === i ? c : x)) : costs.filter((_, j) => j !== i) })
  const restore = (a.restore as Raw[] | undefined) ?? []
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label={t('homebrew.f.name')} help="activity.name">
          <Text value={a.name} onChange={(v) => setA({ ...a, name: v })} />
        </Field>
        <Field label={t('homebrew.f.actionType')} help="activity.actionType">
          <Select value={a.actionType} onChange={(v) => setA({ ...a, actionType: v ?? 'action' })} options={ACTION_TYPES.map((x) => ({ value: x, label: t(`homebrew.action.${x}`) }))} />
        </Field>
        <Field label={t('homebrew.m.rollKind')} help="activity.roll">
          <Select value={a.roll?.kind} onChange={(v) => setA({ ...a, roll: v ? { ...a.roll, kind: v } : undefined })} options={['damage', 'heal', 'temp', 'other'].map((x) => ({ value: x, label: t(`homebrew.roll.${x}`) }))} empty="—" />
        </Field>
        {a.roll && (
          <>
            <Field label={t('homebrew.m.dice')} help="activity.dice" hint="2d6">
              <Text value={typeof a.roll.dice === 'string' ? a.roll.dice : a.roll.dice ? JSON.stringify(a.roll.dice) : ''} onChange={(v) => setA({ ...a, roll: { ...a.roll, dice: parseDice(v) } })} />
            </Field>
            <Field label={t('homebrew.m.bonus')} help="activity.bonus">
              <ScaledInput value={a.roll.bonus} onChange={(v) => setA({ ...a, roll: { ...a.roll, bonus: v } })} placeholder="pb, wis, level" />
            </Field>
          </>
        )}
        <Field label={t('homebrew.m.saveDc')} help="activity.saveDc">
          <ScaledInput value={a.saveDc} onChange={(v) => setA({ ...a, saveDc: v })} placeholder="8 + pb + wis" />
        </Field>
        <Field label={t('homebrew.m.saveAbility')} help="activity.saveAbility">
          <Select value={a.saveAbility} onChange={(v) => setA({ ...a, saveAbility: v })} options={abilityOpts} empty="—" />
        </Field>
      </div>
      <div className="space-y-1">
        {costs.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <Field label={t('homebrew.m.cost')} help="activity.cost">
              <Text value={c.resource} list="hb-pools" onChange={(v) => setCost(i, { ...c, resource: v })} />
            </Field>
            <Field label={t('homebrew.m.costAmount')} help="activity.costAmount">
              <Num value={c.amount} onChange={(v) => setCost(i, { ...c, amount: v ?? 1 })} />
            </Field>
            <button type="button" className="pb-1 text-danger" aria-label={t('homebrew.removeRow')} onClick={() => setCost(i, undefined)}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => setA({ ...a, cost: [...costs, { resource: '', amount: 1 }] })}>
          ➕ {t('homebrew.m.addCost')}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Check value={a.spendInput} onChange={(v) => setA({ ...a, spendInput: v })} label={t('homebrew.m.spendInput')} help="activity.spendInput" />
        <Check value={a.attack} onChange={(v) => setA({ ...a, attack: v })} label={t('homebrew.m.onHit')} help="activity.attack" />
      </div>
      <Field label={t('homebrew.m.summary')} help="activity.summary">
        <Text value={a.summary} onChange={(v) => setA({ ...a, summary: v || undefined })} />
      </Field>
      <More>
        <div className={grid}>
          <Field label={t('homebrew.m.toggle')} help="activity.toggle">
            <Text value={a.toggle} onChange={(v) => setA({ ...a, toggle: v || undefined })} placeholder="Raging" />
          </Field>
          <Field label={t('homebrew.m.endsWith')} help="activity.endsWith">
            <Text value={a.endsWith} onChange={(v) => setA({ ...a, endsWith: v || undefined })} />
          </Field>
          <Field label={t('homebrew.m.perTurn')} help="activity.perTurn">
            <Num value={a.perTurn} onChange={(v) => setA({ ...a, perTurn: v })} />
          </Field>
          <Field label={t('homebrew.m.activityMinLevel')} help="activity.minLevel">
            <Num value={a.minLevel} onChange={(v) => setA({ ...a, minLevel: v })} />
          </Field>
          <Field label={t('homebrew.m.restore')} help="activity.restore">
            <Text value={restore[0]?.resource} list="hb-pools" onChange={(v) => setA({ ...a, restore: v ? [{ resource: v, amount: restore[0]?.amount ?? 1, upTo: restore[0]?.upTo ?? false }] : [] })} />
          </Field>
          {restore[0] && (
            <Field label={t('homebrew.m.restoreAmount')}>
              <ScaledInput value={restore[0].amount} onChange={(v) => setA({ ...a, restore: [{ ...restore[0], amount: v ?? 1 }] })} placeholder="1, all" />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Check value={a.slotCost} onChange={(v) => setA({ ...a, slotCost: v })} label={t('homebrew.m.slotCost')} help="activity.slotCost" />
          <Check value={a.grants === 'action'} onChange={(v) => setA({ ...a, grants: v ? 'action' : undefined })} label={t('homebrew.m.grants')} help="activity.grants" />
          <Check value={a.costsAttack} onChange={(v) => setA({ ...a, costsAttack: v })} label={t('homebrew.m.costsAttack')} help="activity.costsAttack" />
        </div>
      </More>
    </div>
  )
}

/** "2d6", or a JSON { count, die } for scaling dice. */
function parseDice(v: string): unknown {
  const s = v.trim()
  if (!s) return undefined
  if (s.startsWith('{')) {
    try {
      return JSON.parse(s)
    } catch {
      return s
    }
  }
  return s
}

const CHOICE_KINDS = ['entity', 'skill', 'ability', 'abilityPoints', 'spell', 'option', 'language', 'tool', 'weaponMastery', 'subclass'] as const
const ENTITY_TYPES = ['feat', 'feature', 'spell', 'item', 'species', 'background']

export function ChoiceFields({ c, setC, content, entityOptions }: { c: Raw; setC: (c: Raw) => void; content?: ContentIndex; entityOptions: { value: string; label: string }[] }) {
  const { t } = useTranslation()
  const skillOpts = Object.keys(skills).map((s) => ({ value: s, label: content?.get(`skill-${s}`)?.name ?? s }))
  const byList = c.kind === 'entity' && !c.from?.type
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label={t('homebrew.m.choiceLabel')} help="choice.label">
          <Text value={c.label} onChange={(v) => setC({ ...c, label: v, id: c.id?.startsWith('choice-') || c.id === slug(c.label ?? '') ? slug(v) || c.id : c.id })} />
        </Field>
        <Field label={t('homebrew.m.choiceKind')} help={`choice.kind.${c.kind}` as HelpId}>
          <Select value={c.kind} onChange={(v) => setC({ id: c.id, label: c.label, count: c.count, changeable: c.changeable, kind: v ?? 'option' })} options={CHOICE_KINDS.map((k) => ({ value: k, label: t(`homebrew.choiceKind.${k}`) }))} />
        </Field>
        {c.kind !== 'abilityPoints' && (
          <Field label={t('homebrew.m.choiceCount')} help="choice.count">
            <ScaledInput value={c.count ?? 1} onChange={(v) => setC({ ...c, count: v ?? 1 })} preview={false} />
          </Field>
        )}
        <Field label={t('homebrew.m.changeable')} help="choice.changeable">
          <Select value={c.changeable ?? 'never'} onChange={(v) => setC({ ...c, changeable: v })} options={['never', 'levelUp', 'shortRest', 'longRest'].map((x) => ({ value: x, label: t(`homebrew.changeable.${x}`) }))} />
        </Field>
      </div>
      {c.kind === 'entity' && (
        <div className="space-y-1">
          <Segmented
            value={byList ? 'list' : 'type'}
            onChange={(v) => setC({ ...c, from: v === 'list' ? { ids: c.from?.ids ?? [] } : { type: 'feat', tags: [] } })}
            options={[
              { value: 'list', label: t('homebrew.m.fromList') },
              { value: 'type', label: t('homebrew.m.fromType') },
            ]}
          />
          {byList ? (
            <Field label={t('homebrew.m.fromIds')} help="choice.from">
              <IdList value={c.from?.ids} onChange={(ids) => setC({ ...c, from: { ids } })} options={entityOptions} />
            </Field>
          ) : (
            <div className={grid}>
              <Field label={t('homebrew.m.fromTypeLabel')} help="choice.from">
                <Select value={c.from?.type} onChange={(v) => setC({ ...c, from: { ...c.from, type: v } })} options={ENTITY_TYPES.map((x) => ({ value: x, label: t(`homebrew.types.${x}`, { defaultValue: x }) }))} />
              </Field>
              <Field label={t('homebrew.m.fromTags')} hint={t('homebrew.f.commaList')}>
                <Text value={(c.from?.tags ?? []).join(', ')} onChange={(v) => setC({ ...c, from: { ...c.from, tags: commaList(v) } })} placeholder="fighting-style" />
              </Field>
            </div>
          )}
        </div>
      )}
      {c.kind === 'skill' && (
        <>
          <Field label={t('homebrew.m.options')} help="choice.options">
            <Multi value={c.options} onChange={(v) => setC({ ...c, options: v })} options={skillOpts} />
          </Field>
          <Check value={c.expertise} onChange={(v) => setC({ ...c, expertise: v || undefined })} label={t('homebrew.m.expertise')} />
        </>
      )}
      {c.kind === 'ability' && (
        <Field label={t('homebrew.m.options')} help="choice.options">
          <Multi value={c.options} onChange={(v) => setC({ ...c, options: v })} options={abilityOpts} />
        </Field>
      )}
      {c.kind === 'abilityPoints' && (
        <div className={grid}>
          <Field label={t('homebrew.m.points')}>
            <Num value={c.points} onChange={(v) => setC({ ...c, points: v })} placeholder="2" />
          </Field>
          <Field label={t('homebrew.m.perOption')}>
            <Num value={c.perOption} onChange={(v) => setC({ ...c, perOption: v })} placeholder="2" />
          </Field>
          <Field label={t('homebrew.m.scoreCap')}>
            <Num value={c.scoreCap} onChange={(v) => setC({ ...c, scoreCap: v })} placeholder="20" />
          </Field>
          <Field label={t('homebrew.m.options')} help="choice.options">
            <Multi value={c.options} onChange={(v) => setC({ ...c, options: v.length ? v : undefined })} options={abilityOpts} />
          </Field>
        </div>
      )}
      {c.kind === 'spell' && (
        <div className="space-y-2">
          <div className={grid}>
            <Field label={t('homebrew.f.spellLevel')}>
              <Num value={c.spellLevel} onChange={(v) => setC({ ...c, spellLevel: v === undefined ? undefined : Math.max(0, Math.min(9, v)) })} />
            </Field>
            <Field label={t('homebrew.m.maxSpellLevel')}>
              <Num value={c.maxSpellLevel} onChange={(v) => setC({ ...c, maxSpellLevel: v })} />
            </Field>
          </div>
          <Field label={t('homebrew.f.classes')}>
            <Multi value={c.spellClasses} onChange={(v) => setC({ ...c, spellClasses: v.length ? v : undefined })} options={opts(SPELL_CLASSES)} />
          </Field>
          <Field label={t('homebrew.f.school')}>
            <Multi value={c.spellSchools} onChange={(v) => setC({ ...c, spellSchools: v.length ? v : undefined })} options={opts(SCHOOLS)} />
          </Field>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check value={c.ritualOnly} onChange={(v) => setC({ ...c, ritualOnly: v || undefined })} label={t('homebrew.m.ritualOnly')} />
            <Check value={c.knownOnly} onChange={(v) => setC({ ...c, knownOnly: v || undefined })} label={t('homebrew.m.knownOnly')} />
            <Check value={c.attackOnly} onChange={(v) => setC({ ...c, attackOnly: v || undefined })} label={t('homebrew.m.attackOnly')} />
          </div>
        </div>
      )}
      {(c.kind === 'option' || c.kind === 'language' || c.kind === 'tool' || c.kind === 'weaponMastery') && (
        <Field label={t('homebrew.m.options')} help="choice.options" hint={t('homebrew.f.commaList')}>
          <Text value={(c.options ?? []).join(', ')} onChange={(v) => setC({ ...c, options: v.trim() ? commaList(v) : undefined })} placeholder={c.kind === 'option' ? 'fire, cold, lightning' : ''} />
        </Field>
      )}
      <p className="text-[11px] text-muted">
        <Label text={`id: ${c.id}`} help="choice.id" className="font-mono" />
      </p>
    </div>
  )
}

export function SpellGrantFields({ g, setG, spellChoiceIds }: { g: Raw; setG: (g: Raw) => void; spellChoiceIds: string[] }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className={grid}>
        {g.fromChoice === undefined ? (
          <Field label={t('homebrew.m.spell')} help="spell.id">
            <Text value={g.id} list="hb-spells" onChange={(v) => setG({ ...g, id: v })} />
          </Field>
        ) : (
          <Field label={t('homebrew.m.fromChoice')} help="spell.fromChoice">
            <Select value={g.fromChoice} onChange={(v) => setG({ ...g, fromChoice: v ?? '' })} options={spellChoiceIds.map((x) => ({ value: x, label: x }))} />
          </Field>
        )}
        <Field label={t('homebrew.m.freeCast')} help="spell.freeCast">
          <Text value={g.freeCast} list="hb-pools" onChange={(v) => setG({ ...g, freeCast: v || undefined })} />
        </Field>
        <Field label={t('homebrew.m.minLevel')} help="spell.minLevel">
          <Num value={g.minLevel} onChange={(v) => setG({ ...g, minLevel: v })} />
        </Field>
        <Field label={t('homebrew.m.ability')} help="spell.ability">
          <Select value={g.ability} onChange={(v) => setG({ ...g, ability: v })} options={abilityOpts} empty="—" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Check value={g.atWill} onChange={(v) => setG({ ...g, atWill: v || undefined })} label={t('homebrew.m.atWill')} help="spell.atWill" />
        {spellChoiceIds.length > 0 && (
          <Check value={g.fromChoice !== undefined} onChange={(v) => setG(v ? { ...g, id: undefined, fromChoice: spellChoiceIds[0] } : { ...g, fromChoice: undefined, id: '' })} label={t('homebrew.m.useChoice')} help="spell.fromChoice" />
        )}
        <Check value={g.freeOnly} onChange={(v) => setG({ ...g, freeOnly: v || undefined })} label={t('homebrew.m.freeOnly')} />
        <Check value={g.ritualOnly} onChange={(v) => setG({ ...g, ritualOnly: v || undefined })} label={t('homebrew.m.ritualOnlyCast')} />
      </div>
    </div>
  )
}

export function CompanionFields({ c, setC, creatures, classes }: { c: Raw; setC: (c: Raw) => void; creatures: { value: string; label: string }[]; classes: { value: string; label: string }[] }) {
  const { t } = useTranslation()
  const adj = (c.adjust as Raw | undefined) ?? {}
  const setAdj = (k: string, v: unknown) => {
    const next = { ...adj, [k]: v }
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key]
    setC({ ...c, adjust: Object.keys(next).length ? next : undefined })
  }
  return (
    <div className="space-y-2">
      <div>
        <Segmented value={c.kind} onChange={(kind) => setC({ ...c, kind })} options={COMPANION_KINDS.map((k) => ({ value: k, label: t(`homebrew.companionKind.${k}`), help: `companion.kind.${k}` as HelpId }))} />
      </div>
      <Field label={t('homebrew.m.creatures')} help="companion.creatures">
        <IdList value={c.creatures} onChange={(v) => setC({ ...c, creatures: v })} options={creatures} />
      </Field>
      <div className={grid}>
        <Field label={t('homebrew.m.filterType')} help="companion.filter">
          <Select value={c.filter?.creatureType} onChange={(v) => setC({ ...c, filter: cleanObj({ ...c.filter, creatureType: v }) })} options={opts(CREATURE_TYPES)} empty="—" />
        </Field>
        <Field label={t('homebrew.m.filterCr')} help="companion.filter">
          <Num value={c.filter?.maxCr} onChange={(v) => setC({ ...c, filter: cleanObj({ ...c.filter, maxCr: v }) })} />
        </Field>
        {c.kind === 'summon' && (
          <Field label={t('homebrew.m.maxCompanions')} help="companion.max">
            <ScaledInput value={c.max} onChange={(v) => setC({ ...c, max: v })} preview={false} />
          </Field>
        )}
        <Check value={c.slot} onChange={(v) => setC({ ...c, slot: v })} label={t('homebrew.m.slot')} help="companion.slot" />
      </div>
      <Field label={t('homebrew.m.companionNote')} help="companion.note">
        <Text value={c.note} onChange={(v) => setC({ ...c, note: v || undefined })} />
      </Field>
      <More>
        <p className="text-sm">
          <Label text={t('homebrew.m.adjust')} help="companion.adjust" />
        </p>
        <div className={grid}>
          {(['ac', 'attack', 'damage', 'hpBonus', 'hpMin', 'hpPerDie', 'tempHp'] as const).map((k) => (
            <Field key={k} label={t(`homebrew.adjust.${k}`)}>
              <ScaledInput value={adj[k]} onChange={(v) => setAdj(k, v)} preview={false} placeholder="pb" />
            </Field>
          ))}
          <Field label={t('homebrew.adjust.hpFactor')}>
            <Num value={adj.hpFactor} onChange={(v) => setAdj('hpFactor', v)} placeholder="0.5" />
          </Field>
        </div>
        <div className={grid}>
          <Field label={t('homebrew.m.chooseLabel')} help="companion.choose">
            <Text value={c.choose?.label} onChange={(v) => setC({ ...c, choose: v ? { options: [], ...c.choose, label: v } : undefined })} placeholder={t('homebrew.m.chooseLabelPh')} />
          </Field>
          {c.choose && (
            <>
              <Field label={t('homebrew.m.options')} hint={t('homebrew.f.commaList')}>
                <Text value={(c.choose.options ?? []).join(', ')} onChange={(v) => setC({ ...c, choose: { ...c.choose, options: commaList(v) } })} placeholder={DAMAGE_TYPES.slice(0, 3).join(', ')} />
              </Field>
              <Check value={c.choose.shareResistance} onChange={(v) => setC({ ...c, choose: { ...c.choose, shareResistance: v || undefined } })} label={t('homebrew.m.shareResistance')} />
            </>
          )}
          <Field label={t('homebrew.m.spellClass')} help="companion.spellClass">
            <Select value={c.spellClass} onChange={(v) => setC({ ...c, spellClass: v })} options={classes} empty="—" />
          </Field>
        </div>
      </More>
    </div>
  )
}

const cleanObj = (o: Raw) => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))
  return Object.keys(out).length ? out : undefined
}

const PROPERTIES = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'thrown', 'two-handed', 'versatile']

export function AttackFields({ a, setA }: { a: Raw; setA: (a: Raw) => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label={t('homebrew.f.name')}>
          <Text value={a.name} onChange={(v) => setA({ ...a, name: v, id: a.id?.startsWith('attack-') ? slug(v) || a.id : a.id })} />
        </Field>
        <Field label={t('homebrew.m.dice')} help="attack.dice">
          <Text value={a.damage?.dice} onChange={(v) => setA({ ...a, damage: { ...a.damage, dice: v } })} />
        </Field>
        <Field label={t('homebrew.f.damageType')}>
          <Select value={a.damage?.type} onChange={(v) => setA({ ...a, damage: { ...a.damage, type: v } })} options={opts(DAMAGE_TYPES)} />
        </Field>
        <Field label={t('homebrew.m.ability')} help="attack.ability">
          <Select value={a.ability} onChange={(v) => setA({ ...a, ability: v })} options={abilityOpts} empty={t('homebrew.m.strDex')} />
        </Field>
        <Field label={t('homebrew.m.while')} help="attack.while">
          <Text value={a.while} onChange={(v) => setA({ ...a, while: v || undefined })} />
        </Field>
        <Field label={t('homebrew.f.weaponRange')}>
          <Select value={a.range ?? 'melee'} onChange={(v) => setA({ ...a, range: v })} options={opts(['melee', 'ranged'])} />
        </Field>
      </div>
      <Field label={t('homebrew.f.properties')}>
        <Multi value={a.properties} onChange={(v) => setA({ ...a, properties: v })} options={opts(PROPERTIES)} />
      </Field>
    </div>
  )
}
