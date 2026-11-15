import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
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

/**
 * Google sign-in for the desktop app, run in the system browser (Google doesn't allow its
 * sign-in inside apps): returns the Google tokens the app signs in with.
 */
export async function googleTokensForDesktop(): Promise<{ idToken: string; accessToken?: string }> {
  if (!auth) throw new Error('Firebase is not configured')
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  const cred = GoogleAuthProvider.credentialFromResult(result)
  if (!cred?.idToken) throw new Error('Google returned no sign-in token')
  return { idToken: cred.idToken, accessToken: cred.accessToken }
}

/** In the desktop app: sign in with the Google tokens from the system browser. */
export async function signInWithGoogleTokens(idToken: string, accessToken?: string) {
  if (!auth) throw new Error('Firebase is not configured')
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
}

export async function signOut() {
  if (auth) await fbSignOut(auth)
}
