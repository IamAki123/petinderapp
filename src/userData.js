import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "./firebase.js";

function withTimeout(promise, ms, label = "Request") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function ensureAuthToken() {
  const auth = getFirebaseAuth();
  const current = auth?.currentUser;
  if (!current) return;
  try {
    await current.getIdToken();
  } catch {
    // Ignore token refresh errors; Firestore may still accept the session.
  }
}

function slimPet(pet) {
  if (!pet?.id) return null;
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    temperament: pet.temperament,
    energyLevel: pet.energyLevel,
    size: pet.size,
    bio: pet.bio,
    location: pet.location,
    shelterName: pet.shelterName,
    shelterUid: pet.shelterUid,
    photoUrl: pet.photoUrl,
  };
}

export function slimUserRecord(record) {
  return {
    email: record.email || "",
    uid: record.uid,
    accountType: record.accountType,
    shelterName: record.shelterName || "",
    profileSetupComplete: Boolean(record.profileSetupComplete),
    profile: record.profile || null,
    weights: record.weights || {},
    history: Array.isArray(record.history) ? record.history.slice(-80) : [],
    matches: Array.isArray(record.matches)
      ? record.matches.map(slimPet).filter(Boolean)
      : [],
    appointments: Array.isArray(record.appointments)
      ? record.appointments.map((entry) => ({
        date: entry.date,
        time: entry.time,
        pet: slimPet(entry.pet),
        shelterLat: entry.shelterLat ?? null,
        shelterLng: entry.shelterLng ?? null,
      })).filter((entry) => entry.pet)
      : [],
    chatSessions: Array.isArray(record.chatSessions)
      ? record.chatSessions.slice(0, 5).map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        messages: Array.isArray(session.messages) ? session.messages.slice(-25) : [],
      }))
      : [],
    activeChatId: record.activeChatId ?? null,
    updatedAt: Date.now(),
  };
}

export async function loadUserData(uid) {
  if (!isFirebaseConfigured()) return null;
  const db = getFirestoreDb();
  if (!db) return null;

  await ensureAuthToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const snap = await withTimeout(
        getDoc(doc(db, "users", uid)),
        12000,
        "Firestore profile load"
      );
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error(`Failed to load user data (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function saveUserData(uid, record) {
  if (!isFirebaseConfigured()) return false;
  const db = getFirestoreDb();
  if (!db) return false;

  await ensureAuthToken();
  const payload = slimUserRecord({ ...record, uid });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await withTimeout(
        setDoc(doc(db, "users", uid), payload, { merge: true }),
        15000,
        "Firestore profile save"
      );
      return true;
    } catch (e) {
      console.error(`Failed to save user data (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return false;
    }
  }
  return false;
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
