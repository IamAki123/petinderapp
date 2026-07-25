import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "./firebase.js";

export async function loadUserData(uid) {
  if (!isFirebaseConfigured()) return null;
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Failed to load user data:", e);
    return null;
  }
}

export async function saveUserData(uid, record) {
  if (!isFirebaseConfigured()) return false;
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    await setDoc(
      doc(db, "users", uid),
      { ...record, updatedAt: Date.now() },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error("Failed to save user data:", e);
    return false;
  }
}

export async function deleteUserData(uid) {
  if (!isFirebaseConfigured()) return;
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (e) {
    console.error("Failed to delete user data:", e);
  }
}
