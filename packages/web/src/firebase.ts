import { FirebaseError, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-kanban'

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulator ? 'demo-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
})

export const auth = getAuth(app)

// Offline persistence (graceful degradation): reads are served from a local cache and a write
// made while offline is queued, its promise staying pending until the server accepts it. The
// multi-tab manager lets the installed PWA and a browser tab share one cache.
function openFirestore() {
  try {
    const firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    if (useEmulator) connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    return firestore
  } catch (err) {
    // A hot update of this module in Vite dev evaluates it again on the same app, and a second
    // initializeFirestore throws failed-precondition: reuse the instance that is already running
    // (it was connected to the emulator when it was created).
    // Nothing else is swallowed, and the first (production) call never takes this path.
    if (err instanceof FirebaseError && err.code === 'failed-precondition') return getFirestore(app)
    throw err
  }
}
export const db = openFirestore()

if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
