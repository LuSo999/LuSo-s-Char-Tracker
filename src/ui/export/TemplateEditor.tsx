import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { analyzeFields } from '../../engine/export/analyze'
import type { SheetTemplate, TemplateField } from '../../engine/export/template'
import { exportCatalogue } from '../../engine/export/values'
import { readSheet, renderPage, type SheetPdf } from './pdf'

type Box = { x: number; y: number; w: number; h: number }
/** One thing on the page: a form field of the PDF (assigned or not) or a drawn text / mark. */
type Item = { id: string; page: number; box: Box; kind: 'form' | 'text' | 'mark'; name?: string; type?: 'text' | 'check'; key?: string; index?: number }

const catalogue = exportCatalogue()
const byKey = new Map(catalogue.map((f) => [f.key, f]))

/**
 * Where each value goes: the PDF's pages with its form fields and the template's drawn boxes.
 * Click a box to choose its value; on printed sheets drag to add a text box or click to add a
 * dot (proficiency circles). Values of the current character are shown as a preview.
 */
export function TemplateEditor({
  template,
  pdf,
  values,
  onCancel,
  onSave,
}: {
  template: SheetTemplate
  pdf: Uint8Array
  values: Record<string, string | boolean>
  onCancel: () => void
  onSave: (t: SheetTemplate) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const [sheet, setSheet] = useState<SheetPdf>()
  const [fields, setFields] = useState<TemplateField[]>(template.fields)
  const [name, setName] = useState(template.builtIn ? `${template.name} (${t('export.copy')})` : template.name)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [mode, setMode] = useState<'select' | 'text' | 'mark'>('select')
  const [query, setQuery] = useState('')
  const [scale, setScale] = useState(1.3)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number }>()

  useEffect(() => {
    void readSheet(pdf).then(setSheet)
  }, [pdf])
  useEffect(() => {
    if (sheet && canvas.current) return renderPage(sheet.doc, page, canvas.current, scale)
  }, [sheet, page, scale])

  const [pw, ph] = sheet?.pages[page] ?? template.pages[page] ?? [600, 800]
  const formKey = useMemo(() => new Map(fields.flatMap((f) => (f.kind === 'form' ? [[f.name, f.key] as const] : []))), [fields])
  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    for (const w of sheet?.widgets ?? []) out.push({ id: `form:${w.name}`, page: w.page, box: w, kind: 'form', name: w.name, type: w.type, key: formKey.get(w.name) })
    fields.forEach((f, index) => {
      if (f.kind === 'text') out.push({ id: `text:${index}`, page: f.page, box: f, kind: 'text', key: f.key, index })
      if (f.kind === 'mark') out.push({ id: `mark:${index}`, page: f.page, box: { x: f.x - 4, y: f.y - 4, w: 8, h: 8 }, kind: 'mark', key: f.key, index })
    })
    return out
  }, [sheet, fields, formKey])
  const sel = items.find((i) => i.id === selected)

  const toCss = (b: Box) => ({ left: b.x * scale, top: (ph - b.y - b.h) * scale, width: b.w * scale, height: b.h * scale })
  const toPdf = (cx: number, cy: number) => ({ x: cx / scale, y: ph - cy / scale })

  function assign(key: string | undefined) {
    if (!sel) return
    if (sel.kind === 'form') {
      const rest = fields.filter((f) => !(f.kind === 'form' && f.name === sel.name))
      setFields(key ? [...rest, { kind: 'form', name: sel.name!, key }] : rest)
    } else setFields(fields.map((f, i) => (i === sel.index ? { ...f, key: key ?? f.key } : f)))
  }
  function removeSelected() {
    if (!sel) return
    if (sel.kind === 'form') assign(undefined)
    else setFields(fields.filter((_, i) => i !== sel.index))
    setSelected(undefined)
  }
  function reanalyze() {
    if (!sheet) return
    const known = new Set(fields.flatMap((f) => (f.kind === 'form' ? [f.name] : [])))
    const fresh = analyzeFields(sheet.widgets, sheet.words).filter((p) => p.key && !known.has(p.field.name)).map((p): TemplateField => ({ kind: 'form', name: p.field.name, key: p.key! }))
    setFields([...fields, ...fresh])
  }

  const pointer = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function onDown(e: React.PointerEvent) {
    if (mode === 'select') return
    const p = pointer(e)
    if (mode === 'mark') {
      const at = toPdf(p.x, p.y)
      const next = [...fields, { kind: 'mark' as const, page, x: at.x, y: at.y, key: 'skill.athletics.prof' }]
      setFields(next)
      setSelected(`mark:${next.length - 1}`)
      setMode('select')
      return
    }
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return
    const p = pointer(e)
    setDrag({ ...drag, x1: p.x, y1: p.y })
  }
  function onUp() {
    if (!drag) return
    const a = toPdf(Math.min(drag.x0, drag.x1), Math.max(drag.y0, drag.y1))
    const b = toPdf(Math.max(drag.x0, drag.x1), Math.min(drag.y0, drag.y1))
    setDrag(undefined)
    setMode('select')
    if (b.x - a.x < 4 || b.y - a.y < 4) return
    const next = [...fields, { kind: 'text' as const, page, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, key: 'name' }]
    setFields(next)
    setSelected(`text:${next.length - 1}`)
  }

  const options = catalogue.filter((f) => {
    if (sel?.kind === 'mark' || sel?.type === 'check') return f.kind === 'check'
    return f.kind !== 'check'
  })
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((f) => f.label.toLowerCase().includes(q) || f.key.includes(q)) : options
  const preview = (key: string | undefined) => (key === undefined ? '' : values[key] === true ? '●' : values[key] === false ? '' : String(values[key] ?? ''))
  const assigned = items.filter((i) => i.key).length

  const tool = (m: typeof mode, label: string) => (
    <button className={`rounded border px-2 py-1 text-xs ${mode === m ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`} onClick={() => setMode(m)}>
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <input className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1 font-semibold" value={name} onChange={(e) => setName(e.target.value)} aria-label={t('export.templateName')} />
        <span className="text-xs text-muted">{t('export.assigned', { count: assigned })}</span>
        <button className="rounded border border-border px-3 py-1 text-sm hover:bg-bg" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          className="rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-text"
          onClick={() => void onSave({ ...template, id: template.builtIn ? `tpl-${Date.now().toString(36)}` : template.id, name: name.trim() || template.name, builtIn: undefined, pages: sheet?.pages ?? template.pages, fields })}
        >
          💾 {t('save')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-sm">
        <span className="flex items-center gap-1">
          <button className="rounded border border-border px-2 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹
          </button>
          {t('export.page', { n: page + 1, of: sheet?.pages.length ?? template.pages.length })}
          <button className="rounded border border-border px-2 disabled:opacity-40" disabled={page >= (sheet?.pages.length ?? template.pages.length) - 1} onClick={() => setPage(page + 1)}>
            ›
          </button>
        </span>
        <span className="flex items-center gap-1">
          {tool('select', `👆 ${t('export.toolSelect')}`)}
          {tool('text', `▭ ${t('export.toolText')}`)}
          {tool('mark', `● ${t('export.toolMark')}`)}
        </span>
        {!!sheet?.widgets.length && (
          <button className="rounded border border-border px-2 py-1 text-xs hover:bg-bg" onClick={reanalyze}>
            🔍 {t('export.reanalyze')}
          </button>
        )}
        <label className="ml-auto flex items-center gap-1 text-xs text-muted">
          🔎
          <input type="range" min={0.6} max={2.2} step={0.1} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div
            className={`relative mx-auto ${mode === 'select' ? '' : 'cursor-crosshair'}`}
            style={{ width: pw * scale, height: ph * scale }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <canvas ref={canvas} className="absolute inset-0 shadow" />
            {items
              .filter((i) => i.page === page)
              .map((i) => (
                <button
                  key={i.id}
                  title={i.key ? (byKey.get(i.key)?.label ?? i.key) : t('export.unassigned')}
                  className={`absolute overflow-hidden border text-left text-[9px] leading-none ${i.kind === 'mark' ? 'rounded-full' : 'rounded-sm'} ${
                    i.id === selected ? 'border-2 border-accent bg-accent/30' : i.key ? 'border-emerald-600 bg-emerald-500/20' : 'border-dashed border-slate-500 bg-slate-400/10'
                  } ${mode === 'select' ? '' : 'pointer-events-none'}`}
                  style={toCss(i.box)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(i.id)
                    setQuery('')
                  }}
                >
                  <span className="px-0.5 text-slate-900">{i.kind !== 'mark' ? preview(i.key) : ''}</span>
                </button>
              ))}
            {drag && (
              <div
                className="absolute border-2 border-accent bg-accent/20"
                style={{ left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) }}
              />
            )}
          </div>
          {!sheet && <p className="text-center text-sm text-muted">⏳ {t('loading')}</p>}
        </div>
        <aside className="max-h-[45vh] w-full overflow-y-auto border-t border-border bg-card p-3 text-sm lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          {sel ? (
            <>
              <p className="text-xs text-muted">
                {sel.kind === 'form' ? t('export.formField', { name: sel.name }) : sel.kind === 'mark' ? t('export.markField') : t('export.textField')}
              </p>
              <p className="mt-1 font-semibold">{sel.key ? (byKey.get(sel.key)?.label ?? sel.key) : t('export.unassigned')}</p>
              {sel.key && <p className="text-xs text-muted">{t('export.previewValue')}: {preview(sel.key) || '—'}</p>}
              <input className="mt-2 w-full rounded border border-border bg-card px-2 py-1" placeholder={t('export.searchValue')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
              <ul className="mt-1 max-h-72 overflow-y-auto">
                {shown.map((f) => (
                  <li key={f.key}>
                    <button className={`w-full rounded px-1.5 py-0.5 text-left hover:bg-bg ${f.key === sel.key ? 'bg-accent/15 font-semibold' : ''}`} onClick={() => assign(f.key)}>
                      {f.label} <span className="text-xs text-muted">{preview(f.key)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {sel.kind === 'text' && sel.index !== undefined && (() => {
                const f = fields[sel.index] as Extract<TemplateField, { kind: 'text' }>
                const set = (patch: Partial<typeof f>) => setFields(fields.map((x, i) => (i === sel.index ? { ...f, ...patch } : x)))
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      {t('export.fontSize')}
                      <input type="number" min={5} max={24} className="w-14 rounded border border-border bg-card px-1" value={f.size ?? ''} placeholder="auto" onChange={(e) => set({ size: e.target.value ? Number(e.target.value) : undefined })} />
                    </label>
                    <select className="rounded border border-border bg-card px-1" value={f.align ?? 'left'} onChange={(e) => set({ align: e.target.value as 'left' | 'center' | 'right' })}>
                      <option value="left">⇤</option>
                      <option value="center">↔</option>
                      <option value="right">⇥</option>
                    </select>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!f.multiline} onChange={(e) => set({ multiline: e.target.checked })} />
                      {t('export.multiline')}
                    </label>
                  </div>
                )
              })()}
              <button className="mt-3 text-xs text-danger hover:underline" onClick={removeSelected}>
                🗑 {sel.kind === 'form' ? t('export.unassign') : t('export.remove')}
              </button>
            </>
          ) : (
            <div className="space-y-2 text-xs text-muted">
              <p>{t('export.editorHint')}</p>
              <p>
                <span className="inline-block h-3 w-3 border border-emerald-600 bg-emerald-500/20 align-middle" /> {t('export.legendAssigned')}{' '}
                <span className="ml-2 inline-block h-3 w-3 border border-dashed border-slate-500 align-middle" /> {t('export.legendFree')}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
