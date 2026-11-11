import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLastCharacter } from '../state/lastCharacter'

/** "← Back to <character>" (or to the character list) for pages outside the sheet. */
export function BackToSheet() {
  const { t } = useTranslation()
  const last = useLastCharacter((s) => s.last)
  return (
    <Link
      to={last ? `/c/${last.id}` : '/'}
      className="inline-flex items-center gap-1 rounded border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-bg"
    >
      ← {last ? t('backTo', { name: last.name }) : t('sheet.backToList')}
    </Link>
  )
}
