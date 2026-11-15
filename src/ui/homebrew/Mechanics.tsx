// The mechanics of an entity: effects, resources, actions, choices, spells, creatures, attacks,
// replaced features and extra spells. Sections show only when used; "Add mechanic" offers
// every kind grouped by what the author wants to do.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { Card } from '../Card'
import { describeActivity, describeAttack, describeChoice, describeCompanion, describeEffect, describeResource, describeSpellGrant, type RowKind } from './describe'
import { EffectFields } from './EffectFields'
import { Field, IdList, Label, Rows } from './fields'
import { Help } from './help/Help'
import { useTemplateSink } from './help/context'
import type { HelpId } from './help/text.en'
import { TableEditor } from './TableEditor'
import { ActivityFields, AttackFields, ChoiceFields, CompanionFields, ResourceFields, SpellGrantFields } from './MechanicRows'
import { effectPlace } from './targets'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

type SectionKey = RowKind | 'replaces' | 'expandedSpells'

/** What the "Add mechanic" menu offers: an intent, and the row it starts with. */
const MENU: { id: string; icon: string; help: HelpId; section: SectionKey; make: (d: Raw) => Raw }[] = [
  { id: 'number', icon: '🔢', help: 'section.effects', section: 'effects', make: () => ({ target: 'ac', op: 'add', value: 1 }) },
  { id: 'proficiency', icon: '🎓', help: 'section.proficiency', section: 'effects', make: () => ({ target: 'proficiency:skill:athletics', op: 'max', value: 1 }) },
  { id: 'defense', icon: '🛡️', help: 'section.defenses', section: 'effects', make: () => ({ target: 'resistance:fire' }) },
  { id: 'note', icon: '📝', help: 'section.notes', section: 'effects', make: () => ({ target: 'note', note: '' }) },
  { id: 'activity', icon: '⚡', help: 'section.activities', section: 'activities', make: (d) => ({ id: `use-${(d.activities?.length ?? 0) + 1}`, name: d.name, actionType: 'action', cost: [] }) },
  {
    id: 'table',
    icon: '🎲',
    help: 'activity.table',
    section: 'activities',
    make: (d) => ({ id: `table-${(d.activities?.length ?? 0) + 1}`, name: d.name, actionType: 'action', cost: [], table: { dice: '1d20', rows: [] } }),
  },
  { id: 'resource', icon: '🔋', help: 'section.resources', section: 'resources', make: (d) => ({ id: `res-${(d.resources?.length ?? 0) + 1}`, name: '', max: 1, recharge: [{ on: 'longRest', amount: 'all' }] }) },
  { id: 'choice', icon: '🎯', help: 'section.choices', section: 'choices', make: (d) => ({ id: `choice-${(d.choices?.length ?? 0) + 1}`, label: '', kind: 'option', count: 1, options: [] }) },
  { id: 'spell', icon: '✨', help: 'section.spells', section: 'spells', make: () => ({ id: '' }) },
  { id: 'attack', icon: '⚔️', help: 'section.attacks', section: 'attacks', make: (d) => ({ id: `attack-${(d.attacks?.length ?? 0) + 1}`, name: '', range: 'melee', damage: { dice: '1d6', type: 'slashing' }, properties: [] }) },
  { id: 'companion', icon: '🐺', help: 'section.companions', section: 'companions', make: (d) => ({ id: `creature-${(d.companions?.length ?? 0) + 1}`, kind: 'companion', creatures: [] }) },
  { id: 'companionEffect', icon: '🐾', help: 'section.companionEffects', section: 'effects', make: () => ({ target: 'companion:ac', op: 'add', value: 1 }) },
  { id: 'ally', icon: '🤝', help: 'section.allies', section: 'effects', make: () => ({ target: 'ally:save:all', op: 'add', value: 'max(1, cha)', range: 10 }) },
  { id: 'replaces', icon: '↔️', help: 'section.replaces', section: 'replaces', make: () => ({}) },
  { id: 'expandedSpells', icon: '📚', help: 'section.expandedSpells', section: 'expandedSpells', make: () => ({}) },
]

const ARRAY_OF: Record<SectionKey, string> = { effects: 'effects', resources: 'resources', activities: 'activities', choices: 'choices', spells: 'spells', companions: 'companions', attacks: 'attacks', replaces: 'replaces', expandedSpells: 'expandedSpells' }

export function Mechanics({ draft, set, content, packCreatures }: { draft: Raw; set: (p: Raw) => void; content?: ContentIndex; packCreatures: { value: string; label: string }[] }) {
  const { t } = useTranslation()
  const ctx = { t, content }
  const [opened, setOpened] = useState<Set<SectionKey>>(() => new Set())
  // A section that appeared because a row was just added opens that row.
  const fresh = (k: SectionKey) => (opened.has(k) ? [((draft[ARRAY_OF[k]] as unknown[] | undefined)?.length ?? 1) - 1] : undefined)
  const show = (k: SectionKey) => opened.has(k) || ((draft[ARRAY_OF[k]] as unknown[] | undefined)?.length ?? 0) > 0

  // "Use as template" in the Ctrl help copies an example row into this entity.
  const latest = useRef({ draft, set })
  useEffect(() => {
    latest.current = { draft, set }
  })
  useEffect(() => {
    useTemplateSink.setState({
      apply: ({ kind, row }) => {
        const { draft: d, set: s } = latest.current
        setOpened((o) => new Set([...o, kind]))
        s({ [kind]: [...((d[kind] as Raw[] | undefined) ?? []), row] })
      },
    })
    return () => useTemplateSink.setState({ apply: undefined })
  }, [])

  const lists = useMemo(() => {
    const named = (type: Parameters<ContentIndex['all']>[0]) => (content?.all(type) ?? []).map((e) => ({ value: e.id, label: e.name })).sort((a, b) => a.label.localeCompare(b.label))
    const creatures = [...packCreatures, ...named('creature').filter((c) => !packCreatures.some((p) => p.value === c.value))]
    return {
      spells: named('spell'),
      creatures,
      weapons: (content?.all('item') ?? []).filter((i) => i.kind === 'weapon' && !i.magic).map((e) => ({ value: e.id, label: e.name })),
      features: [...named('feature'), ...named('feat')],
      classes: named('class'),
      entities: [...named('feat'), ...named('feature'), ...named('spell')],
    }
  }, [content, packCreatures])

  const resourceIds = ((draft.resources as Raw[] | undefined) ?? []).map((r) => r.id)
  const pools = [...resourceIds, ...(draft.charges ? ['charges'] : []), 'channel-divinity', 'bardic-inspiration', 'rage', 'wild-shape', 'focus', 'ki', 'sorcery-points', 'superiority-dice', '@quantity', '@hitDie']
  const choiceIds = ((draft.choices as Raw[] | undefined) ?? []).map((c) => c.id as string)
  const spellChoiceIds = ((draft.choices as Raw[] | undefined) ?? []).filter((c) => c.kind === 'spell').map((c) => c.id as string)

  const add = (item: (typeof MENU)[number]) => {
    setOpened((o) => new Set([...o, item.section]))
    if (item.section === 'replaces' || item.section === 'expandedSpells') return
    const key = ARRAY_OF[item.section]
    set({ [key]: [...((draft[key] as Raw[] | undefined) ?? []), item.make(draft)] })
  }

  return (
    <Card>
      <h2 className="mb-1 font-heading text-lg font-semibold">{t('homebrew.mechanics')}</h2>
      <p className="mb-2 text-xs text-muted">{t('homebrew.help.ctrlIntro')}</p>
      <datalist id="hb-pools">
        {pools.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="hb-spells">
        {lists.spells.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </datalist>
      <datalist id="hb-creatures">
        {lists.creatures.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </datalist>
      <datalist id="hb-weapons">
        {lists.weapons.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </datalist>
      <div className="space-y-3">
        {show('effects') && (
          <Rows
            title={t('homebrew.m.effects')}
            help="section.effects"
            hint={t('homebrew.m.effectsHint')}
            rows={draft.effects as Raw[]}
            initialOpen={fresh('effects')}
            onChange={(v) => set({ effects: v })}
            make={() => ({ target: 'ac', op: 'add', value: 1 })}
            summary={(e) => describeEffect(e, ctx)}
            place={(e) => effectPlace(String(e.target ?? ''))}
            render={(e, setE) => <EffectFields e={e} setE={setE} content={content} choiceIds={choiceIds} entityName={draft.name} />}
          />
        )}
        {show('resources') && (
          <Rows
            title={t('homebrew.m.resources')}
            help="section.resources"
            hint={t('homebrew.m.resourcesHint')}
            rows={draft.resources as Raw[]}
            initialOpen={fresh('resources')}
            onChange={(v) => set({ resources: v })}
            make={() => MENU.find((m) => m.id === 'resource')!.make(draft)}
            summary={(r) => describeResource(r, ctx)}
            place={() => 'resources'}
            render={(r, setR) => <ResourceFields r={r} setR={setR} />}
          />
        )}
        {show('activities') && (
          <Rows
            title={t('homebrew.m.activities')}
            help="section.activities"
            hint={t('homebrew.m.activitiesHint')}
            rows={draft.activities as Raw[]}
            initialOpen={fresh('activities')}
            onChange={(v) => set({ activities: v })}
            make={() => MENU.find((m) => m.id === 'activity')!.make(draft)}
            summary={(a) => describeActivity(a, ctx)}
            place={(a) => (a.attack ? 'attacks' : 'actions')}
            render={(a, setA) => (
              <>
                <ActivityFields a={a} setA={setA} />
                {a.table ? (
                  <TableEditor a={a} setA={setA} content={content} choiceIds={choiceIds} />
                ) : (
                  <button type="button" className="mt-2 rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={() => setA({ ...a, table: { dice: '1d20', rows: [] } })}>
                    🎲 {t('homebrew.table.add')}
                  </button>
                )}
              </>
            )}
          />
        )}
        {show('choices') && (
          <Rows
            title={t('homebrew.m.choices')}
            help="section.choices"
            hint={t('homebrew.m.choicesHint')}
            rows={draft.choices as Raw[]}
            initialOpen={fresh('choices')}
            onChange={(v) => set({ choices: v })}
            make={() => MENU.find((m) => m.id === 'choice')!.make(draft)}
            summary={(c) => describeChoice(c, ctx)}
            place={() => 'choices'}
            render={(c, setC) => <ChoiceFields c={c} setC={setC} content={content} entityOptions={lists.entities} />}
          />
        )}
        {show('spells') && (
          <Rows
            title={t('homebrew.m.spells')}
            help="section.spells"
            hint={t('homebrew.m.spellsHint')}
            rows={draft.spells as Raw[]}
            initialOpen={fresh('spells')}
            onChange={(v) => set({ spells: v })}
            make={() => ({ id: '' })}
            summary={(g) => describeSpellGrant(g, ctx)}
            place={() => 'spells'}
            render={(g, setG) => <SpellGrantFields g={g} setG={setG} spellChoiceIds={spellChoiceIds} />}
          />
        )}
        {show('companions') && (
          <Rows
            title={t('homebrew.m.companions')}
            help="section.companions"
            hint={t('homebrew.m.companionsHint')}
            rows={draft.companions as Raw[]}
            initialOpen={fresh('companions')}
            onChange={(v) => set({ companions: v })}
            make={() => MENU.find((m) => m.id === 'companion')!.make(draft)}
            summary={(c) => describeCompanion(c, ctx)}
            place={() => 'companions'}
            render={(c, setC) => <CompanionFields c={c} setC={setC} creatures={lists.creatures} classes={lists.classes} />}
          />
        )}
        {show('attacks') && (
          <Rows
            title={t('homebrew.m.attacks')}
            help="section.attacks"
            hint={t('homebrew.m.attacksHint')}
            rows={draft.attacks as Raw[]}
            initialOpen={fresh('attacks')}
            onChange={(v) => set({ attacks: v })}
            make={() => MENU.find((m) => m.id === 'attack')!.make(draft)}
            summary={(a) => describeAttack(a, ctx)}
            place={() => 'attacks'}
            render={(a, setA) => <AttackFields a={a} setA={setA} />}
          />
        )}
        {show('replaces') && (
          <section className="rounded border border-border p-2">
            <Field label={t('homebrew.m.replaces')} help="section.replaces">
              <IdList value={draft.replaces} onChange={(v) => set({ replaces: v.length ? v : undefined })} options={lists.features} />
            </Field>
          </section>
        )}
        {show('expandedSpells') && (
          <section className="rounded border border-border p-2">
            <Field label={t('homebrew.m.expandedSpells')} help="section.expandedSpells">
              <IdList value={draft.expandedSpells} onChange={(v) => set({ expandedSpells: v.length ? v : undefined })} options={lists.spells} />
            </Field>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold">➕ {t('homebrew.menu.title')}</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {MENU.map((item) => (
              <Help key={item.id} id={item.help} title={t(`homebrew.menu.${item.id}.label`)} className="block">
                <button type="button" className="flex w-full items-start gap-2 rounded border border-border p-2 text-left hover:border-accent hover:bg-bg" onClick={() => add(item)}>
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold">{t(`homebrew.menu.${item.id}.label`)}</span>
                    <span className="block text-xs text-muted">{t(`homebrew.menu.${item.id}.desc`)}</span>
                  </span>
                </button>
              </Help>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            <Label text={t('homebrew.m.formulas')} help="formula" className="" /> · <Label text={t('homebrew.m.levelTable')} help="scaled.byLevel" className="" /> · {t('homebrew.m.moreInJson')}
          </p>
        </section>
      </div>
    </Card>
  )
}
