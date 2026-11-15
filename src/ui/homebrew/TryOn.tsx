// "Try on a character": the sheet of one of your characters without and with the entity being edited
// (unsaved changes included), as a list of what changes and where it shows.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ContentIndex } from '../../content'
import type { Pack } from '../../content/schema'
import { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import { checkEntity } from '../../engine/homebrew'
import { diffSheets, tryOnToggles, wearEntity, type DiffLine } from '../../engine/sheetDiff'
import { sampleChampion, sampleWizard } from '../../data/samples'
import { useCharacterList } from '../../state/characters'
import { useContentPacks } from '../../state/content'
import { Card } from '../Card'
import { describeEffect } from './describe'
import { PlaceBadge } from './fields'
import { input } from './ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>
type Candidate = { id: string; name: string; character: Character }

const samples = (): Candidate[] => [
  { id: 'sample-champion', name: sampleChampion.name, character: Character.parse({ ...sampleChampion, id: 'sample-champion' }) },
  { id: 'sample-wizard', name: sampleWizard.name, character: Character.parse({ ...sampleWizard, id: 'sample-wizard' }) },
]

const TRYABLE = ['feature', 'trait', 'feat', 'item', 'spell', 'species', 'subspecies', 'background', 'subclass', 'condition']

export function TryOn({ uid, pack, draft }: { uid: string; pack: Pack; draft: Raw }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!TRYABLE.includes(draft.type)) return null
  return (
    <Card>
      <button type="button" className="flex w-full items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="font-heading text-lg font-semibold">🧪 {t('homebrew.tryOn.title')}</span>
        <span className="text-xs text-muted">{t('homebrew.tryOn.hint')}</span>
        <span className="ml-auto text-muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (uid === 'dev' ? <TryOnBody candidates={[]} pack={pack} draft={draft} /> : <WithCharacters uid={uid} pack={pack} draft={draft} />)}
    </Card>
  )
}

function WithCharacters({ uid, pack, draft }: { uid: string; pack: Pack; draft: Raw }) {
  const { characters } = useCharacterList(uid)
  const own = (characters ?? []).flatMap((c) => (c.character ? [{ id: c.id, name: c.name, character: c.character }] : []))
  return <TryOnBody candidates={own} pack={pack} draft={draft} />
}

function TryOnBody({ candidates, pack, draft }: { candidates: Candidate[]; pack: Pack; draft: Raw }) {
  const { t } = useTranslation()
  const packs = useContentPacks(pack.edition)
  const all = useMemo(() => [...candidates, ...(pack.edition === '2024' ? samples() : [])].filter((c) => c.character.edition === pack.edition), [candidates, pack.edition])
  const [pickedId, setPickedId] = useState<string>()
  const [toggles, setToggles] = useState<string[]>([])
  const chosen = all.find((c) => c.id === pickedId) ?? all[0]

  const result = useMemo(() => {
    if (!packs || !chosen) return undefined
    const parsed = checkEntity(draft)
    if (!parsed.ok) return { error: parsed.errors.join('; ') }
    // The pack with the draft as it is now (saved or not).
    const withDraft = { ...pack, entities: pack.entities.some((e) => e.id === parsed.entity.id) ? pack.entities.map((e) => (e.id === parsed.entity.id ? parsed.entity : e)) : [...pack.entities, parsed.entity] }
    const content = new ContentIndex(pack.edition, [...packs.filter((p) => p.id !== pack.id), withDraft])
    const worn = wearEntity(chosen.character, parsed.entity)
    if (!worn) return { error: t('homebrew.tryOn.notHere') }
    try {
      const before = computeSheet(chosen.character, content)
      const afterOff = computeSheet(worn.character, content)
      const own = tryOnToggles(afterOff, parsed.entity.id)
      const after = toggles.length ? computeSheet({ ...worn.character, toggles: [...worn.character.toggles, ...toggles] }, content) : afterOff
      return { diff: diffSheets(before, after), picked: worn.picked, toggles: own, content }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [packs, chosen, draft, pack, toggles, t])

  if (!all.length) return <p className="mt-2 text-sm text-muted">{t('homebrew.tryOn.noCharacters')}</p>
  return (
    <div className="mt-2 space-y-2 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted">{t('homebrew.tryOn.character')}</span>
        <select className={`${input} w-auto`} value={chosen?.id} onChange={(e) => {
            setPickedId(e.target.value)
            setToggles([])
          }}>
          {all.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.character.classes.map((x) => `${x.classId} ${x.level}`).join(', ')})
            </option>
          ))}
        </select>
      </label>
      {!result ? (
        <p className="text-muted">{t('loading')}</p>
      ) : 'error' in result ? (
        <p className="text-danger">⚠️ {result.error}</p>
      ) : (
        <>
          {result.picked.length > 0 && <p className="text-xs text-muted">{t('homebrew.tryOn.picked', { list: result.picked.map((p) => `${p.label}: ${p.values.join(', ')}`).join('; ') })}</p>}
          {result.toggles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted">{t('homebrew.tryOn.switches')}</span>
              {result.toggles.map((tg) => (
                <label key={tg.key} className="flex items-center gap-1">
                  <input type="checkbox" checked={toggles.includes(tg.key)} onChange={(e) => setToggles(e.target.checked ? [...toggles, tg.key] : toggles.filter((x) => x !== tg.key))} />
                  {tg.label}
                </label>
              ))}
            </div>
          )}
          {result.diff.length === 0 ? <p className="text-muted">{t('homebrew.tryOn.nothing')}</p> : <DiffList lines={result.diff} content={result.content} />}
        </>
      )}
    </div>
  )
}

function DiffList({ lines, content }: { lines: DiffLine[]; content: ContentIndex }) {
  const { t } = useTranslation()
  const places = [...new Set(lines.map((l) => l.place))]
  const name = (l: DiffLine) => {
    if (!l.name) return ''
    if (l.key === 'score' || l.key === 'save' || l.key === 'saveProficiency') return l.name.toUpperCase()
    if (l.key === 'skill' || l.key === 'skillProficiency') return content.get(`skill-${l.name}`)?.name ?? l.name
    if (l.key === 'caster') return content.get(l.name)?.name ?? l.name
    return l.name
  }
  return (
    <div className="space-y-2">
      {places.map((p) => (
        <div key={p}>
          <PlaceBadge place={p} />
          <ul className="mt-1 space-y-0.5 pl-2">
            {lines
              .filter((l) => l.place === p)
              .map((l, i) => {
                const label = l.key === 'ally' ? describeEffect({ target: l.name ?? '', op: 'add', value: Number(l.after ?? l.before), range: l.range }, { t, content }) : t(`homebrew.diff.${l.key}`, { name: name(l) })
                const value = (v: string | undefined) => (v && v !== '✓' && l.key !== 'ally' ? `: ${v}` : '')
                return (
                  <li key={i} className={l.after === undefined ? 'text-danger' : ''}>
                    {l.before === undefined ? (
                      <>
                        + <span className="font-semibold">{label}</span>
                        {value(l.after)}
                      </>
                    ) : l.after === undefined ? (
                      <>
                        − <span className="font-semibold">{label}</span>
                        {value(l.before)}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{label}</span>: {l.before} → <span className="font-semibold text-accent">{l.after}</span>
                      </>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}
