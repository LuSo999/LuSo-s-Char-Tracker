import { useTranslation } from 'react-i18next'
import { DESKTOP_URL, isDesktop } from './bridge'

/** The desktop app link with what it adds (shown everywhere the web can't do it alone). */
export function DesktopHint({ text }: { text: string }) {
  const { t } = useTranslation()
  if (isDesktop()) return null
  return (
    <p className="text-xs text-muted">
      🖥️ {text}{' '}
      <a className="font-semibold text-accent underline" href={DESKTOP_URL} target="_blank" rel="noreferrer">
        {t('desk.getApp')}
      </a>
    </p>
  )
}
