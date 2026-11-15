// The form of one effect row: what it changes (target picker), how (op, value), when, and a note.
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { EffectWhen } from '../../content/schema'
import { argLabel, type Ctx } from './describe'
import { Field, Label, ScaledInput, Segmented, Num, Text } from './fields'
import { input } from './ui'
import { Help } from './help/Help'
import type { HelpId } from './help/text.en'
import { CATEGORIES, COMPANION_KINDS, FAMILIES, familyById, formatTarget, paramOptions, parseTarget, type Category, type Family, type Op, type Param } from './targets'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const WHEN_GROUPS: Record<'armor' | 'weapons' | 'other', string[]> = {
  armor: ['wearingArmor', 'wearingHeavyArmor', 'wearingMediumArmor', 'noArmor', 'noShield', 'wieldingShield', 'noArmorNoShield', 'notHeavyArmor', 'noMediumOrHeavyArmor'],
  weapons: ['meleeWeapon', 'rangedWeapon', 'weaponAttack', 'heavyWeapon', 'thrownWeapon', 'magicWeapon', 'strengthAttack', 'martialArts', 'emptyHands'],
  other: ['bloodied', 'notProficient'],
}

/** Values offered for a parameter, with "picked in a choice" placeholders where they make sense. */
function paramChoices(p: Param, ctx: Ctx, choiceIds: string[], profKind?: string): { value: string; label: string }[] {
  const base = paramOptions(p, profKind).map((v) => ({ value: v, label: argLabel(p === 'profId' ? (profKind === 'skill' ? 'skill' : profKind === 'save' ? 'ability' : undefined) : p, v, ctx) }))
  const picks = ['ability', 'abilityAll', 'skill', 'damage', 'condition', 'profId', 'spell', 'weapon', 'creature'].includes(p) ? choiceIds.map((id) => ({ value: `@${id}`, label: ctx.t('homebrew.d.picked', { choice: id }) })) : []
  return [...base, ...picks]
}

/**
 * Pick an effect target: a category, then a concrete thing with a human label, then its
 * parameters. Every option explains itself on Ctrl+hover. "Custom" keeps any raw string.
 */
export function TargetPicker({
  value,
  onChange,
  content,
  choiceIds,
  nested = false,
}: {
  value: string
  onChange: (target: string, family?: Family) => void
  content?: ContentIndex
  choiceIds: string[]
  /** Inside "Allies": no creatures / allies again. */
  nested?: boolean
}) {
  const { t } = useTranslation()
  const ctx: Ctx = { t, content }
  const parsed = parseTarget(value)
  const fam = parsed.family
  const custom = !fam && value !== ''
  const category: Category | 'custom' = custom ? 'custom' : (fam?.category ?? 'numbers')
  const cats = CATEGORIES.filter((c) => !nested || (c !== 'companions' && c !== 'allies'))
  const pickFamily = (f: Family) => {
    const args = f.params.map((p, i) => (i === 1 ? (paramOptions(p, paramOptions(f.params[0])[0])[0] ?? '') : (paramOptions(p)[0] ?? '')))
    if (f.id === 'ally') args[0] = 'save:all'
    if (f.id === 'companion') args[0] = 'ac'
    onChange(formatTarget(f.id, args, f.id === 'companion' ? parsed.group : undefined), f)
  }
  const setArg = (i: number, v: string) => {
    if (!fam) return
    const args = [...parsed.args]
    args[i] = v
    // A new proficiency kind resets the id to one of its options.
    if (fam.id === 'proficiency' && i === 0) args[1] = paramOptions('profId', v)[0] ?? ''
    onChange(formatTarget(fam.id, args, parsed.group), fam)
  }
  const classes = (content?.all('class') ?? []).map((c) => ({ value: c.id, label: c.name }))
  // Families with a parameter get a name of their own on the chip ("Saving throws", not "… saving throws").
  const chip = (f: Family) => (f.params.length && f.params[0] !== 'classOpt' ? t(`homebrew.chip.${f.id}`) : t(`homebrew.target.${f.id}`))

  const paramControl = (p: Param, i: number) => {
    const v = parsed.args[i] ?? ''
    if (p === 'target') return <TargetPicker key={i} value={v} onChange={(x) => setArg(i, x)} content={content} choiceIds={choiceIds} nested />
    if (p === 'classOpt')
      return (
        <select key={i} className={input} value={v} onChange={(e) => setArg(i, e.target.value)}>
          <option value="">{t('homebrew.d.allClasses')}</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      )
    const opts = paramChoices(p, ctx, choiceIds, parsed.args[0])
    if (p === 'companionStat') {
      return (
        <select key={i} className={input} value={v} onChange={(e) => setArg(i, e.target.value)}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    const list = p === 'spell' ? 'hb-spells' : p === 'creature' ? 'hb-creatures' : p === 'weapon' ? 'hb-weapons' : undefined
    if (opts.length && !list && (opts.some((o) => o.value === v) || v === ''))
      return (
        <select key={i} className={input} value={v} onChange={(e) => setArg(i, e.target.value)}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    return <input key={i} className={input} value={v} list={list} placeholder={p === 'text' ? 'save:poison' : p === 'profId' ? t('homebrew.f.idPlaceholder') : ''} onChange={(e) => setArg(i, e.target.value.trim())} />
  }

  return (
    <div className={`space-y-1.5 ${nested ? 'rounded border border-dashed border-border p-1.5' : ''}`}>
      <div className="flex flex-wrap gap-1">
        {cats.map((c) => (
          <button
            type="button"
            key={c}
            className={`rounded-full border px-2 py-0.5 text-xs ${category === c ? 'border-accent bg-accent/15 font-semibold' : 'border-border hover:bg-bg'}`}
            onClick={() => category !== c && pickFamily(FAMILIES.find((f) => f.category === c && !f.hidden)!)}
          >
            {t(`homebrew.cat.${c}`)}
          </button>
        ))}
        <Help id="target.custom" title={t('homebrew.target.custom')}>
          <button type="button" className={`rounded-full border px-2 py-0.5 text-xs ${custom ? 'border-accent bg-accent/15 font-semibold' : 'border-border hover:bg-bg'}`} onClick={() => !custom && onChange(value || 'custom')}>
            {t('homebrew.target.custom')}
          </button>
        </Help>
      </div>
      {custom ? (
        <input className={`${input} font-mono`} value={value} onChange={(e) => onChange(e.target.value.trim())} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {FAMILIES.filter((f) => f.category === category && !f.hidden).map((f) => (
              <Help key={f.id} id={`target.${f.id}` as HelpId} title={chip(f)}>
                <button type="button" className={`rounded border px-2 py-0.5 text-xs ${fam?.id === f.id ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => fam?.id !== f.id && pickFamily(f)}>
                  {chip(f)}
                </button>
              </Help>
            ))}
          </div>
          {fam?.id === 'companion' && (
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted">{t('homebrew.f.whichCreatures')}</span>
              <select className={`${input} w-auto`} value={parsed.group ?? ''} onChange={(e) => onChange(formatTarget('companion', parsed.args, e.target.value || undefined), fam)}>
                <option value="">{t('homebrew.d.allCreatures')}</option>
                {COMPANION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`homebrew.companionKind.${k}`)}
                  </option>
                ))}
                {parsed.group && !(COMPANION_KINDS as readonly string[]).includes(parsed.group) && <option value={parsed.group}>{parsed.group}</option>}
              </select>
            </label>
          )}
          {fam && fam.params.length > 0 && <div className={`grid gap-1 ${fam.params.length > 1 ? 'sm:grid-cols-2' : ''}`}>{fam.params.map(paramControl)}</div>}
        </>
      )}
    </div>
  )
}

/** When an effect applies: always, under automatic conditions (all must hold), and/or while a switch is on. */
export function WhenPicker({ value, onChange, defaultToggle }: { value: EffectWhen | undefined; onChange: (v: EffectWhen | undefined) => void; defaultToggle: string }) {
  const { t } = useTranslation()
  const list = value === undefined ? [] : Array.isArray(value) ? value : [value]
  const conds = list.filter((w): w is Exclude<typeof w, { toggle: string }> => typeof w === 'string')
  const toggle = list.find((w): w is { toggle: string } => typeof w === 'object')
  const write = (c: string[], tg: { toggle: string } | undefined) => {
    const all = [...c, ...(tg ? [tg] : [])] as Exclude<EffectWhen, unknown[]>[]
    onChange(all.length === 0 ? undefined : all.length === 1 ? all[0] : (all as EffectWhen))
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Help id="when.always" title={t('homebrew.m.always')}>
          <button type="button" className={`rounded-full border px-2 py-0.5 ${list.length === 0 ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => onChange(undefined)}>
            {t('homebrew.m.always')}
          </button>
        </Help>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!!toggle} onChange={(e) => write(conds, e.target.checked ? { toggle: defaultToggle } : undefined)} />
          <Label text={t('homebrew.m.whenToggle')} help="when.toggle" className="" />
        </label>
        {toggle && <input className={`${input} w-40`} value={toggle.toggle} onChange={(e) => write(conds, { toggle: e.target.value })} placeholder={t('homebrew.m.toggleName')} />}
      </div>
      {(Object.keys(WHEN_GROUPS) as (keyof typeof WHEN_GROUPS)[]).map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-1 text-xs">
          <span className="w-24 shrink-0 text-muted">{t(`homebrew.whenGroup.${g}`)}</span>
          {WHEN_GROUPS[g].map((w) => {
            const on = conds.includes(w as never)
            return (
              <Help key={w} id={`when.${w}` as HelpId} title={t(`homebrew.when.${w}`)}>
                <button type="button" className={`rounded-full border px-2 py-0.5 ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => write(on ? conds.filter((x) => x !== w) : [...conds, w], toggle)}>
                  {t(`homebrew.when.${w}`)}
                </button>
              </Help>
            )
          })}
        </div>
      ))}
      {list.length > 1 && <p className="text-[11px] text-muted">{t('homebrew.m.whenAll')}</p>}
    </div>
  )
}

const OPS: Op[] = ['add', 'set', 'max', 'min']

/** The whole effect row form. */
export function EffectFields({ e, setE, content, choiceIds, entityName }: { e: Raw; setE: (e: Raw) => void; content?: ContentIndex; choiceIds: string[]; entityName: string }) {
  const { t } = useTranslation()
  const parsed = parseTarget(String(e.target ?? ''))
  // The family that decides what the value means (inside "Allies" / "Your creatures": the inner one).
  const inner = parsed.family?.id === 'ally' ? parseTarget(parsed.args[0] ?? '').family : parsed.family?.id === 'companion' ? parseTarget(parsed.args[0] ?? '').family ?? familyById.get('hpMax') : parsed.family
  const valueless = inner?.valueless || inner?.id === 'note'
  return (
    <div className="space-y-2">
      <div>
        <Label text={t('homebrew.m.target')} help="effect.target" />
        <TargetPicker
          value={String(e.target ?? '')}
          content={content}
          choiceIds={choiceIds}
          onChange={(target, fam) => {
            const changedFamily = fam && fam.id !== parsed.family?.id
            setE({ ...e, target, ...(changedFamily ? { op: fam.op ?? 'add', value: fam.valueless ? undefined : (e.value ?? 1) } : {}) })
          }}
        />
      </div>
      {!valueless &&
        (inner?.id === 'proficiency' ? (
          <Segmented
            value={Number(e.value) >= 2 ? '2' : '1'}
            onChange={(v) => setE({ ...e, op: 'max', value: Number(v) })}
            options={[
              { value: '1', label: t('homebrew.m.proficient') },
              { value: '2', label: t('homebrew.m.expertise') },
            ]}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <div>
              <Label text={t('homebrew.m.op')} />
              <Segmented value={e.op ?? 'add'} onChange={(op) => setE({ ...e, op })} options={OPS.map((op) => ({ value: op, label: t(`homebrew.op.${op}`), help: `op.${op}` as HelpId }))} />
            </div>
            <Field label={t('homebrew.m.value')} help="effect.value" hint={inner?.unit === 'ft' ? t('homebrew.d.ft') : undefined}>
              <ScaledInput value={e.value} onChange={(v) => setE({ ...e, value: v ?? 0 })} placeholder="1, pb, cha, walk" />
            </Field>
          </div>
        ))}
      <div className="grid gap-2 sm:grid-cols-2">
        {parsed.family?.id === 'score' && (
          <Field label={t('homebrew.m.cap')} help="effect.max">
            <Num value={e.max} onChange={(v) => setE({ ...e, max: v })} placeholder="20" />
          </Field>
        )}
        {parsed.family?.id === 'ally' && (
          <Field label={t('homebrew.m.range')} help="effect.range">
            <ScaledInput value={e.range} onChange={(v) => setE({ ...e, range: v })} placeholder="10" preview={false} />
          </Field>
        )}
      </div>
      <div>
        <Label text={t('homebrew.m.when')} />
        <WhenPicker value={e.when} onChange={(when) => setE({ ...e, when })} defaultToggle={entityName} />
      </div>
      <Field label={t('homebrew.m.note')} help="effect.note">
        <Text value={e.note} onChange={(v) => setE({ ...e, note: v || undefined })} />
      </Field>
    </div>
  )
}
