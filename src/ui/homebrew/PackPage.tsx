import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import type { Pack } from '../../content/schema'
import { HOMEBREW_TYPES, missingReferences, newEntity, type HomebrewType } from '../../engine/homebrew'
import { savePack, useHomebrew } from '../../state/homebrew'
import { useContent } from '../../state/content'
import { Card } from '../Card'
import { useHomebrewBase } from './base'
import { exportPack } from './download'

/** One homebrew pack: its name and entities, grouped by type. */
export function PackPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { packId = '' } = useParams()
  const pack = useHomebrew((s) => s.packs.find((p) => p.id === packId))
  const status = useHomebrew((s) => s.status)
  if (!pack) return <p className="p-4 text-muted">{status === 'ready' ? t('homebrew.notFound') : t('loading')}</p>
  return <PackView uid={uid} pack={pack} />
}

function PackView({ uid, pack }: { uid: string; pack: Pack }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const base = useHomebrewBase()
  const content = useContent(pack.edition)
  const [type, setType] = useState<HomebrewType>('feature')
  const [name, setName] = useState('')
  const save = (p: Pack) => savePack(uid, p)
  const missing = content ? missingReferences(pack, (id) => !!content.get(id)) : []

  async function add() {
    const e = newEntity(pack, type, name.trim() || t(`homebrew.types.${type}`))
    await save({ ...pack, entities: [...pack.entities, e] })
    setName('')
    navigate(`${base}/${pack.id}/${encodeURIComponent(e.id)}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <Link to={base} className="text-sm text-accent underline">
        ‹ {t('homebrew.title')}
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1 font-heading text-xl font-semibold"
            defaultValue={pack.name}
            aria-label={t('homebrew.packName')}
            onBlur={(e) => e.target.value.trim() && e.target.value !== pack.name && void save({ ...pack, name: e.target.value.trim() })}
          />
          <span className="text-xs text-muted">{pack.edition === '2014' ? '5e (2014)' : '5.5e (2024)'}</span>
          <button className="text-sm hover:underline" onClick={() => exportPack(pack)}>
            ⬇️ {t('homebrew.export')}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">{t('homebrew.packHint')}</p>
        {missing.length > 0 && (
          <div className="mt-3 rounded border border-amber-500/60 bg-amber-500/10 p-2 text-sm">
            ⚠️ {t('homebrew.missing')}
            <ul className="list-disc pl-5 text-xs">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {HOMEBREW_TYPES.filter((ty) => pack.entities.some((e) => e.type === ty)).map((ty) => (
        <Card key={ty}>
          <h2 className="mb-1 font-heading text-lg font-semibold">{t(`homebrew.typesPlural.${ty}`)}</h2>
          <ul className="divide-y divide-border">
            {pack.entities
              .filter((e) => e.type === ty)
              .map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-1.5">
                  <Link to={`${base}/${pack.id}/${encodeURIComponent(e.id)}`} className="font-semibold text-accent underline">
                    {e.name}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{e.description}</span>
                  <button
                    className="text-sm text-danger hover:underline"
                    onClick={() => {
                      if (confirm(t('homebrew.deleteEntityConfirm', { name: e.name }))) void save({ ...pack, entities: pack.entities.filter((x) => x.id !== e.id) })
                    }}
                  >
                    🗑
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      ))}

      <Card>
        <h2 className="font-heading text-lg font-semibold">{t('homebrew.addEntity')}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <select className="rounded border border-border bg-card px-2 py-1" value={type} onChange={(e) => setType(e.target.value as HomebrewType)}>
            {HOMEBREW_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`homebrew.types.${ty}`)}
              </option>
            ))}
          </select>
          <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1" placeholder={t('homebrew.entityName')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="rounded bg-accent px-3 py-1.5 font-medium text-accent-text" onClick={() => void add()}>
            ➕ {t('homebrew.add')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{t(`homebrew.typeHints.${type}`)}</p>
      </Card>
    </div>
  )
}
