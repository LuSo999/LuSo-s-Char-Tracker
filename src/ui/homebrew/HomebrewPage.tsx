import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { Edition } from '../../content/schema'
import { exportPack } from './download'
import { copyPack, newPack, parsePackFile } from '../../engine/homebrew'
import { deletePack, savePack, useHomebrew } from '../../state/homebrew'
import { BackToSheet } from '../BackToSheet'
import { Card } from '../Card'
import { useHomebrewBase } from './base'

/** The player's homebrew packs: create, import, export, delete. */
export function HomebrewPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const base = useHomebrewBase()
  const { packs, status, broken } = useHomebrew()
  const [name, setName] = useState('')
  const [edition, setEdition] = useState<Edition>('2024')
  const [errors, setErrors] = useState<string[]>()
  const file = useRef<HTMLInputElement>(null)

  async function create() {
    const pack = newPack(edition, name.trim() || t('homebrew.untitled'))
    await savePack(uid, pack)
    setName('')
    navigate(`${base}/${pack.id}`)
  }

  async function importFile(f: File) {
    const r = parsePackFile(await f.text())
    if (!r.ok) return setErrors(r.notJson ? [t('homebrew.notJson'), ...r.errors] : [t('homebrew.invalidPack'), ...r.errors])
    setErrors(undefined)
    let pack = r.pack
    // Homebrew packs keep their own book id; a pack you already have is imported as a copy (or replaces it).
    if (packs.some((p) => p.id === pack.id)) {
      if (!confirm(t('homebrew.replaceConfirm', { name: pack.name }))) pack = copyPack(pack)
    }
    if (!pack.book.startsWith('homebrew')) pack = { ...pack, book: `homebrew:${pack.id}`, entities: pack.entities.map((e) => ({ ...e, source: { ...e.source, book: `homebrew:${pack.id}` } })) }
    await savePack(uid, pack)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <BackToSheet />
      <Card>
        <h1 className="font-heading text-2xl font-semibold">🧪 {t('homebrew.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('homebrew.intro')}</p>
        {status === 'loading' && <p className="mt-3 text-sm text-muted">{t('loading')}</p>}
        <ul className="mt-3 divide-y divide-border">
          {packs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link to={`${base}/${p.id}`} className="font-semibold text-accent underline">
                {p.name}
              </Link>
              <span className="text-xs text-muted">
                {p.edition === '2014' ? '5e (2014)' : '5.5e (2024)'} · {t('homebrew.count', { count: p.entities.length })}
              </span>
              <span className="ml-auto flex gap-2">
                <button className="text-sm hover:underline" onClick={() => exportPack(p)}>
                  ⬇️ {t('homebrew.export')}
                </button>
                <button
                  className="text-sm text-danger hover:underline"
                  onClick={() => {
                    if (confirm(t('homebrew.deleteConfirm', { name: p.name }))) void deletePack(uid, p.id)
                  }}
                >
                  🗑 {t('homebrew.delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
        {packs.length === 0 && status === 'ready' && <p className="mt-3 text-sm text-muted">{t('homebrew.none')}</p>}
        {broken.length > 0 && <p className="mt-2 text-sm text-danger">{t('homebrew.broken', { count: broken.length })}</p>}
      </Card>

      <Card>
        <h2 className="font-heading text-lg font-semibold">{t('homebrew.newPack')}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1" placeholder={t('homebrew.packName')} value={name} onChange={(e) => setName(e.target.value)} />
          <select className="rounded border border-border bg-card px-2 py-1" value={edition} onChange={(e) => setEdition(e.target.value as Edition)}>
            <option value="2024">5.5e (2024)</option>
            <option value="2014">5e (2014)</option>
          </select>
          <button className="rounded bg-accent px-3 py-1.5 font-medium text-accent-text" onClick={() => void create()}>
            ➕ {t('homebrew.create')}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <button className="rounded border border-border px-3 py-1.5 hover:bg-bg" onClick={() => file.current?.click()}>
            ⬆️ {t('homebrew.import')}
          </button>
          <span className="text-xs text-muted">{t('homebrew.importHint')}</span>
          <input
            ref={file}
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
        {errors && (
          <ul className="mt-3 list-disc rounded border border-danger p-3 pl-8 text-sm text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          {t('homebrew.formatHint')}{' '}
          <a className="text-accent underline" href="https://github.com/LuSo999/LuSo-s-Char-Tracker/blob/main/docs/content-format.md" target="_blank" rel="noreferrer">
            docs/content-format.md
          </a>
        </p>
      </Card>
    </div>
  )
}
