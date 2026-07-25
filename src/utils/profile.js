export function defaultAdopterProfile(email = "") {
  const name = email.split("@")[0] || "Guest";
  return {
    name,
    living: "No preference",
    experience: "No preference",
    activity: "No preference",
    preferredSpecies: "no preference",
    hasKids: "No preference",
    hasOtherPets: "No preference",
    sizePref: "no preference",
  };
}

export function defaultShelterProfile(email = "", shelterName = "") {
  const name = shelterName || email.split("@")[0] || "Shelter";
  return {
    role: "shelter",
    name,
    shelterName: name,
    shelterLocation: "",
  };
}

export function userRecordPayload(user, extra = {}) {
  return {
    email: user.email || "",
    uid: user.uid,
    ...extra,
  };
}

export function hasSavedProfile(saved) {
  if (!saved?.profile) return false;
  if (saved.profileSetupComplete) return true;
  return hasRealPreferences(saved.profile);
}

function hasRealPreferences(profile) {
  if (!profile?.name?.trim()) return false;
  const fields = [
    profile.living,
    profile.experience,
    profile.activity,
    profile.hasKids,
    profile.hasOtherPets,
  ];
  return fields.some((value) => value && value !== "No preference");
}
