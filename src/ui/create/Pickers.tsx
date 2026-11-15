// The class, species and background steps of character creation: what each list can be
// searched by and filtered on, and how a row looks.
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, skills, type Background, type Class, type Skill, type Species } from '../../content/schema'
import { RuleRef } from '../rules/RuleRef'
import { OtherEditionBadge } from '../sheet/BooksPicker'
import { signed } from '../sheet/format'
import { FilteredPicker, type ChipGroup } from './FilteredPicker'

/** Primary abilities: as given, else the multiclass prerequisites (which are the primary abilities by the rules). */
const primaryOf = (c: Class) => (c.primaryAbility.length ? c.primaryAbility : [...new Set(c.multiclass?.prerequisites.flat().map((p) => p.ability) ?? [])])

type Common = { content: ContentIndex; value: string; onChange: (id: string) => void; radio: (on: boolean) => string }
const names = (content: ContentIndex, ids: string[]) => ids.map((id) => content.get(id)?.name ?? id)

// --- Classes ----------------------------------------------------------------------------------

export function ClassPicker({ classes, ...common }: Common & { classes: Class[] }) {
  const { t } = useTranslation()
  const { content } = common
  const casting = (c: Class) => (c.spellcasting !== 'none' ? c.spellcasting : c.caster ? 'full' : 'none')
  const groups: ChipGroup<Class>[] = [
    { id: 'hitDie', mode: 'any', options: [6, 8, 10, 12].map((d) => ({ value: String(d), label: `d${d}`, title: t('create.filter.hitDie'), test: (c: Class) => c.hitDie === d })) },
    {
      id: 'casting',
      mode: 'any',
      options: (['full', 'half', 'third', 'pact', 'none'] as const).map((k) => ({ value: k, label: t(`create.filter.casting.${k}`), test: (c: Class) => casting(c) === k })),
    },
    { id: 'primary', mode: 'any', options: abilities.map((a) => ({ value: a, label: a.toUpperCase(), title: t('create.filter.primary'), test: (c: Class) => primaryOf(c).includes(a) })) },
  ]
  return (
    <FilteredPicker
      items={classes}
      {...common}
      groups={groups}
      search={(c) => [c.description, ...content.all('subclass').filter((s) => s.class === c.id).map((s) => s.name)]}
      render={(c) => (
        <>
          <RuleRef entity={c} content={content} className="font-semibold">
            {c.name}
          </RuleRef>
          <span className="ml-2 text-xs text-muted">
            {[`d${c.hitDie}`, primaryOf(c).map((a) => a.toUpperCase()).join('/'), `${t('create.saves')} ${c.savingThrows.map((a) => a.toUpperCase()).join(', ')}`].filter(Boolean).join(' · ')}
          </span>
          {c.description && <span className="block text-xs text-muted">{c.description}</span>}
        </>
      )}
    />
  )
}

// --- Species ----------------------------------------------------------------------------------

/** What a species' traits (and its subspecies' traits) give, from their effects. */
function speciesFeatures(s: Species, content: ContentIndex) {
  const out = new Set<string>()
  const traitIds = [...s.traits, ...s.subspecies.flatMap((id) => content.getTyped(id, 'subspecies')?.traits ?? [])]
  for (const id of traitIds) {
    for (const e of content.get(id)?.effects ?? []) {
      if (e.target === 'sense:darkvision') out.add('darkvision')
      else if (e.target === 'speed:fly') out.add('fly')
      else if (e.target === 'speed:swim') out.add('swim')
      else if (e.target === 'speed:climb') out.add('climb')
      else if (e.target.startsWith('resistance:')) out.add('resistance')
    }
  }
  return out
}
const sizesOf = (s: Species) => s.size.split(/\s*(?:,|\bor\b|\/)\s*/i).filter(Boolean)

export function SpeciesPicker({ species, ...common }: Common & { species: Species[] }) {
  const { t } = useTranslation()
  const { content } = common
  const features = new Map(species.map((s) => [s.id, speciesFeatures(s, content)]))
  const groups: ChipGroup<Species>[] = [
    { id: 'size', mode: 'any', options: ['Tiny', 'Small', 'Medium', 'Large'].map((z) => ({ value: z, label: z, test: (s: Species) => sizesOf(s).includes(z) })) },
    {
      id: 'features',
      mode: 'all',
      options: ['darkvision', 'fly', 'swim', 'climb', 'resistance'].map((f) => ({ value: f, label: t(`create.filter.species.${f}`), test: (s: Species) => !!features.get(s.id)?.has(f) })),
    },
    { id: 'ability', mode: 'one', options: abilities.map((a) => ({ value: a, label: `${a.toUpperCase()} +`, title: t('create.filter.abilityIncrease'), test: (s: Species) => s.abilityBonuses.some((b) => b.ability === a && b.bonus > 0) })) },
  ]
  return (
    <FilteredPicker
      items={species}
      {...common}
      groups={groups}
      // Subspecies and their traits too (Breath Weapon comes with the Draconic Ancestor).
      search={(s) => [
        ...names(content, s.traits),
        ...s.subspecies.flatMap((id) => {
          const sub = content.getTyped(id, 'subspecies')
          return sub ? [sub.name, ...names(content, sub.traits)] : []
        }),
      ]}
      render={(s) => (
        <>
          <RuleRef entity={s} content={content} className="font-semibold">
            {s.name}
          </RuleRef>
          <OtherEditionBadge tags={s.tags} />
          <span className="ml-2 text-xs text-muted">
            {s.size} · {s.speed} ft
            {s.abilityBonuses.length > 0 && ` · ${s.abilityBonuses.map((b) => `${b.ability.toUpperCase()} ${signed(b.bonus)}`).join(', ')}`}
          </span>
          <span className="block text-xs text-muted">{names(content, s.traits).join(', ')}</span>
        </>
      )}
    />
  )
}

// --- Backgrounds ------------------------------------------------------------------------------

export function BackgroundPicker({ backgrounds, ...common }: Common & { backgrounds: Background[] }) {
  const { t } = useTranslation()
  const { content } = common
  const skillName = (s: Skill) => content.get(`skill-${s}`)?.name ?? s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const feats = [...new Set(backgrounds.flatMap((b) => (b.feat ? [b.feat] : [])))].sort((a, b) => (content.get(a)?.name ?? a).localeCompare(content.get(b)?.name ?? b))
  const groups: ChipGroup<Background>[] = [
    { id: 'skills', mode: 'all', options: (Object.keys(skills) as Skill[]).map((s) => ({ value: s, label: skillName(s), title: t('create.filter.skill'), test: (b: Background) => b.skills.includes(s) })) },
    { id: 'abilities', mode: 'all', options: abilities.map((a) => ({ value: a, label: `${a.toUpperCase()} +`, title: t('create.filter.abilityIncrease'), test: (b: Background) => b.abilityOptions.includes(a) })) },
    { id: 'feat', mode: 'any', options: feats.map((f) => ({ value: f, label: content.get(f)?.name ?? f, title: t('create.filter.feat'), test: (b: Background) => b.feat === f })) },
  ]
  return (
    <FilteredPicker
      items={backgrounds}
      {...common}
      groups={groups}
      search={(b) => [...b.skills.map(skillName), ...(b.feat ? [content.get(b.feat)?.name ?? b.feat] : []), ...b.tools.map((x) => content.get(x)?.name ?? x), ...names(content, b.features)]}
      render={(b) => (
        <>
          <RuleRef entity={b} content={content} className="font-semibold">
            {b.name}
          </RuleRef>
          <span className="block text-xs text-muted">
            {[b.skills.map(skillName).join(', '), b.feat && content.get(b.feat)?.name, b.abilityOptions.length > 0 && b.abilityOptions.map((a) => a.toUpperCase()).join('/')].filter(Boolean).join(' · ')}
          </span>
        </>
      )}
    />
  )
}
