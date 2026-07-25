import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let auth = null;
let db = null;

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

function initFirebase() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch (e) {
    if (e.code === "auth/already-initialized") {
      auth = getAuth(app);
    } else {
      throw e;
    }
  }
  db = getFirestore(app);
}

export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) return null;
  initFirebase();
  return auth;
}

export function getFirestoreDb() {
  if (!isFirebaseConfigured()) return null;
  initFirebase();
  return db;
}
