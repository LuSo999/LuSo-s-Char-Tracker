// Firebase web config. It is public by design; access is guarded by
// Firestore Security Rules (see firestore.rules). Paste the values from
// Firebase console → Project settings → Your apps → Web app.
export const firebaseConfig = {
  apiKey: 'AIzaSyDm3HjZLJmrdPk3MmEpZ2k5SCRMgTodM2c',
  authDomain: 'dnd-chartracker.firebaseapp.com',
  projectId: 'dnd-chartracker',
  storageBucket: 'dnd-chartracker.firebasestorage.app',
  messagingSenderId: '877575656346',
  appId: '1:877575656346:web:1bdc67fdc564f19f522023',
}

export const isFirebaseConfigured = firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== ''
