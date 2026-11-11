import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, skills, type Skill } from '../../content/schema'
import type { Sheet } from '../../engine/derive'
import { Panel } from './common'
import { breakdown, signed } from './format'

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
                  {a} <span className={`tabular-nums ${sheet.scores[a].overridden ? 'text-accent' : ''}`}>{sheet.scores[a].value}</span>
                </div>
                <div className="text-xl font-semibold leading-6 tabular-nums">{signed(sheet.mods[a])}</div>
              </div>
              <div
                className={`border-t border-border text-[11px] leading-4 ${save.proficient ? 'font-semibold' : 'text-muted'}`}
                title={`${t('sheet.savingThrow')} (${abilityNames[a]})\n${breakdown(save)}`}
              >
                <ProfDot level={save.proficient ? 1 : 0} /> {t('sheet.save')} <span className="tabular-nums">{signed(save.value)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-sm">
        <span title={breakdown(sheet.pb)}>
          {t('sheet.proficiencyBonus')} <strong>{signed(sheet.pb.value)}</strong>
        </span>
        <span title={breakdown(sheet.passivePerception)}>
          {t('sheet.passivePerception')} <strong>{sheet.passivePerception.value}</strong>
        </span>
      </div>

      <h3 className="mt-2 mb-0.5 text-xs font-semibold uppercase text-muted">{t('sheet.skills')}</h3>
      <ul className="text-[13px] leading-5">
        {(Object.keys(skills) as Skill[]).map((s) => {
          const v = sheet.skills[s]
          return (
            <li key={s} className={`flex justify-between ${v.proficiency ? 'font-semibold' : 'text-muted'}`} title={breakdown(v)}>
              <span>
                <ProfDot level={v.proficiency} /> {skillName(s)} <span className="text-[10px] uppercase opacity-70">{skills[s]}</span>
              </span>
              <span className="tabular-nums">{signed(v.value)}</span>
            </li>
          )
        })}
      </ul>
    </Panel>
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
