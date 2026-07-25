import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "./firebase.js";

function requireDb() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  const db = getFirestoreDb();
  if (!db) throw new Error("Could not connect to Firestore.");
  return db;
}

export async function notifyShelterOfAppointment({
  shelterUid,
  adopterUid,
  adopterName,
  adopterEmail,
  pet,
  date,
  time,
}) {
  const db = requireDb();
  await addDoc(collection(db, "messages"), {
    type: "appointment",
    shelterUid,
    adopterUid,
    adopterName: adopterName || "Someone",
    adopterEmail: adopterEmail || "",
    petId: pet.id,
    petName: pet.name,
    petSpecies: pet.species || "",
    location: pet.location || pet.shelterName || "",
    date,
    time,
    read: false,
    createdAt: Date.now(),
  });
}

export function subscribeShelterMessages(shelterUid, onMessages) {
  const db = getFirestoreDb();
  if (!db || !shelterUid) return () => {};

  const q = query(collection(db, "messages"), where("shelterUid", "==", shelterUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onMessages(list);
    },
    (err) => console.error("Failed to load messages:", err)
  );
}

export async function markMessageRead(messageId) {
  const db = requireDb();
  await updateDoc(doc(db, "messages", messageId), { read: true });
}

export async function markAllMessagesRead(shelterUid, messages) {
  const db = requireDb();
  const unread = messages.filter((m) => !m.read && m.shelterUid === shelterUid);
  await Promise.all(unread.map((m) => updateDoc(doc(db, "messages", m.id), { read: true })));
}
