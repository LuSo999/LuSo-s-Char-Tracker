import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, skills, type Skill } from '../../content/schema'
import type { Sheet } from '../../engine/derive'
import { Panel } from './common'
import { useState } from 'react'
import { setBaseScore } from '../../engine/edits'
import { useRun, useSheet } from './context'
import { Editable } from './Editable'
import { useEditMode } from './editMode'
import { breakdown, signed } from './format'
import { Term } from '../rules/Term'

const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

const skillName = (s: Skill) =>
  s
    .split('-')
    .map((w) => (w === 'of' ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ')

export function AbilitiesPanel({ sheet }: { sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  return (
    <Panel title={t('sheet.abilities')} icon="💪">
      {/* Each box: modifier, score and saving throw, like the paper sheet. */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-3">
        {abilities.map((a) => {
          const save = sheet.saves[a]
          return (
            <div key={a} className="rounded border border-border px-1 py-0.5 text-center">
              <div title={breakdown(sheet.scores[a])}>
                <div className="text-[11px] font-semibold uppercase leading-4 text-muted">
                  {a} <Editable value={sheet.scores[a]} overrideKey={`score:${a}`} label={abilityNames[a]} className="tabular-nums" />
                </div>
                <BaseScore ability={a} />
                <div className="text-xl font-semibold leading-6 tabular-nums">{signed(sheet.mods[a])}</div>
              </div>
              <div
                className={`border-t border-border text-[11px] leading-4 ${save.proficient ? 'font-semibold' : 'text-muted'}`}
                title={`${t('sheet.savingThrow')} (${abilityNames[a]})\n${breakdown(save)}`}
              >
                <ProfDot level={save.proficient ? 1 : 0} /> <Term id="rule-saving-throw">{t('sheet.save')}</Term>{' '}
                <Editable value={save} overrideKey={`save:${a}`} label={`${t('sheet.savingThrow')} (${abilityNames[a]})`} format={signed} className="tabular-nums" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-sm">
        <span title={breakdown(sheet.pb)}>
          <Term id="rule-proficiency-bonus">{t('sheet.proficiencyBonus')}</Term>{' '}
          <strong>
            <Editable value={sheet.pb} overrideKey="pb" label={t('sheet.proficiencyBonus')} format={signed} />
          </strong>
        </span>
        <span title={breakdown(sheet.passivePerception)}>
          <Term id="rule-passive-perception">{t('sheet.passivePerception')}</Term>{' '}
          <strong>
            <Editable value={sheet.passivePerception} overrideKey="passive:perception" label={t('sheet.passivePerception')} />
          </strong>
        </span>
      </div>

      <h3 className="mt-2 mb-0.5 text-xs font-semibold uppercase text-muted">{t('sheet.skills')}</h3>
      <ul className="text-[13px] leading-5">
        {(Object.keys(skills) as Skill[]).map((s) => {
          const v = sheet.skills[s]
          return (
            <li key={s} className={`flex justify-between ${v.proficiency ? 'font-semibold' : 'text-muted'}`} title={breakdown(v)}>
              <span>
                <ProfDot level={v.proficiency} /> <Term id={`skill-${s}`}>{skillName(s)}</Term> <span className="text-[10px] uppercase opacity-70">{skills[s]}</span>
              </span>
              <Editable value={v} overrideKey={`skill:${s}`} label={skillName(s)} format={signed} className="tabular-nums" />
            </li>
          )
        })}
      </ul>
      <Proficiencies sheet={sheet} />
    </Panel>
  )
}

/** Armor, weapons, tools and languages, like the paper sheet's "Other proficiencies & languages". */
function Proficiencies({ sheet }: { sheet: Sheet }) {
  const { t } = useTranslation()
  const { content } = useSheet()
  const name = (id: string) => content.get(id)?.name ?? content.get(`${id}-armor`)?.name ?? id.replace(/-/g, ' ')
  const rows: [string, string[]][] = [
    [t('sheet.prof.armor'), sheet.armorProficiencies.map(name)],
    [t('sheet.prof.weapons'), sheet.weaponProficiencies.map(name)],
    [t('sheet.prof.tools'), sheet.toolProficiencies.map(name)],
    [t('sheet.prof.languages'), sheet.languages.map((l) => l.replace(/-/g, ' '))],
  ]
  return (
    <>
      <h3 className="mt-2 mb-0.5 text-xs font-semibold uppercase text-muted">{t('sheet.prof.title')}</h3>
      <dl className="space-y-0.5 text-xs">
        {rows.map(([label, list]) => (
          <div key={label}>
            <dt className="inline font-semibold">{label}: </dt>
            <dd className="inline capitalize text-muted">{list.length ? list.join(', ') : '—'}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

/** Edit mode: the score before bonuses (rolled, point buy or standard array). */
function BaseScore({ ability }: { ability: (typeof abilities)[number] }) {
  const { t } = useTranslation()
  const { character } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [draft, setDraft] = useState<string>()
  if (!edit) return null
  const base = character.baseScores[ability]
  if (draft !== undefined) {
    return (
      <input
        autoFocus
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        aria-label={t('edit.baseScore')}
        className="w-10 rounded border border-accent bg-card text-center text-[11px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => {
          const n = Number.parseInt(draft, 10)
          if (Number.isFinite(n)) void run(setBaseScore(character, ability, n))
          setDraft(undefined)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    )
  }
  return (
    <button className="text-[10px] text-muted underline decoration-dashed" title={t('edit.baseScoreHint')} onClick={() => setDraft(String(base))}>
      {t('edit.base')} {base}
    </button>
  )
}

function ProfDot({ level }: { level: number }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full border border-accent ${level >= 1 ? 'bg-accent' : ''} ${level >= 2 ? 'ring-2 ring-accent/40' : ''}`}
      aria-label={level >= 2 ? 'expertise' : level ? 'proficient' : 'not proficient'}
    />
  )
}
