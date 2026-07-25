import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "./firebase.js";

function requireDb() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add Firebase keys to .env or Vercel.");
  }
  const db = getFirestoreDb();
  if (!db) throw new Error("Could not connect to Firestore.");
  return db;
}

function newPetId(shelterUid) {
  const slug = shelterUid.slice(0, 8).replace(/[^a-z0-9]/gi, "");
  return `shelter-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function loadPublicPets() {
  if (!isFirebaseConfigured()) return [];
  const db = requireDb();
  try {
    const snap = await getDocs(collection(db, "publicPets"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Failed to load public pets:", e);
    return [];
  }
}

export async function loadShelterPets(shelterUid) {
  const db = requireDb();
  const q = query(collection(db, "publicPets"), where("shelterUid", "==", shelterUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function publishPublicPet(shelterUid, shelterName, petData) {
  const db = requireDb();
  const id = newPetId(shelterUid);
  const record = {
    ...petData,
    id,
    shelterUid,
    shelterName,
    publishedAt: Date.now(),
  };
  await setDoc(doc(db, "publicPets", id), record);
  return record;
}

export async function removePublicPet(shelterUid, petId) {
  const db = requireDb();
  const ref = doc(db, "publicPets", petId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().shelterUid !== shelterUid) {
    throw new Error("Pet not found");
  }
  await deleteDoc(ref);
}
