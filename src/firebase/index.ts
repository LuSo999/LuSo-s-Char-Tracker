import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigured } from './config'

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null

// Offline persistence: data stays available and writes are queued when the
// connection at the table drops. Multi-tab manager lets several tabs share the cache.
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase is not configured')
  // Popup instead of redirect: redirect sign-in is unreliable on domains
  // other than the Firebase auth domain (third-party storage blocking).
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function signOut() {
  if (auth) await fbSignOut(auth)
}
