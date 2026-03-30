import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

function getFirebaseConfig() {
  const env = import.meta.env as Record<string, string | undefined>;

  const apiKey = env.VITE_FIREBASE_API_KEY || '';
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || '';
  const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || '';
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
  const appId = env.VITE_FIREBASE_APP_ID || '';

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

export function getFirestoreDb(): Firestore | null {
  if (cachedDb) return cachedDb;

  const config = getFirebaseConfig();
  if (!config) return null;

  if (!cachedApp) {
    cachedApp = initializeApp(config);
  }

  cachedDb = getFirestore(cachedApp);
  return cachedDb;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}
