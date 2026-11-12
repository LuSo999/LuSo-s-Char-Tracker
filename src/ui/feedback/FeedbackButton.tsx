import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { feedbackKinds, sendFeedback, type FeedbackKind } from '../../state/feedback'
import { useAuth } from '../../state/auth'
import { toast } from '../toast'
import { kindIcon } from './kinds'

/** 💬 in the header: anyone signed in can report a bug or ask for a feature. */
export function FeedbackButton() {
  const { t } = useTranslation()
  const user = useAuth((s) => s.user)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  if (!user) return null

  async function send() {
    if (!text.trim() || !user) return
    setSending(true)
    try {
      await sendFeedback({ uid: user.uid, name: user.displayName ?? '', email: user.email ?? '', kind, text, page: location.hash || '#/' })
      toast(t('feedback.thanks'))
      setText('')
      setOpen(false)
    } catch (e) {
      toast(t('feedback.failed', { error: (e as Error).message }), { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button className="rounded border border-border px-2 py-1 text-sm hover:bg-bg" title={t('feedback.button')} aria-label={t('feedback.button')} onClick={() => setOpen(true)}>
        💬
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label={t('feedback.title')} className="w-full max-w-lg rounded-card border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-xl font-semibold">💬 {t('feedback.title')}</h2>
            <p className="mt-1 text-sm text-muted">{t('feedback.hint')}</p>
            <div className="mt-3 flex gap-1.5" role="radiogroup">
              {feedbackKinds.map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={kind === k}
                  className={`rounded-full border px-3 py-1 text-sm ${kind === k ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                  onClick={() => setKind(k)}
                >
                  {kindIcon[k]} {t(`feedback.kinds.${k}`)}
                </button>
              ))}
            </div>
            <textarea
              autoFocus
              className="mt-3 h-40 w-full rounded border border-border bg-bg p-2 text-sm"
              maxLength={5000}
              placeholder={t(`feedback.placeholder.${kind}`)}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
              }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <span className="mr-auto text-xs text-muted">Ctrl + Enter</span>
              <button className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg" onClick={() => setOpen(false)}>
                {t('cancel')}
              </button>
              <button className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-text disabled:opacity-50" disabled={!text.trim() || sending} onClick={() => void send()}>
                {t('feedback.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
