import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../App'
import { createCharacter, deleteCharacter, useCharacterList } from '../state/characters'

export function CharacterList({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { characters, error } = useCharacterList(uid)
  const [name, setName] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    await createCharacter(uid, trimmed)
  }

  return (
    <Card>
      <h2 className="font-heading text-xl">{t('characters.title')}</h2>
      {error && <p className="mt-3 text-sm text-danger">{t('characters.loadFailed', { message: error.message })}</p>}
      {characters === null && !error && <p className="mt-3 text-muted">{t('loading')}</p>}
      {characters?.length === 0 && <p className="mt-3 text-muted">{t('characters.empty')}</p>}
      <ul className="mt-3 divide-y divide-border">
        {characters?.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span>{c.name}</span>
            <button
              className="text-sm text-danger hover:underline"
              onClick={() => {
                if (confirm(t('characters.confirmDelete', { name: c.name }))) void deleteCharacter(uid, c.id)
              }}
            >
              {t('characters.delete')}
            </button>
          </li>
        ))}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => void handleCreate(e)}>
        <input
          className="min-w-0 flex-1 rounded border border-border bg-card px-3 py-2"
          placeholder={t('characters.newName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="rounded bg-accent px-4 py-2 font-medium text-accent-text hover:opacity-90" type="submit">
          {t('characters.create')}
        </button>
      </form>
    </Card>
  )
}
