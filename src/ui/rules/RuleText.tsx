import type { ContentIndex } from '../../content'
import { TermText } from './TermText'

/**
 * Renders rules text: paragraphs, **bold**, `code` and simple markdown tables. With
 * `content`, conditions and rules terms in it can be Ctrl+hovered (all but `skip`).
 */
export function RuleText({ text, content, skip }: { text: string; content?: ContentIndex; skip?: string }) {
  const blocks = text.split(/\n{2,}|\n(?=\*\*)|\n(?=\|)/)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.trim().startsWith('|') ? (
          <pre key={i} className="overflow-x-auto text-xs">
            {b.trim()}
          </pre>
        ) : (
          <p key={i}>
            {b.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, j) =>
              part.startsWith('**') ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : part.length > 1 && part.startsWith('`') && part.endsWith('`') ? (
                <code key={j} className="rounded bg-bg px-1 text-[0.85em]">
                  {part.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{content ? <TermText text={part} content={content} skip={skip} /> : part}</span>
              ),
            )}
          </p>
        ),
      )}
    </div>
  )
}
