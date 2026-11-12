import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ADMIN_UIDS } from '../../config'
import { stopWatchingFeedback, useFeedbackList, watchFeedback } from '../../state/feedback'
import { useAuth } from '../../state/auth'

/** Admins only: 💡 with the number of unread feedback, opens the feedback list. */
export function AdminBulb() {
  const { t } = useTranslation()
  const uid = useAuth((s) => s.user?.uid)
  const admin = !!uid && ADMIN_UIDS.includes(uid)
  const unread = useFeedbackList((s) => s.items.filter((f) => f.status === 'new').length)
  useEffect(() => {
    if (!admin) return
    watchFeedback()
    return stopWatchingFeedback
  }, [admin])
  if (!admin) return null
  return (
    <Link to="/feedback" className="relative rounded border border-border px-2 py-1 text-sm hover:bg-bg" title={t('feedback.admin.title')} aria-label={`${t('feedback.admin.title')}: ${unread}`}>
      💡
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[1.1rem] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{unread}</span>
      )}
    </Link>
  )
}
