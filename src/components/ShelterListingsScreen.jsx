import { useEffect, useState } from "react";
import { PawPrint, Plus, Trash2 } from "lucide-react";
import { loadShelterPets, publishPublicPet, removePublicPet } from "../publicPets.js";
import { emptyPetDraft, petFromDraft, photoUrlFor } from "../utils/pets.js";

const SPECIES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "small animal", label: "Small animal" },
];

const SELECTS = {
  gender: ["male", "female"],
  size: ["small", "medium", "large"],
  energyLevel: ["low", "medium", "high"],
};

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="pt-stamp text-xs block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { border: "2px solid var(--pine)", background: "var(--paper)" };

export default function ShelterListingsScreen({ user, profile, onPetsUpdated }) {
  const shelterName = profile?.shelterName || profile?.name || "Your shelter";
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyPetDraft(shelterName));

  const reload = async () => {
    setLoading(true);
    const pets = await loadShelterPets(user.uid);
    setListings(pets);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [user.uid]);

  const updateDraft = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const handlePublish = async () => {
    setError("");
    if (!draft.name.trim() || !draft.breed.trim() || !draft.bio.trim()) {
      setError("Name, breed, and bio are required.");
      return;
    }
    if (!draft.age || Number(draft.age) < 0) {
      setError("Enter a valid age.");
      return;
    }

    setBusy(true);
    try {
      const pet = petFromDraft(draft, user.uid, shelterName);
      await publishPublicPet(user.uid, shelterName, pet);
      setDraft(emptyPetDraft(shelterName));
      setShowForm(false);
      await reload();
      onPetsUpdated?.();
    } catch (e) {
      setError(e.message || "Could not publish pet.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (petId) => {
    setBusy(true);
    try {
      await removePublicPet(user.uid, petId);
      await reload();
      onPetsUpdated?.();
    } catch (e) {
      setError(e.message || "Could not remove pet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="pt-display text-xl" style={{ color: "var(--pine)" }}>Shelter listings</h2>
          <p className="text-xs mt-1" style={{ color: "var(--ink)", opacity: 0.7 }}>
            Dogs and cats you publish here appear in everyone&apos;s swipe feed.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="flex items-center gap-1 pt-stamp text-xs px-3 py-2 rounded-xl shrink-0"
          style={{ background: "var(--pine)", color: "white", border: "none", cursor: "pointer" }}
        >
          <Plus size={14} /> Add pet
        </button>
      </div>

      {showForm && (
        <div className="pt-card-shadow rounded-2xl p-4 mb-5" style={{ background: "white" }}>
          <h3 className="pt-display text-lg mb-3" style={{ color: "var(--ink)" }}>New listing</h3>

          <Field label="Name">
            <input value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} placeholder="Biscuit" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Species">
              <select value={draft.species} onChange={(e) => updateDraft("species", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle}>
                {SPECIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Breed">
              <input value={draft.breed} onChange={(e) => updateDraft("breed", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} placeholder="labrador" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Age (years)">
              <input type="number" min="0" value={draft.age} onChange={(e) => updateDraft("age", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} />
            </Field>
            <Field label="Adoption fee ($)">
              <input type="number" min="0" value={draft.adoptionFee} onChange={(e) => updateDraft("adoptionFee", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SELECTS).map(([key, options]) => (
              <Field key={key} label={key === "energyLevel" ? "Energy" : key.charAt(0).toUpperCase() + key.slice(1)}>
                <select value={draft[key]} onChange={(e) => updateDraft(key, e.target.value)} className="w-full px-2 py-2 rounded-xl text-sm" style={inputStyle}>
                  {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </Field>
            ))}
          </div>

          <Field label="Temperament (comma-separated)">
            <input value={draft.temperament} onChange={(e) => updateDraft("temperament", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} placeholder="playful, friendly, good with kids" />
          </Field>

          <Field label="Shelter / location shown on card">
            <input value={draft.location} onChange={(e) => updateDraft("location", e.target.value)} className="w-full px-3 py-2 rounded-xl" style={inputStyle} />
          </Field>

          <Field label="Bio">
            <textarea value={draft.bio} onChange={(e) => updateDraft("bio", e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl" style={inputStyle} placeholder="Tell adopters about this pet…" />
          </Field>

          {error && <p className="text-xs mb-2" style={{ color: "var(--brick)" }}>{error}</p>}

          <button
            onClick={handlePublish}
            disabled={busy}
            className="pt-display w-full py-3 rounded-xl text-white"
            style={{ background: "var(--pine)", border: "none", cursor: busy ? "wait" : "pointer" }}
          >
            {busy ? "Publishing…" : "Publish to swipe feed"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-10">
          <PawPrint size={32} color="var(--pine)" className="pt-float" />
          <p className="pt-stamp text-xs mt-3" style={{ opacity: 0.6 }}>Loading listings…</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: "var(--paper-dark)" }}>
          <p className="text-sm" style={{ color: "var(--ink)", opacity: 0.75 }}>No pets listed yet. Tap Add pet to publish your first one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((pet) => (
            <div key={pet.id} className="pt-card-shadow rounded-2xl overflow-hidden flex" style={{ background: "white" }}>
              <img src={photoUrlFor(pet)} alt={pet.name} className="w-24 h-28 object-cover shrink-0" />
              <div className="p-3 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="pt-display text-lg" style={{ color: "var(--pine)" }}>{pet.name}</h4>
                    <p className="text-xs capitalize" style={{ opacity: 0.7 }}>{pet.species} · {pet.breed} · ${pet.adoptionFee}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(pet.id)}
                    disabled={busy}
                    className="p-2 rounded-lg"
                    style={{ border: "1.5px solid var(--brick)", background: "transparent", cursor: "pointer" }}
                    title="Remove listing"
                  >
                    <Trash2 size={14} color="var(--brick)" />
                  </button>
                </div>
                <p className="text-xs mt-1 line-clamp-2" style={{ opacity: 0.8 }}>{pet.bio}</p>
                <p className="pt-stamp text-[10px] mt-2" style={{ color: "var(--mustard)" }}>Live in swipe feed</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
