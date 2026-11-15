import { useTranslation } from 'react-i18next'
import type { HelpTarget } from '../../rules/preview'
import { usePreview } from '../../rules/preview'
import { RuleRef } from '../../rules/RuleRef'
import { RuleText } from '../../rules/RuleText'
import { describeSnippet } from '../describe'
import { useTemplateSink } from './context'
import { findExamples } from './examples'
import { helpText } from './text'
import { topicMeta } from './topics'

/**
 * What a homebrew field does: explanation, where it shows on the sheet, real examples.
 * Pinned, the examples can be Ctrl+hovered (the original entity) and copied into the draft.
 */
export function HelpBody({ target, pinned = false }: { target: HelpTarget; pinned?: boolean }) {
  const { t, i18n } = useTranslation()
  const apply = useTemplateSink((s) => s.apply)
  const meta = topicMeta(target.help)
  const examples = target.content ? findExamples(target.content, target.help, pinned ? 6 : 3) : []
  const ctx = { t, content: target.content }
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-heading text-lg font-semibold">{target.title}</h3>
        {meta.place && <span className="rounded-full border border-border px-2 text-xs text-muted">📍 {t(`homebrew.place.${meta.place}`)}</span>}
      </div>
      <div className="mt-2">
        <RuleText text={helpText(target.help, i18n.language)} />
      </div>
      {examples.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <h4 className="text-xs font-semibold uppercase text-muted">{t('homebrew.help.examples')}</h4>
          <ul className="mt-1 space-y-1.5 text-sm">
            {examples.map(({ entity, snippet }) => (
              <li key={entity.id} className="leading-snug">
                {pinned && target.content ? (
                  <RuleRef entity={entity} content={target.content} className="font-semibold">
                    {entity.name}
                  </RuleRef>
                ) : (
                  <span className="font-semibold">{entity.name}</span>
                )}{' '}
                <span className="text-xs text-muted">({target.content?.pack(entity.id)?.name ?? entity.source.book})</span>
                <span className="block text-muted">{describeSnippet(snippet, entity, ctx)}</span>
                {pinned && apply && snippet.kind !== 'entity' && (
                  <button
                    type="button"
                    className="mt-0.5 rounded border border-border px-2 py-0.5 text-xs hover:bg-bg"
                    onClick={() => {
                      apply({ kind: snippet.kind, row: structuredClone(snippet.row) })
                      usePreview.setState({ pinned: undefined })
                    }}
                  >
                    📋 {t('homebrew.help.useTemplate')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 border-t border-border pt-2 text-xs text-muted">{pinned ? t('homebrew.help.pinnedHint') : t('homebrew.help.hoverHint')}</p>
    </>
  )
}
