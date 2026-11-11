import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Character, type CharacterInput } from '../engine/character'
import { db } from '../firebase'

export type CharacterSummary = {
  id: string
  name: string
  /** Undefined when the stored document isn't a valid character (e.g. milestone 1 test entries). */
  character?: Character
}

function charactersCol(uid: string) {
  if (!db) throw new Error('Firebase is not configured')
  return collection(db, 'users', uid, 'characters')
}

/** Firestore keeps only the stored fields; `id` comes from the document. */
function parse(id: string, data: Record<string, unknown>): Character | undefined {
  const r = Character.safeParse({ ...data, id })
  return r.success ? r.data : undefined
}

export function useCharacterList(uid: string) {
  const [characters, setCharacters] = useState<CharacterSummary[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(charactersCol(uid), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snap) =>
        setCharacters(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? ''), character: parse(d.id, d.data()) }))),
      setError,
    )
  }, [uid])

  return { characters, error }
}

export function useCharacter(uid: string, id: string) {
  const [state, setState] = useState<{ character?: Character; loading: boolean; invalid?: boolean; error?: Error }>({ loading: true })
  useEffect(() => {
    return onSnapshot(
      doc(charactersCol(uid), id),
      (snap) => {
        if (!snap.exists()) return setState({ loading: false })
        const character = parse(snap.id, snap.data())
        setState({ character, loading: false, invalid: !character })
      },
      (error) => setState({ loading: false, error }),
    )
  }, [uid, id])
  return state
}

/** Characters as imported from / exported to a JSON file (no id). */
export const CharacterFile = Character.omit({ id: true })

export async function addCharacter(uid: string, input: Omit<CharacterInput, 'id'>) {
  const parsed = CharacterFile.parse(input)
  // Firestore rejects undefined values; drop them via JSON round-trip.
  const data = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>
  const ref = await addDoc(charactersCol(uid), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export function parseCharacterFile(text: string): { ok: true; value: z.infer<typeof CharacterFile> } | { ok: false; errors: string[] } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  const r = CharacterFile.safeParse(json)
  if (r.success) return { ok: true, value: r.data }
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) }
}

export async function deleteCharacter(uid: string, id: string) {
  await deleteDoc(doc(charactersCol(uid), id))
}
