import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import type { ContentIndex } from '../../content'
import { abilities, skills, type Entity, type Pack } from '../../content/schema'
import { checkEntity, newEntity, slug } from '../../engine/homebrew'
import { useContent } from '../../state/content'
import { savePack, useHomebrew } from '../../state/homebrew'
import { Card } from '../Card'
import { useHomebrewBase } from './base'
import { Area, Check, Field, Multi, Num, Rows, Select, Text } from './fields'
import { Help, HelpButton } from './help/Help'
import { HelpContent } from './help/context'
import type { HelpId } from './help/text.en'
import { ACTION_TYPES, grid } from './ui'
import { Mechanics } from './Mechanics'
import { ClassFields } from './ClassFields'
import { CreatureFields } from './CreatureFields'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation']
const DAMAGE = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']
const PROPERTIES = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'thrown', 'two-handed', 'versatile']
const MASTERY = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex']
const ITEM_KINDS = ['weapon', 'armor', 'wondrous', 'ring', 'rod', 'staff', 'wand', 'potion', 'scroll', 'gear', 'ammunition', 'tool']
const RARITY = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']
const CLASSES_FOR_SPELLS = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }))

/** Edit one entity of a homebrew pack: form for the common parts, JSON for everything. */
export function EntityEditor({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { packId = '', entityId = '' } = useParams()
  const pack = useHomebrew((s) => s.packs.find((p) => p.id === packId))
  const status = useHomebrew((s) => s.status)
  const entity = pack?.entities.find((e) => e.id === decodeURIComponent(entityId))
  if (!pack || !entity) return <p className="p-4 text-muted">{status === 'ready' ? t('homebrew.notFound') : t('loading')}</p>
  return <Editor key={entity.id} uid={uid} pack={pack} entity={entity} />
}

function Editor({ uid, pack, entity }: { uid: string; pack: Pack; entity: Entity }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const base = useHomebrewBase()
  const content = useContent(pack.edition)
  const [draft, setDraft] = useState<Raw>(() => structuredClone(entity) as Raw)
  const [tab, setTab] = useState<'form' | 'json'>('form')
  const [json, setJson] = useState('')
  const [errors, setErrors] = useState<string[]>()
  const [saved, setSaved] = useState(false)
  const set = (patch: Raw) => {
    setSaved(false)
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function save(next = draft) {
    const r = checkEntity(next)
    if (!r.ok) return setErrors(r.errors)
    setErrors(undefined)
    await savePack(uid, { ...pack, entities: pack.entities.map((e) => (e.id === entity.id ? r.entity : e)) })
    setDraft(structuredClone(r.entity) as Raw)
    setSaved(true)
  }

  /** A new feature / trait in the same pack, linked from this entity (subclass levels, species traits). */
  async function addLinked(type: 'feature' | 'trait', name: string, link: (id: string) => Raw) {
    const child = newEntity(pack, type === 'trait' ? 'feature' : 'feature', name, type === 'trait' ? { type: 'trait' } : { parent: entity.id })
    const r = checkEntity({ ...draft, ...link(child.id) })
    if (!r.ok) return setErrors(r.errors)
    await savePack(uid, { ...pack, entities: [...pack.entities.map((e) => (e.id === entity.id ? r.entity : e)), child] })
    navigate(`${base}/${pack.id}/${encodeURIComponent(child.id)}`)
  }

  const ownFeatures = pack.entities.filter((e) => e.type === 'feature' || e.type === 'trait').map((e) => ({ value: e.id, label: e.name }))

  const packCreatures = pack.entities.filter((e) => e.type === 'creature').map((e) => ({ value: e.id, label: e.name }))
  const typeHelp = `type.${draft.type === 'feature' && draft.optionOf !== undefined ? 'option' : draft.type === 'trait' ? 'feature' : draft.type}` as HelpId
  const typeLabel = t(`homebrew.types.${draft.type}`, { defaultValue: draft.type })

  return (
    <HelpContent.Provider value={content}>
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-6">
      <Link to={`${base}/${pack.id}`} className="text-sm text-accent underline">
        ‹ {pack.name}
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">{draft.name || '—'}</h1>
          <span className="inline-flex items-center rounded-full border border-border px-2 text-xs text-muted">
            <Help id={typeHelp} title={typeLabel}>
              {typeLabel}
            </Help>
            <HelpButton id={typeHelp} title={typeLabel} />
          </span>
          <span className="ml-auto flex gap-1">
            {(['form', 'json'] as const).map((x) => (
              <button
                key={x}
                className={`rounded-full border px-3 py-0.5 text-xs ${tab === x ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                onClick={() => {
                  if (x === 'json') setJson(JSON.stringify(draft, null, 2))
                  setTab(x)
                }}
              >
                {t(`homebrew.tab.${x}`)}
              </button>
            ))}
          </span>
        </div>
      </Card>

      {tab === 'json' ? (
        <Card>
          <p className="mb-2 text-xs text-muted">{t('homebrew.jsonHint')}</p>
          <textarea className="h-[60vh] w-full rounded border border-border bg-card p-2 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
          <button
            className="mt-2 rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-text"
            onClick={() => {
              try {
                const parsed = JSON.parse(json) as Raw
                setDraft({ ...parsed, id: entity.id })
                void save({ ...parsed, id: entity.id })
              } catch (e) {
                setErrors([`JSON: ${(e as Error).message}`])
              }
            }}
          >
            💾 {t('homebrew.save')}
          </button>
        </Card>
      ) : (
        <>
          <Card>
            <div className="space-y-2">
              <Field label={t('homebrew.f.name')}>
                <Text value={draft.name} onChange={(v) => set({ name: v })} />
              </Field>
              <Field label={t('homebrew.f.description')} hint={t('homebrew.f.descriptionHint')} help="common.description">
                <Area value={draft.description} onChange={(v) => set({ description: v })} />
              </Field>
              <Field label={t('homebrew.f.url')} help="common.url">
                <Text value={draft.source?.url} onChange={(v) => set({ source: { ...draft.source, url: v || undefined } })} placeholder="https://…" />
              </Field>
            </div>
          </Card>
          {content && <TypeFields draft={draft} set={set} content={content} ownFeatures={ownFeatures} addLinked={addLinked} />}
          {draft.type !== 'creature' && <Mechanics draft={draft} set={set} content={content} packCreatures={packCreatures} />}
        </>
      )}

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-border bg-card p-2 shadow">
        {tab === 'form' && (
          <button className="rounded bg-accent px-4 py-1.5 text-sm font-semibold text-accent-text" onClick={() => void save()}>
            💾 {t('homebrew.save')}
          </button>
        )}
        {saved && <span className="text-sm text-muted">✅ {t('homebrew.saved')}</span>}
        {errors && (
          <ul className="w-full list-disc pl-5 text-xs text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </HelpContent.Provider>
  )
}

/** Fields that depend on what the entity is. */
function TypeFields({
  draft,
  set,
  content,
  ownFeatures,
  addLinked,
}: {
  draft: Raw
  set: (p: Raw) => void
  content: ContentIndex
  ownFeatures: { value: string; label: string }[]
  addLinked: (type: 'feature' | 'trait', name: string, link: (id: string) => Raw) => Promise<void>
}) {
  const { t } = useTranslation()
  const [newName, setNewName] = useState('')
  const all = (type: 'class' | 'species' | 'feat' | 'feature' | 'trait') => content.all(type).map((e) => ({ value: e.id, label: e.name })).sort((a, b) => a.label.localeCompare(b.label))
  const features = [...ownFeatures, ...all('feature').filter((f) => !ownFeatures.some((o) => o.value === f.value))]
  const traits = [...ownFeatures, ...all('trait')]
  // Options can join a choice that lists its entities by id (invocations, maneuvers, fighting styles…).
  const optionOwners = useMemo(
    () =>
      (['class', 'subclass', 'feature', 'feat'] as const)
        .flatMap((type) => content.all(type))
        .flatMap((e) => e.choices.filter((c) => c.kind === 'entity' && c.from?.ids).map((c) => ({ value: e.id, label: `${c.label} (${e.name})` })))
        .filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [content],
  )
  const skillOpts = Object.keys(skills).map((s) => ({ value: s, label: content.get(`skill-${s}`)?.name ?? s }))
  const abilityOpts = abilities.map((a) => ({ value: a, label: a.toUpperCase() }))
  const newLinked = (type: 'feature' | 'trait', link: (id: string) => Raw) => (
    <span className="mt-1 flex gap-1">
      <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-0.5 text-xs" placeholder={t('homebrew.newName')} value={newName} onChange={(e) => setNewName(e.target.value)} />
      <button type="button" className="rounded border border-border px-2 text-xs hover:bg-bg" onClick={() => newName.trim() && void addLinked(type, newName.trim(), link)}>
        ➕ {t(type === 'trait' ? 'homebrew.newTrait' : 'homebrew.newFeature')}
      </button>
    </span>
  )

  switch (draft.type) {
    case 'feature':
    case 'trait':
      return (
        <Card>
          <div className={grid}>
            <Field label={t('homebrew.f.actionType')} hint={t('homebrew.f.actionTypeHint')} help="actionType.feature">
              <Select value={draft.actionType} onChange={(v) => set({ actionType: v })} options={ACTION_TYPES.map((a) => ({ value: a, label: t(`homebrew.action.${a}`) }))} empty="—" />
            </Field>
            {draft.type === 'feature' && (
              <div className="sm:col-span-2">
                <Field label={t('homebrew.f.optionOf')} help="option.optionOf">
                  <Select value={draft.optionOf} onChange={(v) => set({ optionOf: v })} options={optionOwners} empty={t('homebrew.f.optionOfNone')} />
                </Field>
              </div>
            )}
            {draft.optionOf && (
              <>
                <Field label={t('homebrew.f.minLevel')} help="feat.prerequisite">
                  <Num value={draft.prerequisite?.level} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, level: v } })} />
                </Field>
                <Field label={t('homebrew.f.prereqText')} help="feat.prerequisite">
                  <Text value={draft.prerequisite?.text} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, text: v || undefined } })} />
                </Field>
                <Check value={draft.repeatable} onChange={(v) => set({ repeatable: v || undefined })} label={t('homebrew.f.repeatable')} help="feat.repeatable" />
              </>
            )}
          </div>
        </Card>
      )
    case 'subclass':
      return (
        <Card>
          <Field label={t('homebrew.f.class')}>
            <Select value={draft.class} onChange={(v) => set({ class: v })} options={all('class')} />
          </Field>
          <Rows
            title={t('homebrew.f.levels')}
            hint={t('homebrew.f.levelsHint')}
            rows={draft.levels as Raw[]}
            onChange={(levels) => set({ levels })}
            make={() => ({ level: 3, features: [] })}
            render={(row, setRow) => (
              <div className="space-y-1">
                <Field label={t('homebrew.f.level')}>
                  <Num value={row.level} onChange={(v) => setRow({ ...row, level: v ?? 1 })} />
                </Field>
                <Multi value={row.features} onChange={(f) => setRow({ ...row, features: f })} options={ownFeatures} />
                {newLinked('feature', (id) => ({ levels: (draft.levels as Raw[]).map((l) => (l === row ? { ...l, features: [...l.features, id] } : l)) }))}
              </div>
            )}
          />
        </Card>
      )
    case 'feat':
      return (
        <Card>
          <div className={grid}>
            {content.edition === '2024' && (
              <Field label={t('homebrew.f.category')} help="feat.category">
                <Select
                  value={draft.category}
                  onChange={(v) => set({ category: v, tags: [...(draft.tags ?? []).filter((x: string) => !['origin', 'general', 'fighting-style', 'epic-boon'].includes(x)), ...(v ? [v] : [])] })}
                  options={opts(['origin', 'general', 'fighting-style', 'epic-boon'])}
                />
              </Field>
            )}
            <Field label={t('homebrew.f.minLevel')} help="feat.prerequisite">
              <Num value={draft.prerequisite?.level} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, level: v } })} />
            </Field>
            <Field label={t('homebrew.f.prereqText')} help="feat.prerequisite">
              <Text value={draft.prerequisite?.text} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, text: v || undefined } })} />
            </Field>
            <Check value={draft.repeatable} onChange={(v) => set({ repeatable: v })} label={t('homebrew.f.repeatable')} help="feat.repeatable" />
          </div>
          <Rows
            title={t('homebrew.f.prereqAbilities')}
            help="feat.prerequisite"
            rows={draft.prerequisite?.abilities as Raw[]}
            onChange={(v) => set({ prerequisite: { ...draft.prerequisite, abilities: v.length ? v : undefined } })}
            make={() => ({ ability: 'str', min: 13 })}
            render={(row, setRow) => (
              <div className={grid}>
                <Select value={row.ability} onChange={(v) => setRow({ ...row, ability: v ?? 'str' })} options={abilityOpts} />
                <Num value={row.min} onChange={(v) => setRow({ ...row, min: v ?? 13 })} />
              </div>
            )}
          />
        </Card>
      )
    case 'species':
    case 'subspecies':
      return (
        <Card>
          <div className={grid}>
            {draft.type === 'species' ? (
              <>
                <Field label={t('homebrew.f.size')}>
                  <Select value={draft.size} onChange={(v) => set({ size: v })} options={opts(['Tiny', 'Small', 'Medium', 'Large'])} />
                </Field>
                <Field label={t('homebrew.f.speed')}>
                  <Num value={draft.speed} onChange={(v) => set({ speed: v ?? 30 })} />
                </Field>
                <Field label={t('homebrew.f.languages')} hint={t('homebrew.f.commaList')}>
                  <Text value={(draft.languages ?? []).join(', ')} onChange={(v) => set({ languages: v.split(',').map((x) => slug(x)).filter(Boolean) })} />
                </Field>
              </>
            ) : (
              <Field label={t('homebrew.f.parentSpecies')}>
                <Select value={draft.species} onChange={(v) => set({ species: v })} options={all('species')} empty="—" />
              </Field>
            )}
          </div>
          <Field label={t('homebrew.f.traits')}>
            <Multi value={draft.traits} onChange={(v) => set({ traits: v })} options={traits} />
          </Field>
          {newLinked('trait', (id) => ({ traits: [...(draft.traits ?? []), id] }))}
          {content.edition === '2014' && (
            <Rows
              title={t('homebrew.f.abilityBonuses')}
              rows={draft.abilityBonuses as Raw[]}
              onChange={(v) => set({ abilityBonuses: v })}
              make={() => ({ ability: 'str', bonus: 1 })}
              render={(row, setRow) => (
                <div className={grid}>
                  <Select value={row.ability} onChange={(v) => setRow({ ...row, ability: v })} options={abilityOpts} />
                  <Num value={row.bonus} onChange={(v) => setRow({ ...row, bonus: v ?? 1 })} />
                </div>
              )}
            />
          )}
        </Card>
      )
    case 'background':
      return (
        <Card>
          <Field label={t('homebrew.f.skills')}>
            <Multi value={draft.skills} onChange={(v) => set({ skills: v })} options={skillOpts} />
          </Field>
          <Field label={t('homebrew.f.tools')} hint={t('homebrew.f.commaList')}>
            <Text value={(draft.tools ?? []).join(', ')} onChange={(v) => set({ tools: v.split(',').map((x) => slug(x)).filter(Boolean) })} />
          </Field>
          {content.edition === '2024' && (
            <>
              <Field label={t('homebrew.f.abilityOptions')} hint={t('homebrew.f.abilityOptionsHint')}>
                <Multi value={draft.abilityOptions} onChange={(v) => set({ abilityOptions: v })} options={abilityOpts} />
              </Field>
              <Field label={t('homebrew.f.originFeat')}>
                <Select value={draft.feat} onChange={(v) => set({ feat: v })} options={all('feat')} empty="—" />
              </Field>
            </>
          )}
          <Field label={t('homebrew.f.bgFeatures')}>
            <Multi value={draft.features} onChange={(v) => set({ features: v })} options={features.slice(0, ownFeatures.length)} />
          </Field>
          <div className={grid}>
            <Field label={t('homebrew.f.startingGold')}>
              <Num value={draft.startingGold} onChange={(v) => set({ startingGold: v ?? 0 })} />
            </Field>
          </div>
        </Card>
      )
    case 'item':
      return <ItemFields draft={draft} set={set} />
    case 'spell':
      return (
        <Card>
          <div className={grid}>
            <Field label={t('homebrew.f.spellLevel')}>
              <Num value={draft.level} onChange={(v) => set({ level: Math.max(0, Math.min(9, v ?? 0)) })} />
            </Field>
            <Field label={t('homebrew.f.school')}>
              <Select value={draft.school} onChange={(v) => set({ school: v })} options={opts(SCHOOLS)} />
            </Field>
            <Field label={t('homebrew.f.castingTime')}>
              <Text value={draft.castingTime} onChange={(v) => set({ castingTime: v })} />
            </Field>
            <Field label={t('homebrew.f.actionType')}>
              <Select value={draft.actionType} onChange={(v) => set({ actionType: v ?? 'action' })} options={ACTION_TYPES.map((a) => ({ value: a, label: t(`homebrew.action.${a}`) }))} />
            </Field>
            <Field label={t('homebrew.f.range')}>
              <Text value={draft.range} onChange={(v) => set({ range: v })} />
            </Field>
            <Field label={t('homebrew.f.duration')}>
              <Text value={draft.duration} onChange={(v) => set({ duration: v })} />
            </Field>
            <Field label={t('homebrew.f.components')}>
              <Multi value={draft.components} onChange={(v) => set({ components: v })} options={opts(['V', 'S', 'M'])} />
            </Field>
            <Field label={t('homebrew.f.material')}>
              <Text value={draft.material} onChange={(v) => set({ material: v || undefined })} />
            </Field>
            <Check value={draft.concentration} onChange={(v) => set({ concentration: v })} label={t('homebrew.f.concentration')} />
            <Check value={draft.ritual} onChange={(v) => set({ ritual: v })} label={t('homebrew.f.ritual')} />
            <Field label={t('homebrew.f.attack')}>
              <Select value={draft.attack} onChange={(v) => set({ attack: v })} options={opts(['melee', 'ranged'])} empty="—" />
            </Field>
            <Field label={t('homebrew.f.save')}>
              <Select value={draft.save} onChange={(v) => set({ save: v })} options={abilityOpts} empty="—" />
            </Field>
            <Field label={t('homebrew.f.damageType')}>
              <Select value={draft.damage?.type} onChange={(v) => set({ damage: v ? { type: v, by: draft.damage?.by ?? (draft.level === 0 ? 'character' : 'slot'), dice: draft.damage?.dice ?? { [String(Math.max(1, draft.level))]: '1d6' } } : undefined })} options={opts(DAMAGE)} empty="—" />
            </Field>
            {draft.damage && (
              <Field label={t('homebrew.f.damageDice')} hint={t('homebrew.f.damageDiceHint')}>
                <Text
                  value={Object.entries(draft.damage.dice as Record<string, string>).map(([k, v]) => `${k}:${v}`).join(', ')}
                  onChange={(v) => set({ damage: { ...draft.damage, dice: Object.fromEntries(v.split(',').map((x) => x.split(':').map((y) => y.trim())).filter((p) => p.length === 2 && p[0] && p[1])) } })}
                />
              </Field>
            )}
          </div>
          <Field label={t('homebrew.f.classes')}>
            <Multi value={draft.classes} onChange={(v) => set({ classes: v })} options={[...opts(CLASSES_FOR_SPELLS), ...content.all('class').filter((c) => !CLASSES_FOR_SPELLS.includes(c.id)).map((c) => ({ value: c.id, label: c.name }))]} />
          </Field>
          <Field label={t('homebrew.f.brief')}>
            <Text value={draft.brief} onChange={(v) => set({ brief: v || undefined })} />
          </Field>
          <Field label={t('homebrew.f.higherLevels')}>
            <Text value={draft.higherLevels} onChange={(v) => set({ higherLevels: v || undefined })} />
          </Field>
        </Card>
      )
    case 'class':
      return <ClassFields draft={draft} set={set} content={content} ownFeatures={ownFeatures} newLinked={(link) => newLinked('feature', link)} />
    case 'creature':
      return <CreatureFields draft={draft} set={set} />
    case 'condition':
      return (
        <Card>
          <p className="text-sm text-muted">{t('homebrew.f.conditionHint')}</p>
        </Card>
      )
    default:
      return null
  }
}

function ItemFields({ draft, set }: { draft: Raw; set: (p: Raw) => void }) {
  const { t } = useTranslation()
  // Changing the kind changes the item's shape (weapon / armor / other).
  const changeKind = (kind: string) => {
    const base: Raw = { kind }
    if (kind === 'weapon') Object.assign(base, { category: draft.category === 'martial' ? 'martial' : 'simple', range: 'melee', damage: { dice: '1d6', type: 'slashing' }, properties: [] })
    if (kind === 'armor') Object.assign(base, { category: 'light', ac: { base: 11, dex: true } })
    const keep = Object.fromEntries(Object.entries(draft).filter(([k]) => !['category', 'range', 'damage', 'properties', 'versatileDamage', 'distance', 'mastery', 'ac', 'strMin', 'stealthDisadvantage'].includes(k)))
    set({ ...keep, ...base })
  }
  return (
    <Card>
      <div className={grid}>
        <Field label={t('homebrew.f.kind')}>
          <Select value={draft.kind} onChange={(v) => v && changeKind(v)} options={opts(ITEM_KINDS)} />
        </Field>
        <Field label={t('homebrew.f.rarity')}>
          <Select value={draft.rarity} onChange={(v) => set({ rarity: v })} options={opts(RARITY)} empty="—" />
        </Field>
        <Check value={draft.magic} onChange={(v) => set({ magic: v })} label={t('homebrew.f.magic')} />
        <Check value={draft.attunement} onChange={(v) => set({ attunement: v })} label={t('homebrew.f.attunement')} />
        <Check value={draft.consumable} onChange={(v) => set({ consumable: v })} label={t('homebrew.f.consumable')} />
        <Field label={t('homebrew.f.weight')}>
          <Num value={draft.weight} onChange={(v) => set({ weight: v ?? 0 })} />
        </Field>
        <Field label={t('homebrew.f.costGp')}>
          <Num value={draft.cost?.amount} onChange={(v) => set({ cost: v === undefined ? undefined : { amount: v, unit: 'gp' } })} />
        </Field>
      </div>
      {draft.kind === 'weapon' && (
        <div className={`${grid} mt-2`}>
          <Field label={t('homebrew.f.weaponCategory')}>
            <Select value={draft.category} onChange={(v) => set({ category: v })} options={opts(['simple', 'martial'])} />
          </Field>
          <Field label={t('homebrew.f.weaponRange')}>
            <Select value={draft.range} onChange={(v) => set({ range: v })} options={opts(['melee', 'ranged'])} />
          </Field>
          <Field label={t('homebrew.f.damageDice')}>
            <Text value={draft.damage?.dice} onChange={(v) => set({ damage: { ...draft.damage, dice: v } })} />
          </Field>
          <Field label={t('homebrew.f.damageType')}>
            <Select value={draft.damage?.type} onChange={(v) => set({ damage: { ...draft.damage, type: v } })} options={opts(DAMAGE)} />
          </Field>
          <Field label={t('homebrew.f.mastery')}>
            <Select value={draft.mastery} onChange={(v) => set({ mastery: v })} options={opts(MASTERY)} empty="—" />
          </Field>
          <Field label={t('homebrew.f.distance')} hint="20/60">
            <Text
              value={draft.distance ? `${draft.distance.normal}${draft.distance.long ? `/${draft.distance.long}` : ''}` : ''}
              onChange={(v) => {
                const [n, l] = v.split('/').map(Number)
                set({ distance: n ? { normal: n, ...(l ? { long: l } : {}) } : undefined })
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('homebrew.f.properties')}>
              <Multi value={draft.properties} onChange={(v) => set({ properties: v })} options={opts(PROPERTIES)} />
            </Field>
          </div>
        </div>
      )}
      {draft.kind === 'armor' && (
        <div className={`${grid} mt-2`}>
          <Field label={t('homebrew.f.armorCategory')}>
            <Select value={draft.category} onChange={(v) => set({ category: v })} options={opts(['light', 'medium', 'heavy', 'shield'])} />
          </Field>
          <Field label={t('homebrew.f.acBase')}>
            <Num value={draft.ac?.base} onChange={(v) => set({ ac: { ...draft.ac, base: v ?? 10 } })} />
          </Field>
          <Check value={draft.ac?.dex} onChange={(v) => set({ ac: { ...draft.ac, dex: v } })} label={t('homebrew.f.acDex')} />
          <Field label={t('homebrew.f.acMaxDex')}>
            <Num value={draft.ac?.maxDex} onChange={(v) => set({ ac: { ...draft.ac, maxDex: v } })} />
          </Field>
        </div>
      )}
      <div className={`${grid} mt-2`}>
        <Field label={t('homebrew.f.charges')} hint={t('homebrew.f.chargesHint')}>
          <Num value={draft.charges?.max} onChange={(v) => set({ charges: v ? { id: 'charges', name: 'Charges', ...draft.charges, max: v, recharge: draft.charges?.recharge ?? [{ on: 'dawn', amount: 'all' }] } : undefined })} />
        </Field>
        {draft.charges && (
          <Field label={t('homebrew.f.chargesDawn')} hint="1d6+1">
            <Text value={draft.charges.recharge?.[0]?.dice} onChange={(v) => set({ charges: { ...draft.charges, recharge: [{ on: 'dawn', amount: 'all', ...(v ? { dice: v } : {}) }] } })} />
          </Field>
        )}
      </div>
    </Card>
  )
}
