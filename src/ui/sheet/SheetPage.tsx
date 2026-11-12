import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import type { ContentIndex } from '../../content'
import type { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import { useCharacter } from '../../state/characters'
import { useContent } from '../../state/content'
import { undoable, useFirestoreStore, type CharacterStore } from '../../state/history'
import { rememberCharacter } from '../../state/lastCharacter'
import { useOfficial } from '../../state/official'
import { HistoryDrawer } from '../history/HistoryDrawer'
import { InventoryDrawer } from '../inventory/InventoryDrawer'
import { EdgeHandle } from './SidePanel'
import { SpellcastingDrawer } from '../spells/SpellcastingDrawer'
import { groupSummary } from '../history/text'
import { RuleRef } from '../rules/RuleRef'
import { toast } from '../toast'
import { AbilitiesPanel } from './AbilitiesPanel'
import { ActionList } from './ActionList'
import { SheetContext, undoGroup, useRun, useSheet } from './context'
import { useEditMode } from './editMode'
import { EntityEditHost } from './EntityEditDialog'
import { resetAllOverrides, setName } from '../../engine/edits'
import { EquippedPanel } from './EquippedPanel'
import { RestDialog } from './RestDialog'
import { ConditionsPanel, FeaturesPanel, Reminders, ResourcesPanel } from './SidePanels'
import { useTurn } from './turn'
import { Vitals } from './Vitals'

export function SheetPage({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { character, loading, invalid, error } = useCharacter(uid, id)
  const content = useContent(character?.edition)

  if (loading || (character && !content)) return <p className="p-4 text-muted">{t('loading')}</p>
  if (error) return <Message text={t('sheet.loadFailed', { message: error.message })} />
  if (invalid) return <Message text={t('sheet.invalid')} />
  if (!character || !content) return <Message text={t('sheet.notFound')} />
  return <FirestoreSheet uid={uid} character={character} content={content} />
}

function FirestoreSheet({ uid, character, content }: { uid: string; character: Character; content: ContentIndex }) {
  const store = useFirestoreStore(uid, character)
  useEffect(() => rememberCharacter(character.id, character.name), [character.id, character.name])
  return <SheetView character={character} content={content} store={store} />
}

function Message({ text }: { text: string }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-xl p-4">
      <p className="rounded-card border border-border bg-card p-4">{text}</p>
      <Link className="mt-3 inline-block text-accent underline" to="/">
        {t('sheet.backToList')}
      </Link>
    </div>
  )
}

export function SheetView({ character, content, store }: { character: Character; content: ContentIndex; store: CharacterStore }) {
  const { t } = useTranslation()
  const official = useOfficial()
  // The character's own names, summaries and links apply everywhere on the sheet.
  const view = useMemo(() => content.withCustomizations(character.customizations), [content, character.customizations])
  const result = useMemo(() => {
    try {
      return { sheet: computeSheet(character, view) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [character, view])

  // A new character starts a fresh turn tracker, outside edit mode.
  useEffect(() => {
    useTurn.getState().newTurn()
    useEditMode.setState({ on: false, editing: undefined })
  }, [character.id])

  if (!result.sheet) {
    const hint = official.status === 'noAccess' ? t('content.noAccess') : official.status === 'empty' ? t('content.empty') : ''
    return <Message text={`${t('sheet.computeFailed', { message: result.error })} ${hint}`} />
  }

  return (
    <SheetContext.Provider value={{ character, sheet: result.sheet, content: view, baseContent: content, store }}>
      <SheetLayout />
    </SheetContext.Provider>
  )
}

function TopBar({ onRest, onHistory }: { onRest: (kind: 'short' | 'long') => void; onHistory: () => void }) {
  const { t } = useTranslation()
  const { character, content, store } = useSheet()
  const last = undoable(store.history)
  const classes = character.classes.map((c) => ({ entry: c, cls: content.getTyped(c.classId, 'class'), sub: c.subclassId ? content.getTyped(c.subclassId, 'subclass') : undefined }))
  const button = 'rounded border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-50 disabled:hover:bg-transparent'

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-card px-4 py-1.5 shadow-sm">
      <div className="min-w-0">
        <CharacterName />
        <div className="text-sm text-muted">
          {classes.map(({ entry, cls, sub }, i) => (
            <span key={entry.classId}>
              {i > 0 && ' / '}
              <RuleRef entity={cls} content={content} editable>
                {cls?.name ?? entry.classId} {entry.level}
              </RuleRef>
              {sub && (
                <>
                  {' · '}
                  <RuleRef entity={sub} content={content} editable>
                    {sub.name}
                  </RuleRef>
                </>
              )}
            </span>
          ))}
          {' · '}
          <RuleRef entity={content.get(character.speciesId)} content={content} editable>
            {content.get(character.speciesId)?.name}
          </RuleRef>
          {' · '}
          <RuleRef entity={content.get(character.backgroundId)} content={content} editable>
            {content.get(character.backgroundId)?.name}
          </RuleRef>
        </div>
      </div>
      <span className="rounded-full border border-accent px-2.5 py-0.5 text-xs font-semibold text-accent" title={t('sheet.editionHint')}>
        {character.edition === '2014' ? '5e (2014)' : '5.5e (2024)'}
      </span>
      <div className="ml-auto flex flex-wrap gap-1.5">
        <button className={button} onClick={() => onRest('short')}>
          ☕ {t('sheet.buttons.shortRest')}
        </button>
        <button className={button} onClick={() => onRest('long')}>
          🌙 {t('sheet.buttons.longRest')}
        </button>
        {/* Wired up in later milestones; visible now so the layout is final. */}
        <button disabled className={button} title={t('sheet.comingSoon')}>
          ⬆️ {t('sheet.buttons.levelUp')}
        </button>
        <EditToggle className={button} />
        <button
          className={button}
          disabled={!last}
          title={last ? t('sheet.undoHint', { what: groupSummary(t, last) }) : undefined}
          onClick={() => {
            if (!last) return
            undoGroup(store, last)
            toast(t('sheet.undone', { what: groupSummary(t, last) }))
          }}
        >
          ↶ {t('undo')}
        </button>
        <button className={`${button} hidden sm:inline-block`} onClick={onHistory}>
          📜 {t('sheet.buttons.history')}
        </button>
        <Link to="/" className={button}>
          👥 {t('sheet.buttons.switch')}
        </Link>
      </div>
    </div>
  )
}

function EditToggle({ className }: { className: string }) {
  const { t } = useTranslation()
  const { on, toggle } = useEditMode()
  return (
    <button className={`${className} ${on ? 'border-accent bg-accent text-accent-text hover:bg-accent' : ''}`} onClick={toggle} aria-pressed={on}>
      {on ? `✅ ${t('edit.done')}` : `✏️ ${t('sheet.buttons.editMode')}`}
    </button>
  )
}

function CharacterName() {
  const { character } = useSheet()
  const run = useRun()
  const edit = useEditMode((s) => s.on)
  const [draft, setDraft] = useState<string>()
  if (edit && draft !== undefined) {
    return (
      <input
        autoFocus
        className="rounded border border-accent bg-card px-1 font-heading text-2xl font-semibold"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void run(setName(character, draft))
          setDraft(undefined)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(undefined)
        }}
      />
    )
  }
  return (
    <h1
      className={`truncate font-heading text-2xl font-semibold ${edit ? 'cursor-text rounded border-b border-dashed border-accent' : ''}`}
      onClick={() => edit && setDraft(character.name)}
    >
      {character.name}
    </h1>
  )
}

/** Shown while editing: what edit mode does, and a quick way to drop all overrides. */
function EditBanner() {
  const { t } = useTranslation()
  const { character } = useSheet()
  const run = useRun()
  const { on, toggle } = useEditMode()
  if (!on) return null
  const count = Object.keys(character.overrides).length
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border-2 border-dashed border-accent bg-accent/10 px-4 py-2 text-sm">
      <span className="font-semibold">✏️ {t('edit.banner')}</span>
      {count > 0 && (
        <button
          className="rounded border border-border bg-card px-2 py-0.5 hover:bg-bg"
          onClick={() => {
            if (confirm(t('edit.confirmResetAll', { count }))) void run(resetAllOverrides(character))
          }}
        >
          ↺ {t('edit.resetOverrides', { count })}
        </button>
      )}
      <button className="ml-auto rounded bg-accent px-3 py-0.5 font-semibold text-accent-text" onClick={toggle}>
        ✅ {t('edit.done')}
      </button>
    </div>
  )
}

function SheetLayout() {
  const { t } = useTranslation()
  const { sheet, content } = useSheet()
  const [rest, setRest] = useState<'short' | 'long'>()
  const [history, setHistory] = useState(false)
  const [inventory, setInventory] = useState(false)
  const [spells, setSpells] = useState(false)
  const edit = useEditMode((s) => s.on)

  return (
    // Side gutters on larger screens keep the edge handles off the content.
    <div className="mx-auto w-full max-w-[1920px] px-3 py-3 sm:px-11">
      <TopBar onRest={setRest} onHistory={() => setHistory(true)} />
      {/* Side panels open from handles on the edges: spells on the left, inventory on the right. */}
      {!spells && (sheet.spellcasting.any || edit) && <EdgeHandle side="left" icon="✨" label={t('spells.title')} onClick={() => setSpells(true)} />}
      {!inventory && <EdgeHandle side="right" icon="🎒" label={t('inventory.title')} onClick={() => setInventory(true)} />}
      <EditBanner />
      <EntityEditHost />

      {/* On large screens the columns fill the viewport and scroll inside, so nothing important needs page scrolling. */}
      <div className="grid grid-cols-1 gap-3 xl:h-[calc(100vh-15.5rem)] xl:min-h-[34rem] xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(260px,340px)]">
        <div className="order-3 xl:order-1 xl:min-h-0 xl:overflow-y-auto">
          <AbilitiesPanel sheet={sheet} content={content} />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-2 xl:min-h-0">
          <Vitals />
          <Reminders />
          <ActionList onOpenSpells={() => setSpells(true)} />
        </div>
        <div className="order-2 flex flex-col gap-3 xl:order-3 xl:min-h-0 xl:overflow-y-auto">
          <ResourcesPanel />
          <ConditionsPanel />
          <FeaturesPanel />
        </div>
      </div>
      <div className="mt-3">
        <EquippedPanel onOpen={() => setInventory(true)} />
      </div>
      <p className="mt-3 text-center text-xs text-muted">{t('rules.ctrlHint')}</p>

      {rest && <RestDialog kind={rest} onClose={() => setRest(undefined)} />}
      {history && <HistoryDrawer onClose={() => setHistory(false)} />}
      {inventory && <InventoryDrawer onClose={() => setInventory(false)} />}
      {spells && <SpellcastingDrawer onClose={() => setSpells(false)} />}

      {/* Phone: panels open full screen from a bottom bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card sm:hidden">
        {sheet.spellcasting.any && (
          <button className="flex-1 border-r border-border py-2.5 text-sm font-semibold" onClick={() => setSpells(true)}>
            ✨ {t('spells.title')}
          </button>
        )}
        <button className="flex-1 py-2.5 text-sm font-semibold" onClick={() => setInventory(true)}>
          🎒 {t('inventory.title')}
        </button>
        <button className="flex-1 border-l border-border py-2.5 text-sm font-semibold" onClick={() => setHistory(true)}>
          📜 {t('sheet.buttons.history')}
        </button>
      </nav>
      <div className="h-12 sm:hidden" />
    </div>
  )
}
