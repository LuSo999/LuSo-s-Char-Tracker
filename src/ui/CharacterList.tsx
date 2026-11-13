import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { sampleChampion } from '../data/samples'
import { addCharacter, deleteCharacter, parseCharacterFile, useCharacterList } from '../state/characters'
import { useOfficial } from '../state/official'
import { Card } from './Card'

export function CharacterList({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { characters, error } = useCharacterList(uid)
  const official = useOfficial()
  const fileInput = useRef<HTMLInputElement>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  async function importFile(file: File) {
    setImportErrors([])
    const result = parseCharacterFile(await file.text())
    if (!result.ok) return setImportErrors(result.errors)
    await addCharacter(uid, result.value)
  }

  function exportCharacter(id: string) {
    const c = characters?.find((x) => x.id === id)?.character
    if (!c) return
    const data: Partial<typeof c> = { ...c }
    delete data.id
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${c.name.replace(/[^\w\- ]+/g, '').trim() || 'character'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <Card>
        <h2 className="font-heading text-xl">{t('characters.title')}</h2>
        {error && <p className="mt-3 text-sm text-danger">{t('characters.loadFailed', { message: error.message })}</p>}
        {characters === null && !error && <p className="mt-3 text-muted">{t('loading')}</p>}
        {characters?.length === 0 && <p className="mt-3 text-muted">{t('characters.empty')}</p>}
        <ul className="mt-3 divide-y divide-border">
          {characters?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              {c.character ? (
                <Link to={`/c/${c.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-2 text-sm text-muted">
                    {c.character.edition === '2014' ? '5e' : '5.5e'} · {c.character.classes.map((x) => `${x.classId} ${x.level}`).join(' / ')}
                  </span>
                </Link>
              ) : (
                <span className="min-w-0 flex-1">
                  {c.name || '—'} <span className="text-sm text-danger">{t('characters.invalid')}</span>
                </span>
              )}
              {c.character && (
                <button className="text-sm text-muted hover:underline" onClick={() => exportCharacter(c.id)}>
                  {t('characters.export')}
                </button>
              )}
              <button
                className="text-sm text-danger hover:underline"
                onClick={() => {
                  if (confirm(t('characters.confirmDelete', { name: c.name || '—' }))) void deleteCharacter(uid, c.id)
                }}
              >
                {t('characters.delete')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/new" className="rounded bg-accent px-4 py-2 font-medium text-accent-text hover:opacity-90">
            ➕ {t('create.new')}
          </Link>
          <button className="rounded border border-border px-4 py-2 hover:bg-bg" onClick={() => void addCharacter(uid, sampleChampion)}>
            {t('characters.addSample')}
          </button>
          <Link to="/homebrew" className="rounded border border-border px-4 py-2 hover:bg-bg">
            🧪 {t('homebrew.title')}
          </Link>
          <button className="rounded border border-border px-4 py-2 hover:bg-bg" onClick={() => fileInput.current?.click()}>
            {t('characters.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void importFile(f)
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{t('characters.creatorLater')}</p>
        {importErrors.length > 0 && (
          <div className="mt-3 rounded border border-danger p-3 text-sm">
            <p className="font-semibold text-danger">{t('characters.importFailed')}</p>
            <ul className="mt-1 list-disc pl-5">
              {importErrors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <p className="text-center text-sm text-muted">
        {official.status === 'ready' && t('content.ready', { count: official.packs.length })}
        {official.status === 'empty' && t('content.empty')}
        {official.status === 'noAccess' && t('content.noAccess')}
        {official.status === 'error' && t('content.error', { message: official.error })}
      </p>
    </div>
  )
}
