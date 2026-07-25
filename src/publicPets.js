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

const LOCAL_PUBLIC_PETS_KEY = "petinder-public-pets";

function newPetId(shelterUid) {
  const slug = shelterUid.slice(0, 8).replace(/[^a-z0-9]/gi, "");
  return `shelter-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readLocalPublicPets() {
  try {
    const raw = localStorage.getItem(LOCAL_PUBLIC_PETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalPublicPets(pets) {
  localStorage.setItem(LOCAL_PUBLIC_PETS_KEY, JSON.stringify(pets));
}

export async function loadPublicPets() {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (!db) return readLocalPublicPets();
    try {
      const snap = await getDocs(collection(db, "publicPets"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Failed to load public pets:", e);
      return readLocalPublicPets();
    }
  }
  return readLocalPublicPets();
}

export async function loadShelterPets(shelterUid) {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (!db) {
      return readLocalPublicPets().filter((p) => p.shelterUid === shelterUid);
    }
    try {
      const q = query(collection(db, "publicPets"), where("shelterUid", "==", shelterUid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Failed to load shelter pets:", e);
      return readLocalPublicPets().filter((p) => p.shelterUid === shelterUid);
    }
  }
  return readLocalPublicPets().filter((p) => p.shelterUid === shelterUid);
}

export async function publishPublicPet(shelterUid, shelterName, petData) {
  const id = newPetId(shelterUid);
  const record = {
    ...petData,
    id,
    shelterUid,
    shelterName,
    publishedAt: Date.now(),
  };

  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (db) {
      await setDoc(doc(db, "publicPets", id), record);
      return record;
    }
  }

  const all = readLocalPublicPets();
  all.push(record);
  writeLocalPublicPets(all);
  return record;
}

export async function removePublicPet(shelterUid, petId) {
  if (isFirebaseConfigured()) {
    const db = getFirestoreDb();
    if (db) {
      const ref = doc(db, "publicPets", petId);
      const snap = await getDoc(ref);
      if (!snap.exists() || snap.data().shelterUid !== shelterUid) {
        throw new Error("Pet not found");
      }
      await deleteDoc(ref);
      return;
    }
  }

  const all = readLocalPublicPets();
  writeLocalPublicPets(all.filter((p) => !(p.id === petId && p.shelterUid === shelterUid)));
}
