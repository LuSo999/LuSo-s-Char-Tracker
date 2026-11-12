import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteFeedback, getNotifyUrl, setFeedbackStatus, setNotifyUrl, useFeedbackList, type FeedbackKind, type FeedbackStatus } from '../../state/feedback'
import { BackToSheet } from '../BackToSheet'
import { Card } from '../Card'
import { toast } from '../toast'
import { kindIcon } from './kinds'

const statuses: (FeedbackStatus | 'all')[] = ['new', 'read', 'done', 'all']

/** Admins: read, sort out and delete feedback; set up the e-mail notification. */
export function FeedbackPage() {
  const { t, i18n } = useTranslation()
  const { items, ready, error } = useFeedbackList()
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('new')
  const [kind, setKind] = useState<FeedbackKind | 'all'>('all')
  const shown = items.filter((f) => (status === 'all' || f.status === status) && (kind === 'all' || f.kind === kind))
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <BackToSheet />
      <h1 className="font-heading text-2xl font-semibold">💡 {t('feedback.admin.title')}</h1>
      <div className="flex flex-wrap gap-1">
        {statuses.map((s) => (
          <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {t(`feedback.status.${s}`)} <span className="opacity-60">{s === 'all' ? items.length : items.filter((f) => f.status === s).length}</span>
          </button>
        ))}
        <span className="mx-1 border-l border-border" />
        {(['all', 'bug', 'idea', 'other'] as const).map((k) => (
          <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>
            {k === 'all' ? t('feedback.status.all') : `${kindIcon[k]} ${t(`feedback.kinds.${k}`)}`}
          </button>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
      {ready && shown.length === 0 && <p className="text-muted">{t('feedback.admin.empty')}</p>}
      <ul className="space-y-2">
        {shown.map((f) => (
          <li key={f.id}>
            <Card>
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-lg">{kindIcon[f.kind] ?? '💬'}</span>
                <strong>{f.name || f.email}</strong>
                <a className="text-muted underline" href={`mailto:${f.email}`}>
                  {f.email}
                </a>
                <span className="text-xs text-muted">{f.createdAt?.toDate().toLocaleString(i18n.language)}</span>
                <span className="text-xs text-muted">{f.page}</span>
                {f.status === 'new' && <span className="rounded bg-danger px-1.5 text-[10px] font-semibold uppercase text-white">{t('feedback.status.new')}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap">{f.text}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {f.status !== 'read' && (
                  <button className="rounded border border-border px-2 py-0.5 hover:bg-bg" onClick={() => void setFeedbackStatus(f.id, 'read')}>
                    👁 {t('feedback.admin.markRead')}
                  </button>
                )}
                {f.status !== 'done' && (
                  <button className="rounded border border-border px-2 py-0.5 hover:bg-bg" onClick={() => void setFeedbackStatus(f.id, 'done')}>
                    ✅ {t('feedback.admin.markDone')}
                  </button>
                )}
                {f.status !== 'new' && (
                  <button className="rounded border border-border px-2 py-0.5 hover:bg-bg" onClick={() => void setFeedbackStatus(f.id, 'new')}>
                    ↺ {t('feedback.admin.markNew')}
                  </button>
                )}
                <button
                  className="ml-auto rounded border border-danger px-2 py-0.5 text-danger hover:bg-danger hover:text-white"
                  onClick={() => confirm(t('feedback.admin.confirmDelete')) && void deleteFeedback(f.id)}
                >
                  🗑 {t('feedback.admin.delete')}
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <NotifySettings />
    </div>
  )
}

function NotifySettings() {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  useEffect(() => {
    void getNotifyUrl().then(setUrl)
  }, [])
  return (
    <Card>
      <h2 className="font-heading text-lg font-semibold">✉️ {t('feedback.admin.email')}</h2>
      <p className="mt-1 text-sm text-muted">{t('feedback.admin.emailHint')}</p>
      <div className="mt-2 flex gap-2">
        <input className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-sm" placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="rounded bg-accent px-3 py-1 text-sm font-semibold text-accent-text"
          onClick={() =>
            void setNotifyUrl(url).then(
              () => toast(t('feedback.admin.saved')),
              (e: Error) => toast(e.message, { tone: 'error' }),
            )
          }
        >
          {t('feedback.admin.saveUrl')}
        </button>
      </div>
      <a className="mt-2 inline-block text-sm text-accent underline" href="https://github.com/LuSo999/LuSo-s-Char-Tracker/blob/main/docs/feedback-email.md" target="_blank" rel="noopener">
        {t('feedback.admin.howTo')}
      </a>
    </Card>
  )
}
