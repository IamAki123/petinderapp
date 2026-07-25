function hashToRange(str, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % max) + 1;
}

export function photoUrlFor(pet) {
  if (pet.photoUrl) return pet.photoUrl;
  if (pet.species === "dog") {
    return `https://placedog.net/500/650?id=${hashToRange(pet.id + pet.breed, 100)}`;
  }
  if (pet.species === "cat") {
    return `https://cataas.com/cat?width=500&height=650&unique=${pet.id}`;
  }
  return `https://picsum.photos/seed/${pet.id}/500/650`;
}

export function withPhotoUrls(pets) {
  return pets.map((pet) => ({ ...pet, photoUrl: photoUrlFor(pet) }));
}

export function mergePetLists(basePets, publicPets) {
  const seen = new Set();
  const merged = [];

  for (const pet of [...publicPets, ...basePets]) {
    if (!pet?.id || seen.has(pet.id)) continue;
    seen.add(pet.id);
    merged.push(pet);
  }

  return merged;
}

export function emptyPetDraft(location = "") {
  return {
    name: "",
    species: "dog",
    breed: "",
    age: "",
    gender: "male",
    size: "medium",
    energyLevel: "medium",
    temperament: "",
    bio: "",
    location,
    adoptionFee: "",
  };
}

export function petFromDraft(draft, shelterUid, shelterName) {
  const temperament = draft.temperament
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    name: draft.name.trim(),
    species: draft.species,
    breed: draft.breed.trim().toLowerCase().replace(/\s+/g, ""),
    age: Number(draft.age),
    gender: draft.gender,
    size: draft.size,
    energyLevel: draft.energyLevel,
    temperament,
    bio: draft.bio.trim(),
    location: draft.location.trim() || shelterName,
    adoptionFee: Number(draft.adoptionFee) || 0,
    availableForVisit: true,
    shelterUid,
    shelterName,
    source: "shelter",
  };
}
