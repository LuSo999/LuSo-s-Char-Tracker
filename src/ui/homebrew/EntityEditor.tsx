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
import { Area, Check, Field, Multi, Num, Rows, Scaled, Select, Text } from './fields'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const grid = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4'
const ACTION_TYPES = ['action', 'bonusAction', 'reaction', 'other'] as const
const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation']
const DAMAGE = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']
const PROPERTIES = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'thrown', 'two-handed', 'versatile']
const MASTERY = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex']
const ITEM_KINDS = ['weapon', 'armor', 'wondrous', 'ring', 'rod', 'staff', 'wand', 'potion', 'scroll', 'gear', 'ammunition', 'tool']
const RARITY = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']
const CLASSES_FOR_SPELLS = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
/** Effect targets offered in the list (any target from docs/content-format.md can be typed). */
const TARGETS = [
  'ac', 'speed', 'initiative', 'hpMax', 'hpPerLevel', 'attack', 'damage', 'spellDc', 'spellAttack', 'save:all', 'check:all', 'critRange', 'attacksPerAction', 'reach',
  ...abilities.map((a) => `score:${a}`), ...abilities.map((a) => `save:${a}`), ...abilities.map((a) => `proficiency:save:${a}`),
  ...Object.keys(skills).map((s) => `proficiency:skill:${s}`),
  ...DAMAGE.map((d) => `resistance:${d}`), ...DAMAGE.map((d) => `immunity:${d}`),
  'sense:darkvision', 'sense:blindsight', 'sense:tremorsense', 'sense:truesight', 'speed:fly', 'speed:swim', 'speed:climb', 'speed:burrow',
  'unarmedDamage', 'note', 'advantage:save:condition',
]
const WHEN = ['wearingArmor', 'noArmor', 'wieldingShield', 'meleeWeapon', 'rangedWeapon', 'weaponAttack', 'heavyWeapon', 'thrownWeapon', 'emptyHands', 'bloodied', 'notHeavyArmor', 'noMediumOrHeavyArmor', 'magicWeapon']
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

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-6">
      <Link to={`${base}/${pack.id}`} className="text-sm text-accent underline">
        ‹ {pack.name}
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">{draft.name || '—'}</h1>
          <span className="rounded-full border border-border px-2 text-xs text-muted">{t(`homebrew.types.${draft.type}`, { defaultValue: draft.type })}</span>
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
              <Field label={t('homebrew.f.description')} hint={t('homebrew.f.descriptionHint')}>
                <Area value={draft.description} onChange={(v) => set({ description: v })} />
              </Field>
              <Field label={t('homebrew.f.url')}>
                <Text value={draft.source?.url} onChange={(v) => set({ source: { ...draft.source, url: v || undefined } })} placeholder="https://…" />
              </Field>
            </div>
          </Card>
          {content && <TypeFields draft={draft} set={set} content={content} ownFeatures={ownFeatures} addLinked={addLinked} />}
          <Mechanics draft={draft} set={set} content={content} />
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
            <Field label={t('homebrew.f.actionType')} hint={t('homebrew.f.actionTypeHint')}>
              <Select value={draft.actionType} onChange={(v) => set({ actionType: v })} options={ACTION_TYPES.map((a) => ({ value: a, label: t(`homebrew.action.${a}`) }))} empty="—" />
            </Field>
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
              <Field label={t('homebrew.f.category')}>
                <Select
                  value={draft.category}
                  onChange={(v) => set({ category: v, tags: [...(draft.tags ?? []).filter((x: string) => !['origin', 'general', 'fighting-style', 'epic-boon'].includes(x)), ...(v ? [v] : [])] })}
                  options={opts(['origin', 'general', 'fighting-style', 'epic-boon'])}
                />
              </Field>
            )}
            <Field label={t('homebrew.f.minLevel')}>
              <Num value={draft.prerequisite?.level} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, level: v } })} />
            </Field>
            <Field label={t('homebrew.f.prereqText')}>
              <Text value={draft.prerequisite?.text} onChange={(v) => set({ prerequisite: { ...draft.prerequisite, text: v || undefined } })} />
            </Field>
            <Check value={draft.repeatable} onChange={(v) => set({ repeatable: v })} label={t('homebrew.f.repeatable')} />
          </div>
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
            <Multi value={draft.classes} onChange={(v) => set({ classes: v })} options={opts(CLASSES_FOR_SPELLS)} />
          </Field>
          <Field label={t('homebrew.f.brief')}>
            <Text value={draft.brief} onChange={(v) => set({ brief: v || undefined })} />
          </Field>
          <Field label={t('homebrew.f.higherLevels')}>
            <Text value={draft.higherLevels} onChange={(v) => set({ higherLevels: v || undefined })} />
          </Field>
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

/** Resources, activities, effects, granted spells and attacks: shared by every type. */
function Mechanics({ draft, set, content }: { draft: Raw; set: (p: Raw) => void; content?: ContentIndex }) {
  const { t } = useTranslation()
  const spells = useMemo(() => (content?.all('spell') ?? []).map((s) => ({ value: s.id, label: s.name })).sort((a, b) => a.label.localeCompare(b.label)), [content])
  const resourceIds = (draft.resources as Raw[] | undefined)?.map((r) => r.id) ?? []
  const pools = [...resourceIds, ...(draft.charges ? ['charges'] : []), 'channel-divinity', 'bardic-inspiration', 'rage', 'wild-shape', 'focus', 'ki', 'sorcery-points', 'superiority-dice', '@quantity', '@hitDie']
  const recharge = (r: Raw) => (r.recharge?.length === 2 ? 'short' : r.recharge?.[0]?.on === 'longRest' ? 'long' : r.recharge?.[0]?.on === 'dawn' ? 'dawn' : 'none')
  const setRecharge = (v: string | undefined) =>
    v === 'short' ? [{ on: 'shortRest', amount: 'all' }, { on: 'longRest', amount: 'all' }] : v === 'long' ? [{ on: 'longRest', amount: 'all' }] : v === 'dawn' ? [{ on: 'dawn', amount: 'all' }] : []
  return (
    <Card>
      <h2 className="mb-2 font-heading text-lg font-semibold">{t('homebrew.mechanics')}</h2>
      <datalist id="hb-targets">
        {TARGETS.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="hb-pools">
        {pools.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="hb-spells">
        {spells.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </datalist>
      <div className="space-y-3">
        <Rows
          title={t('homebrew.m.resources')}
          hint={t('homebrew.m.resourcesHint')}
          rows={draft.resources as Raw[]}
          onChange={(v) => set({ resources: v })}
          make={() => ({ id: `res-${resourceIds.length + 1}`, name: '', max: 1, recharge: [{ on: 'longRest', amount: 'all' }] })}
          render={(r, setR) => (
            <div className={grid}>
              <Field label={t('homebrew.f.name')}>
                <Text value={r.name} onChange={(v) => setR({ ...r, name: v, id: r.id.startsWith('res-') || r.id === slug(r.name) ? slug(v) || r.id : r.id })} />
              </Field>
              <Field label={t('homebrew.m.max')} hint="3, pb, cha, level">
                <Scaled value={r.max} onChange={(v) => setR({ ...r, max: v ?? 1 })} />
              </Field>
              <Field label={t('homebrew.m.die')} hint="6 = d6">
                <Scaled value={r.die} onChange={(v) => setR({ ...r, die: v })} />
              </Field>
              <Field label={t('homebrew.m.recharge')}>
                <Select value={recharge(r)} onChange={(v) => setR({ ...r, recharge: setRecharge(v) })} options={['short', 'long', 'dawn', 'none'].map((x) => ({ value: x, label: t(`homebrew.recharge.${x}`) }))} />
              </Field>
              <Field label="id" hint={t('homebrew.m.idHint')}>
                <Text value={r.id} onChange={(v) => setR({ ...r, id: slug(v) })} />
              </Field>
            </div>
          )}
        />
        <Rows
          title={t('homebrew.m.activities')}
          hint={t('homebrew.m.activitiesHint')}
          rows={draft.activities as Raw[]}
          onChange={(v) => set({ activities: v })}
          make={() => ({ id: `use-${(draft.activities?.length ?? 0) + 1}`, name: draft.name, actionType: 'action', cost: [] })}
          render={(a, setA) => (
            <div className="space-y-2">
              <div className={grid}>
                <Field label={t('homebrew.f.name')}>
                  <Text value={a.name} onChange={(v) => setA({ ...a, name: v })} />
                </Field>
                <Field label={t('homebrew.f.actionType')}>
                  <Select value={a.actionType} onChange={(v) => setA({ ...a, actionType: v ?? 'action' })} options={ACTION_TYPES.map((x) => ({ value: x, label: t(`homebrew.action.${x}`) }))} />
                </Field>
                <Field label={t('homebrew.m.cost')} hint={t('homebrew.m.costHint')}>
                  <Text value={a.cost?.[0]?.resource} list="hb-pools" onChange={(v) => setA({ ...a, cost: v ? [{ resource: v, amount: a.cost?.[0]?.amount ?? 1 }] : [] })} />
                </Field>
                <Field label={t('homebrew.m.costAmount')}>
                  <Num value={a.cost?.[0]?.amount} onChange={(v) => setA({ ...a, cost: a.cost?.[0] ? [{ ...a.cost[0], amount: v ?? 1 }] : [] })} />
                </Field>
                <Field label={t('homebrew.m.rollKind')}>
                  <Select value={a.roll?.kind} onChange={(v) => setA({ ...a, roll: v ? { ...a.roll, kind: v } : undefined })} options={['damage', 'heal', 'temp', 'other'].map((x) => ({ value: x, label: t(`homebrew.roll.${x}`) }))} empty="—" />
                </Field>
                {a.roll && (
                  <>
                    <Field label={t('homebrew.m.dice')} hint="2d6">
                      <Text value={typeof a.roll.dice === 'string' ? a.roll.dice : a.roll.dice ? JSON.stringify(a.roll.dice) : ''} onChange={(v) => setA({ ...a, roll: { ...a.roll, dice: v || undefined } })} />
                    </Field>
                    <Field label={t('homebrew.m.bonus')} hint="pb, wis, level">
                      <Scaled value={a.roll.bonus} onChange={(v) => setA({ ...a, roll: { ...a.roll, bonus: v } })} />
                    </Field>
                  </>
                )}
                <Field label={t('homebrew.m.saveDc')} hint="8 + pb + wis">
                  <Scaled value={a.saveDc} onChange={(v) => setA({ ...a, saveDc: v })} />
                </Field>
                <Field label={t('homebrew.m.saveAbility')}>
                  <Select value={a.saveAbility} onChange={(v) => setA({ ...a, saveAbility: v })} options={abilities.map((x) => ({ value: x, label: x.toUpperCase() }))} empty="—" />
                </Field>
                <Check value={a.spendInput} onChange={(v) => setA({ ...a, spendInput: v })} label={t('homebrew.m.spendInput')} />
                <Check value={a.attack} onChange={(v) => setA({ ...a, attack: v })} label={t('homebrew.m.onHit')} />
              </div>
              <Field label={t('homebrew.m.summary')}>
                <Text value={a.summary} onChange={(v) => setA({ ...a, summary: v || undefined })} />
              </Field>
            </div>
          )}
        />
        <Rows
          title={t('homebrew.m.effects')}
          hint={t('homebrew.m.effectsHint')}
          rows={draft.effects as Raw[]}
          onChange={(v) => set({ effects: v })}
          make={() => ({ target: 'ac', op: 'add', value: 1 })}
          render={(e, setE) => (
            <div className={grid}>
              <Field label={t('homebrew.m.target')}>
                <Text value={e.target} list="hb-targets" onChange={(v) => setE({ ...e, target: v })} />
              </Field>
              <Field label={t('homebrew.m.op')}>
                <Select value={e.op} onChange={(v) => setE({ ...e, op: v ?? 'add' })} options={opts(['add', 'set', 'max', 'min'])} />
              </Field>
              <Field label={t('homebrew.m.value')} hint="1, pb, cha, walk">
                <Scaled value={e.value} onChange={(v) => setE({ ...e, value: v ?? 0 })} />
              </Field>
              <Field label={t('homebrew.m.when')}>
                <Select
                  value={typeof e.when === 'string' ? e.when : e.when?.toggle ? '@toggle' : undefined}
                  onChange={(v) => setE({ ...e, when: v === '@toggle' ? { toggle: e.when?.toggle ?? draft.name } : v })}
                  options={[...opts(WHEN), { value: '@toggle', label: t('homebrew.m.whenToggle') }]}
                  empty={t('homebrew.m.always')}
                />
              </Field>
              {e.when?.toggle !== undefined && (
                <Field label={t('homebrew.m.toggleName')}>
                  <Text value={e.when.toggle} onChange={(v) => setE({ ...e, when: { toggle: v } })} />
                </Field>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label={t('homebrew.m.note')}>
                  <Text value={e.note} onChange={(v) => setE({ ...e, note: v || undefined })} />
                </Field>
              </div>
            </div>
          )}
        />
        <Rows
          title={t('homebrew.m.spells')}
          hint={t('homebrew.m.spellsHint')}
          rows={draft.spells as Raw[]}
          onChange={(v) => set({ spells: v })}
          make={() => ({ id: '' })}
          render={(g, setG) => (
            <div className={grid}>
              <Field label={t('homebrew.m.spell')}>
                <Text value={g.id} list="hb-spells" onChange={(v) => setG({ ...g, id: v })} />
              </Field>
              <Field label={t('homebrew.m.freeCast')}>
                <Text value={g.freeCast} list="hb-pools" onChange={(v) => setG({ ...g, freeCast: v || undefined })} />
              </Field>
              <Field label={t('homebrew.m.minLevel')}>
                <Num value={g.minLevel} onChange={(v) => setG({ ...g, minLevel: v })} />
              </Field>
              <Field label={t('homebrew.m.ability')}>
                <Select value={g.ability} onChange={(v) => setG({ ...g, ability: v })} options={abilities.map((x) => ({ value: x, label: x.toUpperCase() }))} empty="—" />
              </Field>
              <Check value={g.atWill} onChange={(v) => setG({ ...g, atWill: v || undefined })} label={t('homebrew.m.atWill')} />
            </div>
          )}
        />
        <Rows
          title={t('homebrew.m.attacks')}
          hint={t('homebrew.m.attacksHint')}
          rows={draft.attacks as Raw[]}
          onChange={(v) => set({ attacks: v })}
          make={() => ({ id: `attack-${(draft.attacks?.length ?? 0) + 1}`, name: '', range: 'melee', damage: { dice: '1d6', type: 'slashing' }, properties: [] })}
          render={(a, setA) => (
            <div className={grid}>
              <Field label={t('homebrew.f.name')}>
                <Text value={a.name} onChange={(v) => setA({ ...a, name: v })} />
              </Field>
              <Field label={t('homebrew.m.dice')}>
                <Text value={a.damage?.dice} onChange={(v) => setA({ ...a, damage: { ...a.damage, dice: v } })} />
              </Field>
              <Field label={t('homebrew.f.damageType')}>
                <Select value={a.damage?.type} onChange={(v) => setA({ ...a, damage: { ...a.damage, type: v } })} options={opts(DAMAGE)} />
              </Field>
              <Field label={t('homebrew.m.ability')}>
                <Select value={a.ability} onChange={(v) => setA({ ...a, ability: v })} options={abilities.map((x) => ({ value: x, label: x.toUpperCase() }))} empty={t('homebrew.m.strDex')} />
              </Field>
              <Field label={t('homebrew.m.while')}>
                <Text value={a.while} onChange={(v) => setA({ ...a, while: v || undefined })} />
              </Field>
              <div className="sm:col-span-3">
                <Field label={t('homebrew.f.properties')}>
                  <Multi value={a.properties} onChange={(v) => setA({ ...a, properties: v })} options={opts(PROPERTIES)} />
                </Field>
              </div>
            </div>
          )}
        />
        <p className="text-xs text-muted">{t('homebrew.m.moreInJson')}</p>
      </div>
    </Card>
  )
}
