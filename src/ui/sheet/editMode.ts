// Edit mode: only while it is on can values and names be overwritten.
// Outside it the sheet is for play (spending resources, changing HP).
import { create } from 'zustand'
import type { Entity } from '../../content/schema'

type EditState = {
  on: boolean
  /** Entity whose name / summary / link is being edited. */
  editing?: Entity
  toggle(): void
}

export const useEditMode = create<EditState>((set) => ({ on: false, toggle: () => set((s) => ({ on: !s.on, editing: undefined })) }))
