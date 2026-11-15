// #/pdf: the desktop app's PDF tools — fill any character sheet with one of your characters (or
// a character file), and the AI settings. In a browser it tells what the desktop app adds.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Character } from '../engine/character'
import { CharacterExport } from '../engine/exchange'
import { useCharacterList } from '../state/characters'
import { useContent } from '../state/content'
import { AiSettings } from './AiSettings'
import { characterValues } from './characterValues'
import { DESKTOP_URL, isDesktop } from './bridge'
import { FillAnySheet, type FillCharacter } from './FillAnySheet'
import { FilePick, Section } from './ui'

function SavedCharacter({ character }: { character: Character }) {
  const content = useContent(character.edition)
  const values = useMemo(() => (content ? characterValues(character, content) : undefined), [character, content])
  return <FillAnySheet key={character.id} character={values ? { name: character.name, values } : undefined} />
}

export function PdfPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'fill' | 'ai'>('fill')
  const { characters } = useCharacterList(uid)
  const [pickedId, setPickedId] = useState('')
  const [fromFile, setFromFile] = useState<FillCharacter>()
  const [fileError, setFileError] = useState(false)
  const picked = characters?.find((c) => c.id === pickedId)?.character

  if (!isDesktop()) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Section title={`📄 ${t('desk.pdfTitle')}`}>
          <p className="text-sm">{t('desk.pdfWebIntro')}</p>
          <a className="mt-3 inline-block rounded bg-accent px-4 py-2 font-semibold text-accent-text" href={DESKTOP_URL} target="_blank" rel="noreferrer">
            🖥️ {t('desk.getApp')}
          </a>
        </Section>
      </div>
    )
  }

  async function pickFile(files: File[]) {
    setFileError(false)
    try {
      const r = CharacterExport.safeParse(JSON.parse(await files[0].text()))
      if (r.success) {
        setPickedId('')
        setFromFile({ name: r.data.name, values: r.data.values })
      } else setFileError(true)
    } catch {
      setFileError(true)
    }
  }

  const tabButton = (id: typeof tab, label: string) => (
    <button className={`rounded px-3 py-1.5 text-sm ${tab === id ? 'bg-accent font-semibold text-accent-text' : 'hover:bg-bg'}`} onClick={() => setTab(id)}>
      {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-heading text-2xl font-semibold">📄 {t('desk.pdfTitle')}</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {tabButton('fill', `📄 ${t('desk.tabFill')}`)}
          {tabButton('ai', `🤖 ${t('desk.tabAi')}`)}
        </nav>
      </div>
      {tab === 'ai' ? (
        <AiSettings />
      ) : (
        <>
          <p className="text-sm text-muted">{t('desk.exportIntro')}</p>
          <Section title={t('desk.step1')}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-border bg-card px-2 py-1.5 text-sm"
                value={pickedId}
                onChange={(e) => {
                  setPickedId(e.target.value)
                  setFromFile(undefined)
                }}
              >
                <option value="">— {t('desk.pickYourCharacter')} —</option>
                {characters?.flatMap((c) => (c.character ? [<option key={c.id} value={c.id}>{c.name}</option>] : []))}
              </select>
              <span className="text-xs text-muted">{t('desk.or')}</span>
              <FilePick label={t('desk.pickCharacter')} accept=".json,application/json" onFiles={(f) => void pickFile(f)} />
            </div>
            {fromFile && <p className="mt-2 font-semibold">✅ {fromFile.name}</p>}
            {fileError && <p className="mt-2 text-sm text-danger">{t('desk.badCharacter')}</p>}
          </Section>
          {picked ? <SavedCharacter character={picked} /> : <FillAnySheet character={fromFile} />}
        </>
      )}
    </div>
  )
}
