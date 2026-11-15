// The form of a stat block (familiar, steed, companion, summon, Wild Shape form) with a live preview.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { abilities, Creature, skills } from '../../content/schema'
import { viewCreature } from '../../engine/creatures'
import { Card } from '../Card'
import { StatBlock } from '../creatures/StatBlock'
import { Check, Field, Label, Multi, Num, Rows, ScaledInput, Select, Text, Area } from './fields'
import { More } from './MechanicRows'
import { CONDITIONS, CREATURE_TYPES, DAMAGE_TYPES, SENSES, SPEED_MODES } from './targets'
import { ACTION_TYPES, grid } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }))
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
/** A record edited as rows: { key: value } ↔ [{ key, value }]. */
const toRows = (r: Raw | undefined) => Object.entries(r ?? {}).map(([key, value]) => ({ key, value }))
const fromRows = (rows: Raw[]) => Object.fromEntries(rows.filter((x) => x.key).map((x) => [x.key, x.value]))

export function CreatureFields({ draft, set }: { draft: Raw; set: (p: Raw) => void }) {
  const { t } = useTranslation()
  const tags: string[] = draft.tags ?? []
  const setTag = (tag: string, on: boolean) => set({ tags: on ? [...tags.filter((x) => x !== tag), tag] : tags.filter((x) => x !== tag) })
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
      <Card>
        <div className="space-y-2">
          <div className={grid}>
            <Field label={t('homebrew.f.size')}>
              <Select value={draft.size} onChange={(v) => set({ size: v ?? 'Medium' })} options={opts(SIZES)} />
            </Field>
            <Field label={t('homebrew.f.creatureType')}>
              <Select value={draft.creatureType} onChange={(v) => set({ creatureType: v ?? 'beast' })} options={opts(CREATURE_TYPES)} />
            </Field>
            <Field label="CR" help="creature.cr" hint="0.25 = 1/4">
              <Num value={draft.cr} onChange={(v) => set({ cr: v ?? 0 })} />
            </Field>
            <Field label={t('homebrew.f.hitDice')} hint="2d8">
              <Text value={draft.hitDice} onChange={(v) => set({ hitDice: v || undefined })} />
            </Field>
            <Field label="AC" help="creature.ac">
              <ScaledInput value={draft.ac} onChange={(v) => set({ ac: v ?? 10 })} placeholder="13, 11 + slot" preview={false} />
            </Field>
            <Field label="HP" help="creature.hp">
              <ScaledInput value={draft.hp} onChange={(v) => set({ hp: v ?? 1 })} placeholder="10, 5 * level" preview={false} />
            </Field>
          </div>
          <div>
            <Label text={t('homebrew.f.speeds')} help="creature.speed" />
            <div className="grid gap-2 sm:grid-cols-5">
              {['walk', ...SPEED_MODES].map((m) => (
                <Field key={m} label={t(`homebrew.speedMode.${m}`)}>
                  <ScaledInput value={draft.speed?.[m]} onChange={(v) => set({ speed: Object.fromEntries(Object.entries({ ...draft.speed, [m]: v }).filter(([, x]) => x !== undefined)) })} preview={false} />
                </Field>
              ))}
            </div>
          </div>
          <div>
            <span className="flex items-center gap-3">
              <Label text={t('homebrew.f.scores')} help="creature.scores" />
              <Check value={!draft.scores} onChange={(v) => set({ scores: v ? undefined : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })} label={t('homebrew.f.noScores')} />
            </span>
            {draft.scores && (
              <div className="grid grid-cols-6 gap-1">
                {abilities.map((a) => (
                  <Field key={a} label={a.toUpperCase()}>
                    <Num value={draft.scores[a]} onChange={(v) => set({ scores: { ...draft.scores, [a]: v ?? 10 } })} />
                  </Field>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check value={tags.includes('summon')} onChange={(v) => setTag('summon', v)} label={t('homebrew.f.tagSummon')} help="creature.tags" />
            <Check value={tags.includes('companion')} onChange={(v) => setTag('companion', v)} label={t('homebrew.f.tagCompanion')} help="creature.tags" />
          </div>
          <Rows
            title={t('homebrew.f.traitsList')}
            help="creature.traits"
            rows={draft.traits as Raw[]}
            onChange={(v) => set({ traits: v })}
            make={() => ({ name: '', description: '' })}
            summary={(r) => r.name || '…'}
            render={(r, setR) => (
              <div className="space-y-1">
                <Field label={t('homebrew.f.name')}>
                  <Text value={r.name} onChange={(v) => setR({ ...r, name: v })} />
                </Field>
                <Area value={r.description} onChange={(v) => setR({ ...r, description: v })} rows={2} />
              </div>
            )}
          />
          <Rows
            title={t('homebrew.f.creatureActions')}
            help="creature.actions"
            rows={draft.actions as Raw[]}
            onChange={(v) => set({ actions: v })}
            make={() => ({ name: '', actionType: 'action', description: '', attack: { bonus: 'spellAttack', range: 'reach 5 ft.' }, damage: [{ dice: '1d8', bonus: 0, type: 'piercing' }] })}
            summary={(a) => `${a.name || '…'}${a.attack ? ` · ${String(a.attack.bonus)}` : ''}${(a.damage as Raw[] | undefined)?.length ? ` · ${(a.damage as Raw[]).map((d) => `${typeof d.dice === 'string' ? d.dice : '?'} ${d.type}`).join(' + ')}` : ''}`}
            render={(a, setA) => <CreatureActionFields a={a} setA={setA} />}
          />
          <More>
            <div className={grid}>
              <Field label={t('homebrew.f.languages')}>
                <Text value={draft.languages} onChange={(v) => set({ languages: v })} />
              </Field>
              <Field label={t('homebrew.f.passivePerception')}>
                <ScaledInput value={draft.passivePerception} onChange={(v) => set({ passivePerception: v })} preview={false} />
              </Field>
            </div>
            <Field label={t('statBlock.resistances')}>
              <Multi value={draft.resistances} onChange={(v) => set({ resistances: v })} options={opts(DAMAGE_TYPES)} />
            </Field>
            <Field label={t('statBlock.immunities')}>
              <Multi value={draft.immunities} onChange={(v) => set({ immunities: v })} options={opts(DAMAGE_TYPES)} />
            </Field>
            <Field label={t('statBlock.conditionImmunities')}>
              <Multi value={draft.conditionImmunities} onChange={(v) => set({ conditionImmunities: v })} options={opts(CONDITIONS)} />
            </Field>
            <KeyValues title={t('statBlock.saves')} value={draft.saves} onChange={(saves) => set({ saves })} keys={[...abilities]} />
            <KeyValues title={t('statBlock.skills')} value={draft.skills} onChange={(v) => set({ skills: v })} keys={Object.keys(skills)} />
            <KeyValues title={t('statBlock.senses')} value={draft.senses} onChange={(senses) => set({ senses })} keys={SENSES} />
          </More>
        </div>
      </Card>
      <CreaturePreview draft={draft} />
    </div>
  )
}

function KeyValues({ title, value, onChange, keys }: { title: string; value: Raw | undefined; onChange: (v: Raw) => void; keys: string[] }) {
  return (
    <Rows
      title={title}
      rows={toRows(value)}
      onChange={(rows) => onChange(fromRows(rows))}
      make={() => ({ key: keys.find((k) => !(value ?? {})[k]) ?? keys[0], value: 2 })}
      render={(r, setR) => (
        <div className="grid grid-cols-2 gap-2">
          <Select value={r.key} onChange={(v) => setR({ ...r, key: v ?? r.key })} options={opts(keys)} />
          <ScaledInput value={r.value} onChange={(v) => setR({ ...r, value: v ?? 0 })} preview={false} />
        </div>
      )}
    />
  )
}

function CreatureActionFields({ a, setA }: { a: Raw; setA: (a: Raw) => void }) {
  const { t } = useTranslation()
  const dmg = (a.damage as Raw[] | undefined) ?? []
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label={t('homebrew.f.name')}>
          <Text value={a.name} onChange={(v) => setA({ ...a, name: v })} />
        </Field>
        <Field label={t('homebrew.f.actionType')}>
          <Select value={a.actionType} onChange={(v) => setA({ ...a, actionType: v ?? 'action' })} options={ACTION_TYPES.filter((x) => x !== 'other').map((x) => ({ value: x, label: t(`homebrew.action.${x}`) }))} />
        </Field>
        <Field label={t('homebrew.f.attackBonus')} hint="spellAttack, 4 + pb">
          <ScaledInput value={a.attack?.bonus} onChange={(v) => setA({ ...a, attack: v === undefined ? undefined : { ...a.attack, bonus: v } })} preview={false} />
        </Field>
        {a.attack && (
          <Field label={t('homebrew.f.range')}>
            <Text value={a.attack.range} onChange={(v) => setA({ ...a, attack: { ...a.attack, range: v || undefined } })} placeholder="reach 5 ft." />
          </Field>
        )}
        <Field label={t('homebrew.m.saveDc')} hint="spellDc">
          <ScaledInput value={a.save?.dc} onChange={(v) => setA({ ...a, save: v === undefined ? undefined : { ability: a.save?.ability ?? 'dex', dc: v } })} preview={false} />
        </Field>
        {a.save && (
          <Field label={t('homebrew.m.saveAbility')}>
            <Select value={a.save.ability} onChange={(v) => setA({ ...a, save: { ...a.save, ability: v ?? 'dex' } })} options={abilities.map((x) => ({ value: x, label: x.toUpperCase() }))} />
          </Field>
        )}
        <Field label={t('homebrew.f.usesMax')} hint="3">
          <ScaledInput value={a.uses?.max} onChange={(v) => setA({ ...a, uses: v === undefined ? undefined : { recharge: a.uses?.recharge ?? 'longRest', max: v } })} preview={false} />
        </Field>
        {a.uses && (
          <Field label={t('homebrew.m.recharge')}>
            <Select value={a.uses.recharge} onChange={(v) => setA({ ...a, uses: { ...a.uses, recharge: v ?? 'longRest' } })} options={['shortRest', 'longRest', 'roll'].map((x) => ({ value: x, label: t(`homebrew.usesRecharge.${x}`) }))} />
          </Field>
        )}
      </div>
      <Rows
        title={t('homebrew.f.damageParts')}
        rows={dmg}
        onChange={(v) => setA({ ...a, damage: v })}
        make={() => ({ dice: '1d6', bonus: 0, type: 'piercing' })}
        render={(d, setD) => (
          <div className="grid grid-cols-3 gap-2">
            <Text value={typeof d.dice === 'string' ? d.dice : JSON.stringify(d.dice)} onChange={(v) => setD({ ...d, dice: v })} placeholder="1d8" />
            <ScaledInput value={d.bonus} onChange={(v) => setD({ ...d, bonus: v ?? 0 })} placeholder="3 + slot" preview={false} />
            <Select value={d.type} onChange={(v) => setD({ ...d, type: v ?? 'piercing' })} options={opts([...DAMAGE_TYPES, '@choice'])} />
          </div>
        )}
      />
      <Area value={a.description} onChange={(v) => setA({ ...a, description: v })} rows={2} />
    </div>
  )
}

/** The stat block as it will show, computed with owner numbers picked here. */
function CreaturePreview({ draft }: { draft: Raw }) {
  const { t } = useTranslation()
  const [level, setLevel] = useState(5)
  const [slot, setSlot] = useState(3)
  const parsed = Creature.safeParse(draft)
  const pb = 2 + Math.floor((level - 1) / 4)
  const vars = { level, classLevel: level, characterLevel: level, pb, slot, str: 0, dex: 2, con: 1, int: 0, wis: 3, cha: 3, spellAttack: pb + 3, spellDc: 8 + pb + 3 }
  return (
    <Card>
      <div className="sticky top-2 space-y-2">
        <h3 className="flex items-center gap-1 font-heading font-semibold">
          <Label text={t('homebrew.f.preview')} help="creature.preview" />
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1">
            {t('homebrew.f.ownerLevel')}
            <input type="range" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
            <span className="tabular-nums">{level}</span>
          </label>
          <label className="flex items-center gap-1">
            {t('homebrew.f.slotLevel')}
            <input type="range" min={1} max={9} value={slot} onChange={(e) => setSlot(Number(e.target.value))} />
            <span className="tabular-nums">{slot}</span>
          </label>
        </div>
        <p className="text-[11px] text-muted">{t('homebrew.f.previewVars', { pb, attack: vars.spellAttack, dc: vars.spellDc })}</p>
        {parsed.success ? <StatBlock view={viewCreature(parsed.data, vars)} /> : <p className="text-xs text-danger">{parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}</p>}
      </div>
    </Card>
  )
}
