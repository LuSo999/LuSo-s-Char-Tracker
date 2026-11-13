import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OfficialContent, Pack } from '../content/schema'
import { deleteOfficial, deleteOfficialPack, getAccess, getOfficialMeta, setAccess, uploadOfficial, uploadOfficialPacks, type Access } from '../state/official'
import { BackToSheet } from './BackToSheet'
import { Card } from './Card'

type Parsed = { ok: true; value: OfficialContent } | { ok: false; errors: string[] }

function parseFile(text: string): Parsed {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  const r = OfficialContent.safeParse(json)
  if (r.success) return { ok: true, value: r.data }
  // A single book file (private/packs/<book>.json) works too.
  const one = Pack.safeParse(json)
  if (one.success) return { ok: true, value: { version: new Date().toISOString(), packs: [one.data] } }
  return { ok: false, errors: r.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`) }
}

export function AdminPage() {
  const { t } = useTranslation()
  const [parsed, setParsed] = useState<Parsed>()
  const [progress, setProgress] = useState<string>()
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof getOfficialMeta>>>()
  const [access, setAccessState] = useState<Access>()
  const [invitedText, setInvitedText] = useState('')
  const [saved, setSaved] = useState(false)
  // Books of the chosen file to upload (all by default).
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    void getOfficialMeta().then(setMeta)
    void getAccess().then((a) => {
      setAccessState(a)
      setInvitedText(a.invited.join('\n'))
    })
  }, [])

  async function upload(mode: 'replaceAll' | 'merge') {
    if (!parsed?.ok) return
    if (mode === 'replaceAll' && meta && !confirm(t('admin.replaceAllConfirm'))) return
    setProgress(t('admin.uploading', { done: 0, total: '…' }))
    try {
      const packs = parsed.value.packs.filter((p) => picked.has(p.id))
      const onProgress = (done: number, total: number) => setProgress(t('admin.uploading', { done, total }))
      if (mode === 'merge') await uploadOfficialPacks(packs, onProgress)
      else await uploadOfficial({ ...parsed.value, packs }, onProgress)
      setProgress(t('admin.uploaded'))
      setMeta(await getOfficialMeta())
      setAccessState(await getAccess())
    } catch (e) {
      setProgress(t('admin.uploadFailed', { message: e instanceof Error ? e.message : String(e) }))
    }
  }

  async function saveAccess(next: Access) {
    setSaved(false)
    await setAccess(next)
    const fresh = await getAccess()
    setAccessState(fresh)
    setInvitedText(fresh.invited.join('\n'))
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <BackToSheet />
      <Card>
        <h2 className="font-heading text-xl">{t('admin.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('admin.intro')}</p>
        {meta ? (
          <div className="mt-3 text-sm">
            <p>{t('admin.current', { version: meta.version })}</p>
            <ul className="list-disc pl-5">
              {meta.packs.map((p) => (
                <li key={p.id}>
                  {p.name} ({p.edition}) — {p.entities}
                  <button
                    className="ml-2 rounded border border-danger/60 px-1.5 text-xs text-danger hover:bg-danger/10"
                    title={t('admin.deletePack', { name: p.name })}
                    onClick={async () => {
                      if (!confirm(t('admin.deletePackConfirm', { name: p.name }))) return
                      setProgress(t('admin.deleting', { done: 0, total: 1 }))
                      await deleteOfficialPack(p.id)
                      setProgress(t('admin.packDeleted', { name: p.name }))
                      setMeta(await getOfficialMeta())
                    }}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{t('admin.nothing')}</p>
        )}
        <input
          type="file"
          accept="application/json,.json"
          className="mt-4 block text-sm file:mr-3 file:cursor-pointer file:rounded file:border file:border-accent file:bg-accent file:px-4 file:py-2 file:font-medium file:text-accent-text hover:file:opacity-90"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            setProgress(undefined)
            const p = f ? parseFile(await f.text()) : undefined
            setParsed(p)
            setPicked(new Set(p?.ok ? p.value.packs.map((x) => x.id) : []))
          }}
        />
        {parsed && !parsed.ok && (
          <ul className="mt-3 list-disc rounded border border-danger p-3 pl-8 text-sm text-danger">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {parsed?.ok && (
          <div className="mt-3 text-sm">
            <ul className="list-disc pl-5">
              {parsed.value.packs.map((p) => (
                <li key={p.id} className="list-none">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(picked)
                        if (e.target.checked) next.add(p.id)
                        else next.delete(p.id)
                        setPicked(next)
                      }}
                    />
                    {p.name} ({p.edition}) — {p.entities.length}, {t('admin.unverified', { count: p.entities.filter((x) => !x.verified).length })}
                    <span className="text-xs text-muted">{meta?.packs.some((m) => m.id === p.id) ? t('admin.willUpdate') : t('admin.willAdd')}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded bg-accent px-4 py-2 font-medium text-accent-text disabled:opacity-50" disabled={!picked.size} onClick={() => void upload('merge')}>
                {t('admin.uploadPicked', { count: picked.size })}
              </button>
              <button className="rounded border border-border px-4 py-2 hover:bg-bg disabled:opacity-50" disabled={!picked.size} onClick={() => void upload('replaceAll')}>
                {t('admin.uploadReplaceAll')}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">{t('admin.uploadHint')}</p>
          </div>
        )}
        {progress && <p className="mt-2 text-sm">{progress}</p>}
        {meta && (
          <button
            className="mt-4 rounded border border-danger px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
            onClick={async () => {
              if (!confirm(t('admin.deleteConfirm'))) return
              await deleteOfficial((done, total) => setProgress(t('admin.deleting', { done, total })))
              setProgress(t('admin.deleted'))
              setMeta(await getOfficialMeta())
            }}
          >
            🗑 {t('admin.delete')}
          </button>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-xl">{t('admin.access')}</h2>
        {access && (
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={access.restricted} onChange={(e) => void saveAccess({ ...access, restricted: e.target.checked })} />
              {t('admin.restricted')}
            </label>
            <label className="block">
              <span className="text-sm text-muted">{t('admin.invited')}</span>
              <textarea
                className="mt-1 block h-32 w-full rounded border border-border bg-card p-2 font-mono text-sm"
                value={invitedText}
                onChange={(e) => {
                  setSaved(false)
                  setInvitedText(e.target.value)
                }}
              />
            </label>
            <button
              className="rounded border border-border px-4 py-2 hover:bg-bg"
              onClick={() => void saveAccess({ ...access, invited: invitedText.split(/[\s,;]+/) })}
            >
              {t('admin.save')}
            </button>
            {saved && <span className="ml-3 text-sm text-muted">{t('admin.saved')}</span>}
          </div>
        )}
      </Card>
    </div>
  )
}
