import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'

// Placeholder shape for milestone 1; the full character model comes in milestone 2.
export type CharacterSummary = {
  id: string
  name: string
}

function charactersCol(uid: string) {
  if (!db) throw new Error('Firebase is not configured')
  return collection(db, 'users', uid, 'characters')
}

export function useCharacterList(uid: string) {
  const [characters, setCharacters] = useState<CharacterSummary[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(charactersCol(uid), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => setCharacters(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? '') }))),
      setError,
    )
  }, [uid])

  return { characters, error }
}

export async function createCharacter(uid: string, name: string) {
  await addDoc(charactersCol(uid), { name, createdAt: serverTimestamp() })
}

export async function deleteCharacter(uid: string, id: string) {
  await deleteDoc(doc(charactersCol(uid), id))
}
