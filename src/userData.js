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
    await current.getIdToken(true);
  } catch {
    try {
      await current.getIdToken();
    } catch {
      // Firestore may still accept the existing session.
    }
  }
}

export function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeForFirestore(entry))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      const cleaned = sanitizeForFirestore(entry);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

function slimPet(pet) {
  if (!pet?.id) return null;
  return sanitizeForFirestore({
    id: pet.id,
    name: pet.name || "",
    species: pet.species || "",
    breed: pet.breed || "",
    age: pet.age || "",
    temperament: pet.temperament || "",
    energyLevel: pet.energyLevel || "",
    size: pet.size || "",
    bio: pet.bio || "",
    location: pet.location || "",
    shelterName: pet.shelterName || "",
    shelterUid: pet.shelterUid || "",
    photoUrl: pet.photoUrl || "",
  });
}

export function slimUserRecord(record) {
  return sanitizeForFirestore({
    email: record.email || "",
    uid: record.uid,
    accountType: record.accountType || "adopter",
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
        title: session.title || "New chat",
        updatedAt: session.updatedAt || Date.now(),
        messages: Array.isArray(session.messages) ? session.messages.slice(-25) : [],
      }))
      : [],
    activeChatId: record.activeChatId ?? null,
    updatedAt: Date.now(),
  });
}

export function saveErrorMessage(result) {
  const code = result?.code || "";
  const message = result?.message || "";
  if (code === "permission-denied" || message.toLowerCase().includes("permission")) {
    return "Cloud save blocked. In Firebase console go to Firestore → Rules → Publish the rules below.";
  }
  if (message.toLowerCase().includes("timed out")) {
    return "Cloud save timed out. Check your connection and try again.";
  }
  return "Could not sync to the cloud. Check Firebase setup and try again.";
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
  if (!isFirebaseConfigured()) {
    return { ok: false, code: "not-configured", message: "Firebase is not configured" };
  }
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, code: "no-db", message: "Could not connect to Firestore" };
  }

  await ensureAuthToken();
  const payload = slimUserRecord({ ...record, uid });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await withTimeout(
        setDoc(doc(db, "users", uid), payload, { merge: true }),
        15000,
        "Firestore profile save"
      );
      return { ok: true };
    } catch (e) {
      console.error(`Failed to save user data (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return {
        ok: false,
        code: e.code || "save-failed",
        message: e.message || "Save failed",
      };
    }
  }
  return { ok: false, code: "save-failed", message: "Save failed" };
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
