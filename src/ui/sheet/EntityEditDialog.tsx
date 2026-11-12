import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ruleLink } from '../../content/links'
import { customize } from '../../engine/edits'
import { useSettings } from '../../state/settings'
import { useRun, useSheet } from './context'
import { useEditMode } from './editMode'
import { Dialog } from './RestDialog'

/** Mounts the dialog fresh for each edited entity. */
export function EntityEditHost() {
  const editing = useEditMode((s) => s.editing)
  return editing ? <EntityEditDialog key={editing.id} /> : null
}

/** Edit mode: the character's own name, summary and link for something from the rules. */
function EntityEditDialog() {
  const { t } = useTranslation()
  const { character, baseContent } = useSheet()
  const run = useRun()
  const editing = useEditMode((s) => s.editing)
  const site = useSettings((s) => s.linkSite)
  const custom = editing ? (character.customizations[editing.id] ?? {}) : {}
  const [name, setName] = useState(custom.name ?? '')
  const [description, setDescription] = useState(custom.description ?? '')
  const [url, setUrl] = useState(custom.url ?? '')
  if (!editing) return null
  const close = () => useEditMode.setState({ editing: undefined })
  // The rules version without this character's changes, for placeholders and "reset".
  const original = baseContent.get(editing.id) ?? editing
  const originalName = original.name
  const defaultLink = original.source.url ?? ruleLink({ ...original, source: { ...original.source, url: undefined } }, baseContent, site[original.edition])

  async function save() {
    if (await run(customize(character, editing!.id, originalName, { name, description, url }))) close()
  }

  const input = 'mt-1 block w-full rounded border border-border bg-card px-2 py-1'
  return (
    <Dialog title={`✏️ ${originalName}`} onClose={close}>
      <div className="space-y-3 text-sm">
        <label className="block">
          {t('edit.name')}
          <input className={input} placeholder={originalName} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          {t('edit.description')}
          <textarea className={`${input} h-28`} placeholder={original.description} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block">
          {t('edit.link')}
          <input className={input} placeholder={defaultLink} value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <p className="text-xs text-muted">{t('edit.emptyResets')}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {Object.keys(custom).length > 0 && (
          <button className="mr-auto text-sm text-muted underline" onClick={() => void run(customize(character, editing.id, originalName, { name: '', description: '', url: '' })).then((g) => g && close())}>
            ↺ {t('edit.resetAll')}
          </button>
        )}
        <button className="rounded border border-border px-4 py-2" onClick={close}>
          {t('cancel')}
        </button>
        <button className="rounded bg-accent px-4 py-2 font-semibold text-accent-text" onClick={() => void save()}>
          {t('edit.save')}
        </button>
      </div>
    </Dialog>
  )
}
