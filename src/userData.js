import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "./firebase.js";
import { loadAccount, saveAccount, deleteAccount } from "./storage.js";

export async function loadUserData(key) {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, "users", key));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error("Failed to load user data:", e);
      return null;
    }
  }

  const saved = await loadAccount(key);
  if (!saved) return null;
  const { passcode: _passcode, ...data } = saved;
  return data;
}

export async function saveUserData(key, record) {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (!db) return false;
    try {
      await setDoc(
        doc(db, "users", key),
        { ...record, updatedAt: Date.now() },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.error("Failed to save user data:", e);
      return false;
    }
  }

  const existing = (await loadAccount(key)) || {};
  return saveAccount(key, { ...existing, ...record });
}

export async function deleteUserData(key) {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (!db) return;
    try {
      await deleteDoc(doc(db, "users", key));
    } catch (e) {
      console.error("Failed to delete user data:", e);
    }
    return;
  }

  await deleteAccount(key);
}
