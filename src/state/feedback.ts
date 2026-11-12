// Feedback from users: anyone signed in can send it, only admins read it.
// After saving, the app pings the admin's Google Apps Script web app (URL in
// Firestore config/notify, set on the Admin page) which e-mails the admin.
// See docs/feedback-email.md.
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore'
import { create } from 'zustand'
import { db } from '../firebase'

export const feedbackKinds = ['bug', 'idea', 'other'] as const
export type FeedbackKind = (typeof feedbackKinds)[number]
export type FeedbackStatus = 'new' | 'read' | 'done'

export type Feedback = {
  id: string
  uid: string
  name: string
  email: string
  kind: FeedbackKind
  text: string
  page: string
  status: FeedbackStatus
  createdAt?: Timestamp
}

const col = () => collection(db!, 'feedback')
const notifyDoc = () => doc(db!, 'config', 'notify')

export async function sendFeedback(input: { uid: string; name: string; email: string; kind: FeedbackKind; text: string; page: string }) {
  if (!db) throw new Error('Firebase is not configured')
  const text = input.text.trim().slice(0, 5000)
  await addDoc(col(), { ...input, text, status: 'new', createdAt: serverTimestamp() })
  // E-mail to the admin; failure here never blocks the feedback itself.
  try {
    const url = (await getDoc(notifyDoc())).data()?.feedbackWebhook as string | undefined
    if (url) {
      // text/plain keeps it a "simple" request, so no CORS preflight to Apps Script.
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...input, text, appUrl: `${location.origin}${location.pathname}` }),
      })
    }
  } catch {
    /* ignore */
  }
}

export async function getNotifyUrl(): Promise<string> {
  return ((await getDoc(notifyDoc())).data()?.feedbackWebhook as string | undefined) ?? ''
}

export async function setNotifyUrl(url: string) {
  await setDoc(notifyDoc(), { feedbackWebhook: url.trim() }, { merge: true })
}

export const setFeedbackStatus = (id: string, status: FeedbackStatus) => updateDoc(doc(db!, 'feedback', id), { status })
export const deleteFeedback = (id: string) => deleteDoc(doc(db!, 'feedback', id))

/** Admins: live list of all feedback, newest first. */
export const useFeedbackList = create<{ items: Feedback[]; ready: boolean; error?: string }>(() => ({ items: [], ready: false }))

let unsubscribe: (() => void) | undefined
export function watchFeedback() {
  if (!db || unsubscribe) return
  unsubscribe = onSnapshot(
    query(col(), orderBy('createdAt', 'desc')),
    (snap) => useFeedbackList.setState({ items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Feedback, 'id'>) })), ready: true, error: undefined }),
    (e) => useFeedbackList.setState({ ready: true, error: e.message }),
  )
}
export function stopWatchingFeedback() {
  unsubscribe?.()
  unsubscribe = undefined
}
