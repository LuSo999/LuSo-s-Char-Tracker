// Firebase web config. It is public by design; access is guarded by
// Firestore Security Rules (see firestore.rules). Paste the values from
// Firebase console → Project settings → Your apps → Web app.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

export const isFirebaseConfigured = firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== ''
