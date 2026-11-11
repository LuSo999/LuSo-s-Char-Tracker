import { create } from 'zustand'

export type Toast = { id: number; text: string; tone: 'info' | 'error'; action?: { label: string; run: () => void }; key?: string }

type ToastState = { toasts: Toast[] }
export const useToasts = create<ToastState>(() => ({ toasts: [] }))

let next = 1
const DURATION = 6000

/** A toast with a `key` replaces the previous one with the same key (e.g. only one "Undo" offer at a time). */
export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action']; key?: string } = {}) {
  const id = next++
  useToasts.setState((s) => ({
    toasts: [...s.toasts.filter((t) => !opts.key || t.key !== opts.key).slice(-2), { id, text, tone: opts.tone ?? 'info', action: opts.action, key: opts.key }],
  }))
  window.setTimeout(() => dismiss(id), DURATION)
}

export function dismiss(id: number) {
  useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}
