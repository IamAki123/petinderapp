import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, X, PawPrint, Calendar, User, RotateCcw,
  MapPin, Sparkles, Clock, Trash2, ChevronRight, MessageCircle, Navigation, LogOut, ClipboardList, Mail
} from "lucide-react";
import { loadUserData, saveUserData, deleteUserData, saveErrorMessage } from "./userData.js";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AuthScreen from "./components/AuthScreen.jsx";
import ShelterListingsScreen from "./components/ShelterListingsScreen.jsx";
import ShelterMessagesScreen from "./components/ShelterMessagesScreen.jsx";
import { createChatSession, normalizeChatSessions } from "./utils/chat.js";
import { mergePetLists, withPhotoUrls } from "./utils/pets.js";
import { defaultAdopterProfile, defaultShelterProfile, userRecordPayload, hasSavedProfile } from "./utils/profile.js";
import { loadPublicPets } from "./publicPets.js";
import { notifyShelterOfAppointment, subscribeShelterMessages, markAllMessagesRead } from "./messages.js";
import {
  todayLocalISO, availableTimeSlots, formatTime12, isTimeAvailable,
} from "./utils/booking.js";
import { mapsDirectionsUrl, resolveShelterCoords } from "./utils/geo.js";
import ShelterMapScreen from "./components/ShelterMapScreen.jsx";
import ChatScreen from "./components/ChatScreen.jsx";

/* ---------------------------------------------------------------------- */
/* DATA                                                                     */
/* ---------------------------------------------------------------------- */

const PETS_URL = "https://iamaki123.github.io/petinder/pets.json";

const FALLBACK_PETS = [
  { id: "f001", name: "Biscuit", species: "dog", breed: "labrador", age: 2, gender: "male", size: "large", energyLevel: "high", temperament: ["playful", "friendly", "good with kids"], bio: "Biscuit is a goofy, tail-wagging lab who loves fetch and belly rubs.", location: "Hillsboro Paws Rescue", adoptionFee: 150, availableForVisit: true },
  { id: "f002", name: "Luna", species: "cat", breed: "siamese", age: 3, gender: "female", size: "medium", energyLevel: "low", temperament: ["independent", "quiet", "affectionate"], bio: "Luna is a calm lap cat who loves sunny windowsills.", location: "Hillsboro Paws Rescue", adoptionFee: 90, availableForVisit: true },
  { id: "f003", name: "Rocket", species: "dog", breed: "husky", age: 1, gender: "male", size: "large", energyLevel: "high", temperament: ["energetic", "vocal", "loyal"], bio: "Rocket has boundless energy and needs long walks and hikes.", location: "Hillsboro Paws Rescue", adoptionFee: 175, availableForVisit: true },
  { id: "f004", name: "Clementine", species: "cat", breed: "tabby", age: 5, gender: "female", size: "medium", energyLevel: "medium", temperament: ["curious", "playful", "gentle"], bio: "Clementine loves chasing feather toys then curling up on laps.", location: "Hillsboro Paws Rescue", adoptionFee: 85, availableForVisit: true },
  { id: "f005", name: "Nibbles", species: "small animal", breed: "holland lop rabbit", age: 1, gender: "female", size: "small", energyLevel: "medium", temperament: ["curious", "gentle", "shy at first"], bio: "Nibbles is a sweet lop-eared rabbit who loves fresh veggies.", location: "Hillsboro Paws Rescue", adoptionFee: 40, availableForVisit: true },
  { id: "f006", name: "Cooper", species: "dog", breed: "goldenretriever", age: 6, gender: "male", size: "large", energyLevel: "medium", temperament: ["gentle", "friendly", "trained"], bio: "Cooper is a well-trained, easygoing golden, great with kids.", location: "Hillsboro Paws Rescue", adoptionFee: 130, availableForVisit: true },
];

function hashToRange(str, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % max) + 1;
}

function photoUrlFor(pet) {
  if (pet.species === "dog") {
    return `https://placedog.net/500/650?id=${hashToRange(pet.id + pet.breed, 100)}`;
  }
  if (pet.species === "cat") {
    return `https://cataas.com/cat?width=500&height=650&unique=${pet.id}`;
  }
  return `https://picsum.photos/seed/${pet.id}/500/650`;
}

function fallbackPhotoUrl(pet) {
  return `https://picsum.photos/seed/${pet.id}-fallback/500/650`;
}

function SignOutButton({ onClick, compact = false, disabled = false, label = "Sign out" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 pt-stamp rounded-lg ${compact ? "text-xs px-2 py-1" : "text-xs px-3 py-2"}`}
      style={{
        border: "1.5px solid var(--pine)",
        color: "var(--pine)",
        background: "transparent",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
      title={label}
    >
      <LogOut size={14} />
      {label}
    </button>
  );
}


const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:ital,wght@0,400;0,600;0,800;1,600&family=Special+Elite&display=swap');

    .pt-root {
      --paper: #F5EFDD;
      --paper-dark: #E9DFC0;
      --pine: #1F3D2E;
      --pine-light: #2F5643;
      --mustard: #E3A93B;
      --brick: #C1442D;
      --ink: #2A2420;
      --clip: #9AA0A6;
      font-family: 'Nunito', sans-serif;
      color: var(--ink);
      background: var(--paper);
    }
    .pt-display { font-family: 'Baloo 2', sans-serif; }
    .pt-stamp { font-family: 'Special Elite', monospace; letter-spacing: 0.5px; }

    .pt-holepunch {
      width: 14px; height: 14px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #00000022, #00000055 70%);
      background-color: var(--paper);
      box-shadow: inset 0 2px 3px rgba(0,0,0,0.35);
    }

    .pt-clip {
      position: absolute; top: -18px; left: 50%; transform: translateX(-50%);
      width: 64px; height: 34px; z-index: 20; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.25));
    }

    .pt-card-shadow { box-shadow: 0 10px 25px rgba(31,61,46,0.18), 0 2px 6px rgba(31,61,46,0.12); }

    @keyframes pt-pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .pt-pop { animation: pt-pop 0.25s ease-out; }

    @keyframes pt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    .pt-float { animation: pt-float 2.4s ease-in-out infinite; }

    .pt-scroll {
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }
  `}</style>
);

/* ---------------------------------------------------------------------- */
/* SMALL PIECES                                                            */
/* ---------------------------------------------------------------------- */

function BulldogClip() {
  return (
    <svg viewBox="0 0 64 34" className="pt-clip">
      <rect x="8" y="6" width="48" height="14" rx="4" fill="#9AA0A6" stroke="#6b7075" strokeWidth="1.5" />
      <rect x="26" y="0" width="12" height="14" rx="2" fill="#7d8388" stroke="#5b6165" strokeWidth="1.5" />
      <circle cx="16" cy="13" r="2" fill="#5b6165" />
      <circle cx="48" cy="13" r="2" fill="#5b6165" />
    </svg>
  );
}

function TagChip({ children }) {
  return (
    <span
      className="pt-stamp"
      style={{
        background: "var(--pine)",
        color: "var(--paper)",
        fontSize: "10.5px",
        padding: "3px 9px",
        borderRadius: "999px",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function BottomNav({ screen, setScreen, matchCount, apptCount, isShelter, messageCount }) {
  const items = isShelter
    ? [
        { key: "listings", label: "Listings", icon: ClipboardList },
        { key: "messages", label: "Inbox", icon: Mail, badge: messageCount },
        { key: "map", label: "Map", icon: MapPin },
        { key: "profile", label: "Profile", icon: User },
      ]
    : [
        { key: "swipe", label: "Swipe", icon: PawPrint },
        { key: "matches", label: "Matches", icon: Heart, badge: matchCount },
        { key: "appointments", label: "Visits", icon: Calendar, badge: apptCount },
        { key: "map", label: "Map", icon: MapPin },
        { key: "chat", label: "AI", icon: MessageCircle },
        { key: "profile", label: "Profile", icon: User },
      ];
  return (
    <div
      style={{
        background: "var(--pine)",
        borderTop: "3px solid var(--mustard)",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
      className="grid py-2 px-1 sticky bottom-0"
    >
      {items.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          onClick={() => setScreen(key)}
          className="flex flex-col items-center gap-0.5 py-1 relative"
          style={{ color: screen === key ? "var(--mustard)" : "#cfe0d3", background: "none", border: "none", cursor: "pointer" }}
        >
          <Icon size={20} strokeWidth={screen === key ? 2.6 : 2} />
          <span className="pt-stamp" style={{ fontSize: "8.5px" }}>{label}</span>
          {badge > 0 && (
            <span
              className="pt-stamp"
              style={{
                position: "absolute", top: -4, right: 2, background: "var(--brick)",
                color: "white", borderRadius: "999px", fontSize: "9px",
                width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* ONBOARDING                                                              */
/* ---------------------------------------------------------------------- */

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", living: "", experience: "", activity: "",
    preferredSpecies: "no preference", hasKids: "", hasOtherPets: "", sizePref: "no preference",
  });

  const steps = [
    {
      key: "name", title: "First, what's your name?",
      render: () => (
        <input
          autoFocus value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Your name"
          className="w-full text-lg px-4 py-3 rounded-xl mt-4"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)", fontFamily: "Nunito" }}
        />
      ),
      valid: () => form.name.trim().length > 0,
    },
    {
      key: "living", title: "What's your living situation?",
      options: ["Apartment", "House, no yard", "House with yard"],
      field: "living",
    },
    {
      key: "experience", title: "Experience with pets?",
      options: ["First-time owner", "Some experience", "Very experienced"],
      field: "experience",
    },
    {
      key: "activity", title: "How active is your household?",
      options: ["Pretty low-key", "Moderately active", "Very active"],
      field: "activity",
    },
    {
      key: "preferredSpecies", title: "Any species preference?",
      options: ["Dog", "Cat", "Small animal", "No preference"],
      field: "preferredSpecies",
    },
    {
      key: "sizePref", title: "Preferred pet size?",
      options: ["Small", "Medium", "Large", "No preference"],
      field: "sizePref",
    },
    {
      key: "hasKids", title: "Kids in the home?",
      options: ["Yes", "No"],
      field: "hasKids",
    },
    {
      key: "hasOtherPets", title: "Other pets at home?",
      options: ["Yes", "No"],
      field: "hasOtherPets",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const choose = (val) => {
    const updated = { ...form, [current.field]: val };
    setForm(updated);
    if (isLast) onDone(updated);
    else setStep(step + 1);
  };

  return (
    <div className="pt-root min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="pt-float mb-2"><PawPrint size={44} color="var(--pine)" /></div>
      <h1 className="pt-display text-3xl mb-1" style={{ color: "var(--pine)" }}>Petinder</h1>
      <p className="pt-stamp text-xs mb-8" style={{ color: "var(--brick)" }}>a shelter kennel-card matchmaker</p>

      <div className="w-full max-w-sm pt-card-shadow rounded-2xl p-6" style={{ background: "white" }}>
        <div className="flex gap-1 mb-5">
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= step ? "var(--mustard)" : "var(--paper-dark)"
            }} />
          ))}
        </div>
        <h2 className="pt-display text-xl mb-3" style={{ color: "var(--ink)" }}>{current.title}</h2>

        {current.render ? (
          <div>
            {current.render()}
            <button
              disabled={!current.valid()}
              onClick={() => setStep(step + 1)}
              className="pt-display w-full mt-5 py-3 rounded-xl text-white"
              style={{ background: current.valid() ? "var(--pine)" : "var(--clip)", border: "none", cursor: current.valid() ? "pointer" : "not-allowed" }}
            >
              Next
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {current.options.map((opt) => (
              <button
                key={opt}
                onClick={() => choose(opt)}
                className="text-left px-4 py-3 rounded-xl transition"
                style={{ border: "2px solid var(--pine)", background: "var(--paper)", color: "var(--ink)", fontWeight: 700, cursor: "pointer" }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShelterOnboarding({ shelterName, onDone }) {
  const [name, setName] = useState(shelterName || "");
  const [location, setLocation] = useState("");

  return (
    <div className="pt-root min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="pt-float mb-2"><PawPrint size={44} color="var(--pine)" /></div>
      <h1 className="pt-display text-3xl mb-1" style={{ color: "var(--pine)" }}>Shelter setup</h1>
      <p className="text-xs mb-8 text-center max-w-sm" style={{ color: "var(--ink)", opacity: 0.65 }}>
        Confirm your shelter details, then start posting adoptable pets.
      </p>

      <div className="w-full max-w-sm pt-card-shadow rounded-2xl p-6" style={{ background: "white" }}>
        <label className="pt-stamp text-xs block mb-1">Shelter name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hillsboro Paws Rescue"
          className="w-full px-4 py-3 rounded-xl mb-4"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        <label className="pt-stamp text-xs block mb-1">City / address shown on pet cards</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Portland, OR"
          className="w-full px-4 py-3 rounded-xl mb-5"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        <button
          disabled={!name.trim() || !location.trim()}
          onClick={() => onDone({
            role: "shelter",
            name: name.trim(),
            shelterName: name.trim(),
            shelterLocation: location.trim(),
          })}
          className="pt-display w-full py-3 rounded-xl text-white"
          style={{
            background: name.trim() && location.trim() ? "var(--pine)" : "var(--clip)",
            border: "none",
            cursor: name.trim() && location.trim() ? "pointer" : "not-allowed",
          }}
        >
          Open listings dashboard
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SWIPE CARD                                                              */
/* ---------------------------------------------------------------------- */

function KennelCard({ pet, onSwipe, topCard, whyText, whyLoading }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef({ x: 0, y: 0 });
  const [flyDir, setFlyDir] = useState(null);

  const threshold = 110;

  const onPointerDown = (e) => {
    if (!topCard) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.active) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y, active: true });
  };
  const finish = (direction) => {
    setFlyDir(direction);
    setTimeout(() => onSwipe(direction), 220);
  };
  const onPointerUp = () => {
    if (!drag.active) return;
    if (drag.x > threshold) finish("right");
    else if (drag.x < -threshold) finish("left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const rotate = drag.x / 14;
  const likeOpacity = Math.min(Math.max(drag.x / threshold, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / threshold, 0), 1);

  let transform = `translate(${drag.x}px, ${drag.y}px) rotate(${rotate}deg)`;
  let transition = drag.active ? "none" : "transform 0.25s ease-out";
  if (flyDir === "right") { transform = `translate(600px, ${drag.y - 40}px) rotate(28deg)`; transition = "transform 0.22s ease-in"; }
  if (flyDir === "left") { transform = `translate(-600px, ${drag.y - 40}px) rotate(-28deg)`; transition = "transform 0.22s ease-in"; }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="pt-card-shadow absolute inset-0 rounded-2xl overflow-hidden select-none"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--paper-dark)",
        transform,
        transition,
        touchAction: "none",
        cursor: topCard ? "grab" : "default",
      }}
    >
      {topCard && <BulldogClip />}

      <div className="absolute top-3 left-3 pt-holepunch" />
      <div className="absolute top-3 right-3 pt-holepunch" />

      <div
        className="pt-display absolute top-16 left-6 z-30 pointer-events-none"
        style={{
          fontSize: 30, color: "var(--pine-light)", border: "4px solid var(--pine-light)",
          padding: "4px 14px", borderRadius: 10, transform: "rotate(-14deg)",
          opacity: likeOpacity,
        }}
      >
        ADOPT ME!
      </div>
      <div
        className="pt-display absolute top-16 right-6 z-30 pointer-events-none"
        style={{
          fontSize: 26, color: "var(--brick)", border: "4px solid var(--brick)",
          padding: "4px 14px", borderRadius: 10, transform: "rotate(14deg)",
          opacity: nopeOpacity,
        }}
      >
        NOT TODAY
      </div>

      <img
        src={pet.photoUrl}
        alt={pet.name}
        className="w-full"
        style={{ height: "56%", objectFit: "cover", marginTop: 10, background: "var(--paper-dark)" }}
        draggable={false}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = fallbackPhotoUrl(pet);
        }}
      />

      <div className="p-4 pt-2 flex flex-col h-[calc(44%-10px)]">
        <div className="flex items-baseline justify-between">
          <h2 className="pt-display text-2xl" style={{ color: "var(--pine)" }}>{pet.name}</h2>
          <span className="pt-stamp text-sm" style={{ color: "var(--brick)" }}>{pet.age} yr</span>
        </div>
        <div className="pt-stamp text-xs mb-2" style={{ color: "var(--ink)", opacity: 0.75 }}>
          {pet.breed} · {pet.gender} · {pet.size}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pet.temperament?.slice(0, 3).map((t) => <TagChip key={t}>{t}</TagChip>)}
        </div>
        <p className="text-sm flex-1 overflow-hidden" style={{ color: "var(--ink)", lineHeight: 1.35 }}>
          {pet.bio}
        </p>
        <div className="flex items-center gap-1 pt-stamp text-xs mt-1" style={{ color: "var(--pine)" }}>
          <MapPin size={12} /> {pet.location}
        </div>
        {topCard && (whyLoading || whyText) && (
          <div
            className="pt-pop mt-2 rounded-lg px-3 py-2 text-xs flex gap-2 items-start"
            style={{ background: "var(--paper-dark)", color: "var(--pine)" }}
          >
            <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
            <span>{whyLoading ? "Thinking about your match…" : whyText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SWIPE SCREEN                                                            */
/* ---------------------------------------------------------------------- */

function attrsOf(pet) {
  return [
    `species:${pet.species}`,
    `size:${pet.size}`,
    `energy:${pet.energyLevel}`,
    ...(pet.temperament || []).map((t) => `tag:${t}`),
  ];
}

function profileWeights(profile) {
  if (!profile) return {};
  const w = {};
  const add = (key, val) => { w[key] = (w[key] || 0) + val; };

  const speciesPref = profile.preferredSpecies?.toLowerCase();
  if (speciesPref && speciesPref !== "no preference") {
    add(`species:${speciesPref}`, 4);
  }

  const sizePref = profile.sizePref?.toLowerCase();
  if (sizePref && sizePref !== "no preference") {
    add(`size:${sizePref}`, 4);
  }

  if (profile.activity === "Very active") {
    add("energy:high", 3);
    add("energy:medium", 1);
    add("energy:low", -1);
  } else if (profile.activity === "Moderately active") {
    add("energy:medium", 3);
    add("energy:high", 1);
    add("energy:low", 1);
  } else if (profile.activity === "Pretty low-key") {
    add("energy:low", 3);
    add("energy:medium", 1);
    add("energy:high", -2);
  }

  if (profile.living === "Apartment") {
    add("size:large", -2);
    add("size:small", 2);
    add("energy:high", -1);
  } else if (profile.living === "House with yard") {
    add("size:large", 2);
    add("energy:high", 2);
  }

  if (profile.hasKids === "Yes") {
    add("tag:good with kids", 4);
    add("tag:gentle", 2);
    add("tag:friendly", 1);
  }

  if (profile.hasOtherPets === "Yes") {
    add("tag:friendly", 2);
    add("tag:gentle", 1);
  }

  if (profile.experience === "First-time owner") {
    add("tag:trained", 3);
    add("tag:gentle", 2);
    add("energy:high", -2);
  } else if (profile.experience === "Very experienced") {
    add("energy:high", 1);
    add("tag:energetic", 1);
  }

  return w;
}

function scoreOf(pet, profile, swipeWeights) {
  const seeded = profileWeights(profile);
  return attrsOf(pet).reduce((sum, attr) => {
    return sum + (seeded[attr] || 0) + (swipeWeights[attr] || 0) * 1.5;
  }, 0);
}

function sortPetsByPreference(petList, profile, swipeWeights) {
  return petList.slice().sort((a, b) => scoreOf(b, profile, swipeWeights) - scoreOf(a, profile, swipeWeights));
}

function matchedPetIds(matches) {
  return new Set(matches.map((m) => m.id));
}

function buildSwipeQueue(allPets, profile, swipeWeights, matches) {
  const excluded = matchedPetIds(matches);
  return sortPetsByPreference(
    allPets.filter((p) => !excluded.has(p.id)),
    profile,
    swipeWeights
  );
}

function buildMatchReason(pet, profile, swipeWeights) {
  const seeded = profileWeights(profile);
  const petAttrs = attrsOf(pet);
  const reasons = petAttrs
    .map((attr) => ({
      label: attr.split(":")[1],
      score: (seeded[attr] || 0) + (swipeWeights[attr] || 0) * 1.5,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.label);

  if (reasons.length === 0) {
    return `${pet.name} could be a great companion — swipe right to learn more!`;
  }

  const trait = pet.temperament?.[0] || pet.energyLevel;
  return `${pet.name}'s ${trait} vibe fits your preferences for ${reasons.join(", ")}.`;
}

function SwipeScreen({ profile, queue, setQueue, weights, setWeights, onMatch, history, setHistory }) {
  const [why, setWhy] = useState({ text: "", loading: false, forId: null });

  const current = queue[0];
  const next = queue[1];

  useEffect(() => {
    if (!current) {
      setWhy({ text: "", loading: false, forId: null });
      return;
    }

    setWhy({ text: "", loading: true, forId: current.id });
    const timer = setTimeout(() => {
      setWhy({
        text: buildMatchReason(current, profile, weights),
        loading: false,
        forId: current.id,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [current?.id, profile, weights]);

  const handleSwipe = useCallback((direction) => {
    if (!current) return;
    const delta = direction === "right" ? 1 : -1;
    const newWeights = { ...weights };
    attrsOf(current).forEach((a) => { newWeights[a] = (newWeights[a] || 0) + delta; });
    setWeights(newWeights);
    setHistory((h) => [...h, { petId: current.id, direction }]);

    const rest = sortPetsByPreference(queue.slice(1), profile, newWeights);
    if (direction === "left") {
      setQueue([...rest, current]);
    } else {
      setQueue(rest);
      onMatch(current);
    }
  }, [current, queue, weights, profile, setWeights, setHistory, setQueue, onMatch]);

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <PawPrint size={48} color="var(--pine)" className="mb-3" />
        <h2 className="pt-display text-xl mb-2" style={{ color: "var(--pine)" }}>That's every pet for now!</h2>
        <p className="text-sm" style={{ color: "var(--ink)", opacity: 0.7 }}>
          You've matched with everyone available. Check your Matches tab, or remove a match to swipe them again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-5 pt-5 pb-2">
      <div className="relative flex-1" style={{ minHeight: 420 }}>
        {next && <KennelCard pet={next} topCard={false} onSwipe={() => {}} />}
        <KennelCard
          key={current.id}
          pet={current}
          topCard={true}
          onSwipe={handleSwipe}
          whyText={why.forId === current.id ? why.text : ""}
          whyLoading={why.loading && why.forId === current.id}
        />
      </div>
      <div className="flex justify-center gap-6 py-5">
        <button
          onClick={() => handleSwipe("left")}
          className="rounded-full p-4 pt-card-shadow"
          style={{ background: "white", border: "3px solid var(--brick)", cursor: "pointer" }}
        >
          <X size={26} color="var(--brick)" />
        </button>
        <button
          onClick={() => handleSwipe("right")}
          className="rounded-full p-4 pt-card-shadow"
          style={{ background: "white", border: "3px solid var(--pine)", cursor: "pointer" }}
        >
          <Heart size={26} color="var(--pine)" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* MATCHES SCREEN                                                          */
/* ---------------------------------------------------------------------- */

function MatchesScreen({ matches, onBook, onRemove }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <Heart size={44} color="var(--pine)" className="mb-3" />
        <h2 className="pt-display text-xl mb-2" style={{ color: "var(--pine)" }}>No matches yet</h2>
        <p className="text-sm" style={{ color: "var(--ink)", opacity: 0.7 }}>Swipe right on a pet to see them here.</p>
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <h2 className="pt-display text-xl mb-1 px-4 pt-4 shrink-0" style={{ color: "var(--pine)" }}>Your Matches</h2>
      <div className="pt-scroll flex-1 min-h-0 px-4 pb-4 flex flex-col gap-3">
        {matches.map((pet) => (
          <div key={pet.id} className="pt-card-shadow rounded-xl flex overflow-hidden shrink-0" style={{ background: "white" }}>
            <img
              src={pet.photoUrl}
              alt={pet.name}
              className="w-24 h-24 object-cover shrink-0"
              style={{ background: "var(--paper-dark)" }}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackPhotoUrl(pet); }}
            />
            <div className="p-3 flex-1 min-w-0">
              <h3 className="pt-display text-lg" style={{ color: "var(--pine)" }}>{pet.name}</h3>
              <p className="pt-stamp text-xs mb-2" style={{ color: "var(--ink)", opacity: 0.7 }}>{pet.breed} · {pet.age}yr</p>
              <button
                onClick={() => onBook(pet)}
                className="pt-stamp text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1"
                style={{ background: "var(--mustard)", border: "none", cursor: "pointer" }}
              >
                <Calendar size={13} /> Book a Visit <ChevronRight size={13} />
              </button>
            </div>
            <button
              onClick={() => onRemove(pet.id)}
              aria-label={`Remove ${pet.name} from matches`}
              title="Remove match"
              className="px-3 flex items-center justify-center shrink-0"
              style={{ color: "var(--brick)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* BOOKING MODAL                                                           */
/* ---------------------------------------------------------------------- */

function BookingModal({ pet, onConfirm, onClose }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const minDate = todayLocalISO();
  const timeOptions = availableTimeSlots(date);
  const canConfirm = date && time && isTimeAvailable(date, time);

  const handleDateChange = (nextDate) => {
    setDate(nextDate);
    if (time && !isTimeAvailable(nextDate, time)) setTime("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(31,61,46,0.55)" }}>
      <div className="pt-pop w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" style={{ background: "var(--paper)" }}>
        <h3 className="pt-display text-xl mb-1" style={{ color: "var(--pine)" }}>Book a visit with {pet.name}</h3>
        <p className="text-xs mb-4" style={{ color: "var(--ink)", opacity: 0.7 }}>{pet.location}</p>
        <label className="pt-stamp text-xs block mb-1">Date</label>
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg"
          style={{ border: "2px solid var(--pine)" }}
        />
        <label className="pt-stamp text-xs block mb-1">Time (office hours 9 AM – 5 PM)</label>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={!date || timeOptions.length === 0}
          className="w-full mb-2 px-3 py-2 rounded-lg text-sm"
          style={{ border: "2px solid var(--pine)", background: "white" }}
        >
          <option value="">
            {!date ? "Pick a date first" : timeOptions.length === 0 ? "No times left today" : "Select a time"}
          </option>
          {timeOptions.map((slot) => (
            <option key={slot} value={slot}>{formatTime12(slot)}</option>
          ))}
        </select>
        <p className="text-[11px] mb-4" style={{ color: "var(--ink)", opacity: 0.55 }}>
          Visits available every 30 minutes, Mon–Sun style hours.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl pt-stamp text-sm" style={{ border: "2px solid var(--clip)", color: "var(--ink)", background: "transparent", cursor: "pointer" }}>Cancel</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(date, time)}
            className="flex-1 py-2.5 rounded-xl pt-stamp text-sm text-white"
            style={{ background: canConfirm ? "var(--pine)" : "var(--clip)", border: "none", cursor: canConfirm ? "pointer" : "not-allowed" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* APPOINTMENTS SCREEN                                                     */
/* ---------------------------------------------------------------------- */

function AppointmentsScreen({ appointments, onCancel }) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <Calendar size={44} color="var(--pine)" className="mb-3" />
        <h2 className="pt-display text-xl mb-2" style={{ color: "var(--pine)" }}>No visits booked</h2>
        <p className="text-sm" style={{ color: "var(--ink)", opacity: 0.7 }}>Book a visit from your Matches tab.</p>
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <h2 className="pt-display text-xl mb-1 px-4 pt-4 shrink-0" style={{ color: "var(--pine)" }}>Upcoming Visits</h2>
      <div className="pt-scroll flex-1 min-h-0 px-4 pb-4 flex flex-col gap-3">
      {appointments.map((a, i) => {
        const mapsUrl = mapsDirectionsUrl(a.pet.location, a.shelterLat, a.shelterLng);
        return (
        <div key={i} className="pt-card-shadow rounded-xl p-3 flex gap-3" style={{ background: "white" }}>
          <div className="flex-1 min-w-0">
            <h3 className="pt-display text-base" style={{ color: "var(--pine)" }}>{a.pet.name}</h3>
            <p className="pt-stamp text-xs flex items-center gap-1 mt-1" style={{ color: "var(--ink)", opacity: 0.75 }}>
              <Clock size={12} /> {a.date} at {formatTime12(a.time)}
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 mt-2 group"
              style={{ textDecoration: "none" }}
            >
              <MapPin size={14} color="var(--pine)" className="shrink-0 mt-0.5" />
              <span className="text-xs underline" style={{ color: "var(--pine)" }}>
                {a.pet.location}
              </span>
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pt-stamp text-xs inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg text-white"
              style={{ background: "var(--mustard)", textDecoration: "none" }}
            >
              <Navigation size={13} /> Get directions
            </a>
          </div>
          <button onClick={() => onCancel(i)} className="p-2 rounded-lg shrink-0 self-start" style={{ color: "var(--brick)", background: "none", border: "none", cursor: "pointer" }}>
            <Trash2 size={18} />
          </button>
        </div>
        );
      })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* PROFILE SCREEN                                                          */
/* ---------------------------------------------------------------------- */

function ProfileScreen({ profile, weights, history, matches, appointments, onReset, onLogout, displayName, syncLabel, loggingOut }) {
  const top = Object.entries(weights).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxW = top.length ? top[0][1] : 1;
  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-full p-3" style={{ background: "var(--pine)" }}><User size={26} color="var(--paper)" /></div>
        <div>
          <h2 className="pt-display text-xl" style={{ color: "var(--pine)" }}>{profile.name}</h2>
          <p className="pt-stamp text-xs" style={{ color: "var(--ink)", opacity: 0.65 }}>{profile.living} · {profile.experience}</p>
        </div>
      </div>

      <div className="rounded-xl px-3 py-2 mb-5 flex items-center justify-between" style={{ background: "var(--paper-dark)" }}>
        <span className="pt-stamp text-xs" style={{ color: "var(--pine)" }}>Signed in as {displayName} · {syncLabel}</span>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="pt-stamp text-xs underline"
          style={{ color: "var(--pine)", background: "none", border: "none", cursor: loggingOut ? "wait" : "pointer", opacity: loggingOut ? 0.6 : 1 }}
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {[["Swipes", history.length], ["Matches", matches.length], ["Visits", appointments.length]].map(([label, val]) => (
          <div key={label} className="rounded-xl p-3 text-center pt-card-shadow" style={{ background: "white" }}>
            <div className="pt-display text-2xl" style={{ color: "var(--pine)" }}>{val}</div>
            <div className="pt-stamp text-[10px]" style={{ color: "var(--ink)", opacity: 0.6 }}>{label}</div>
          </div>
        ))}
      </div>

      <h3 className="pt-display text-lg mb-2" style={{ color: "var(--pine)" }}>What Petinder's learned</h3>
      {top.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: "var(--ink)", opacity: 0.65 }}>Swipe on a few pets and your preferences will show up here.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {top.map(([attr, val]) => {
            const label = attr.split(":")[1];
            return (
              <div key={attr}>
                <div className="flex justify-between pt-stamp text-xs mb-0.5">
                  <span>{label}</span><span>{val}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--paper-dark)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${(val / maxW) * 100}%`, background: "var(--mustard)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onReset} className="pt-stamp text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 mt-4" style={{ border: "2px solid var(--brick)", color: "var(--brick)", background: "transparent", cursor: "pointer" }}>
        <RotateCcw size={14} /> Delete my saved data
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* APP ROOT                                                                */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [weights, setWeights] = useState({});
  const [history, setHistory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [screen, setScreen] = useState("swipe");
  const [booking, setBooking] = useState(null);
  const [syncNote, setSyncNote] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [shelterMessages, setShelterMessages] = useState([]);
  const [profileReady, setProfileReady] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const authIntentRef = useRef(null);
  const authHydrateResolve = useRef(null);
  const hydratedUidRef = useRef(null);
  const hydrating = useRef(false);
  const saveTimer = useRef(null);
  const queueInitialized = useRef(false);
  const loggingOutRef = useRef(false);

  const resetAppState = () => {
    queueInitialized.current = false;
    hydratedUidRef.current = null;
    setProfile(null);
    setProfileReady(false);
    setNeedsProfileSetup(false);
    setQueue([]);
    setWeights({});
    setHistory([]);
    setMatches([]);
    setAppointments([]);
    setChatSessions([]);
    setActiveChatId(null);
    setScreen("swipe");
    setBooking(null);
    setSyncNote("");
  };

  const applyGameState = (saved, profileForChat) => {
    if (!saved) return;
    if (saved.weights && Object.keys(saved.weights).length > 0) setWeights(saved.weights);
    if (Array.isArray(saved.history) && saved.history.length > 0) setHistory(saved.history);
    if (Array.isArray(saved.matches) && saved.matches.length > 0) setMatches(saved.matches);
    if (Array.isArray(saved.appointments) && saved.appointments.length > 0) setAppointments(saved.appointments);
    if (profileForChat && Array.isArray(saved.chatSessions) && saved.chatSessions.length > 0) {
      const sessions = normalizeChatSessions(saved.chatSessions, profileForChat);
      setChatSessions(sessions);
      setActiveChatId(saved.activeChatId || sessions[0]?.id || null);
    }
  };

  const applySavedData = (saved, accountType) => {
    if (saved?.profile) {
      setProfile(saved.profile);
      setWeights(saved.weights || {});
      setHistory(saved.history || []);
      setMatches(saved.matches || []);
      setAppointments(saved.appointments || []);
      const sessions = normalizeChatSessions(saved.chatSessions, saved.profile);
      setChatSessions(sessions);
      setActiveChatId(saved.activeChatId || sessions[0]?.id || null);
      setSyncNote("Welcome back! Loaded your saved profile.");
      setTimeout(() => setSyncNote(""), 3000);
      if (accountType === "shelter" || saved.profile.role === "shelter") {
        setScreen("listings");
      }
    } else {
      setProfile(null);
      setWeights({});
      setHistory([]);
      setMatches([]);
      setAppointments([]);
      setChatSessions([]);
      setActiveChatId(null);
    }
  };

  const initFreshSession = (newProfile, accountType) => {
    setProfile(newProfile);
    setWeights({});
    setHistory([]);
    setMatches([]);
    setAppointments([]);
    if (accountType === "shelter" || newProfile.role === "shelter") {
      setChatSessions([]);
      setActiveChatId(null);
      setScreen("listings");
    } else {
      const firstChat = createChatSession(newProfile);
      setChatSessions([firstChat]);
      setActiveChatId(firstChat.id);
      setScreen("swipe");
    }
    setNeedsProfileSetup(false);
  };

  const resolveAuthWaiters = () => {
    const resolve = authHydrateResolve.current;
    authHydrateResolve.current = null;
    resolve?.();
  };

  const hydrateUser = async (nextUser, { isNewSignup = false } = {}) => {
    if (!nextUser?.uid) return;

    setProfileReady(false);
    hydrating.current = true;
    queueInitialized.current = false;

    setUser({
      ...nextUser,
      accountType: nextUser.accountType || "adopter",
      shelterName: nextUser.shelterName || "",
    });

    try {
      const saved = await loadUserData(nextUser.uid);
      const accountType = saved?.accountType || nextUser.accountType || "adopter";
      const shelterName = saved?.shelterName || nextUser.shelterName || "";
      setUser({ ...nextUser, accountType, shelterName });

      if (hasSavedProfile(saved)) {
        applySavedData(saved, accountType);
        setNeedsProfileSetup(false);
        hydratedUidRef.current = nextUser.uid;
      } else if (isNewSignup) {
        setProfile(null);
        setWeights({});
        setHistory([]);
        setMatches([]);
        setAppointments([]);
        setChatSessions([]);
        setActiveChatId(null);
        setNeedsProfileSetup(true);
        hydratedUidRef.current = nextUser.uid;
      } else {
        const fallbackProfile = accountType === "shelter"
          ? defaultShelterProfile(nextUser.email, shelterName)
          : defaultAdopterProfile(nextUser.email);
        initFreshSession(fallbackProfile, accountType);
        applyGameState(saved, fallbackProfile);
        hydratedUidRef.current = nextUser.uid;
        if (saved?.matches?.length) {
          setSyncNote(`Welcome back! Restored ${saved.matches.length} match${saved.matches.length === 1 ? "" : "es"}.`);
        } else {
          setSyncNote("No saved preferences yet — showing all pets.");
        }
        setTimeout(() => setSyncNote(""), 3000);
      }
    } catch (e) {
      console.error("Failed to load saved profile:", e);
      if (isNewSignup) {
        setNeedsProfileSetup(true);
      } else {
        const accountType = nextUser.accountType || "adopter";
        initFreshSession(
          accountType === "shelter"
            ? defaultShelterProfile(nextUser.email, nextUser.shelterName)
            : defaultAdopterProfile(nextUser.email),
          accountType
        );
      }
      hydratedUidRef.current = nextUser.uid;
    } finally {
      setProfileReady(true);
      resolveAuthWaiters();
      setTimeout(() => { hydrating.current = false; }, 0);
    }
  };

  const prepareAuth = useCallback((intent) => {
    authIntentRef.current = intent;
    hydratedUidRef.current = null;
    return new Promise((resolve) => {
      authHydrateResolve.current = resolve;
      setTimeout(resolve, 15000);
    });
  }, []);

  const reloadPets = useCallback(async () => {
    setLoading(true);
    let list;
    try {
      const res = await fetch(PETS_URL);
      if (!res.ok) throw new Error("bad response");
      list = await res.json();
      if (!Array.isArray(list) || list.length === 0) throw new Error("empty");
    } catch {
      list = FALLBACK_PETS;
    }
    const publicList = await loadPublicPets();
    const merged = mergePetLists(list, publicList);
    setPets(withPhotoUrls(merged));
    queueInitialized.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user || profileReady) return undefined;
    const timer = setTimeout(() => {
      console.warn("Profile load safety timeout — continuing with defaults");
      if (!profile && !needsProfileSetup) {
        const accountType = user.accountType || "adopter";
        initFreshSession(
          accountType === "shelter"
            ? defaultShelterProfile(user.email, user.shelterName)
            : defaultAdopterProfile(user.email),
          accountType
        );
      }
      setProfileReady(true);
      resolveAuthWaiters();
    }, 12000);
    return () => clearTimeout(timer);
  }, [user, profileReady, profile, needsProfileSetup]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthLoading(false);
      return undefined;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }

    const timeout = setTimeout(() => setAuthLoading(false), 8000);

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      setAuthLoading(false);

      if (!firebaseUser) {
        setUser(null);
        resetAppState();
        return;
      }

      if (hydratedUidRef.current === firebaseUser.uid && !authIntentRef.current) {
        setProfileReady(true);
        return;
      }

      const intent = authIntentRef.current;
      if (intent) authIntentRef.current = null;

      hydrateUser(
        {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          mode: "firebase",
          accountType: intent?.accountType,
          shelterName: intent?.shelterName,
        },
        { isNewSignup: intent?.isNewSignup ?? false }
      ).catch((e) => console.error("Auth hydrate failed:", e));
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user || user.accountType !== "shelter") {
      setShelterMessages([]);
      return undefined;
    }
    return subscribeShelterMessages(user.uid, setShelterMessages);
  }, [user?.uid, user?.accountType]);

  useEffect(() => {
    if (screen !== "messages" || !user || user.accountType !== "shelter") return;
    if (shelterMessages.some((m) => !m.read)) {
      markAllMessagesRead(user.uid, shelterMessages).catch(console.error);
    }
  }, [screen, shelterMessages, user]);

  useEffect(() => {
    reloadPets();
  }, [reloadPets]);

  useEffect(() => {
    if (queueInitialized.current) return;
    if (pets.length === 0 || !user || !profile) return;
    if (user.accountType === "shelter" || profile.role === "shelter") return;
    setQueue(buildSwipeQueue(pets, profile, weights, matches));
    queueInitialized.current = true;
  }, [pets, user, profile, matches, weights]);

  const buildUserRecord = (extra = {}) => userRecordPayload(user, {
    accountType: user.accountType || "adopter",
    shelterName: user.shelterName || profile?.shelterName || "",
    profileSetupComplete: Boolean(profile?.name && !needsProfileSetup),
    profile, weights, history, matches, appointments,
    chatSessions, activeChatId,
    ...extra,
  });

  const showSyncError = (result) => {
    setSyncNote(saveErrorMessage(result));
    setTimeout(() => setSyncNote(""), 6000);
  };

  const persistToCloud = async (overrides = {}, { quiet = false } = {}) => {
    if (!user?.uid || !profile || needsProfileSetup) return { ok: false };
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const result = await saveUserData(user.uid, buildUserRecord({
      profileSetupComplete: true,
      ...overrides,
    }));
    if (!result.ok && !quiet) showSyncError(result);
    return result;
  };

  const flushUserSave = async (timeoutMs = 2000) => {
    if (!user || !profile) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await Promise.race([
        persistToCloud({}, { quiet: true }),
        new Promise((resolve) => { setTimeout(resolve, timeoutMs); }),
      ]);
    } catch (e) {
      console.warn("Could not flush save before sign out:", e);
    }
  };

  const handleLogout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);

    await flushUserSave(2000);

    try {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    } catch (e) {
      console.error("Sign out failed:", e);
      setSyncNote("Could not sign out. Try refreshing the page.");
      setTimeout(() => setSyncNote(""), 4000);
    } finally {
      setUser(null);
      resetAppState();
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  };

  const handleOnboardingDone = async (newProfile) => {
    queueInitialized.current = false;
    hydrating.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNeedsProfileSetup(false);
    setProfile(newProfile);
    const firstChat = createChatSession(newProfile);
    setChatSessions([firstChat]);
    setActiveChatId(firstChat.id);
    if (user) {
      const result = await saveUserData(user.uid, buildUserRecord({
        profileSetupComplete: true,
        profile: newProfile,
        weights: {}, history: [], matches: [], appointments: [],
        chatSessions: [firstChat], activeChatId: firstChat.id,
      }));
      if (!result.ok) {
        showSyncError(result);
      } else {
        setSyncNote("Profile saved!");
        setTimeout(() => setSyncNote(""), 2500);
      }
    }
    hydrating.current = false;
  };

  const handleShelterOnboardingDone = async (newProfile) => {
    hydrating.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNeedsProfileSetup(false);
    setProfile(newProfile);
    setScreen("listings");
    if (user) {
      const result = await saveUserData(user.uid, buildUserRecord({
        profileSetupComplete: true,
        accountType: "shelter",
        shelterName: newProfile.shelterName,
        profile: newProfile,
        weights: {}, history: [], matches: [], appointments: [],
        chatSessions: [], activeChatId: null,
      }));
      if (!result.ok) {
        showSyncError(result);
      } else {
        setSyncNote("Shelter profile saved!");
        setTimeout(() => setSyncNote(""), 2500);
      }
    }
    hydrating.current = false;
  };

  useEffect(() => {
    if (!user || !profile || hydrating.current || needsProfileSetup) return;
    if (!profile.name) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistToCloud({}, { quiet: true });
    }, 2500);
    return () => clearTimeout(saveTimer.current);
  }, [profile, weights, history, matches, appointments, user, needsProfileSetup]);

  const handleMatch = (pet) => {
    setMatches((current) => {
      if (current.some((entry) => entry.id === pet.id)) return current;
      const next = [...current, pet];
      persistToCloud({ matches: next });
      return next;
    });
  };

  const handleRemoveMatch = (petId) => {
    setMatches((current) => {
      const next = current.filter((entry) => entry.id !== petId);
      persistToCloud({ matches: next });
      return next;
    });
    setAppointments((a) => a.filter((appt) => appt.pet.id !== petId));
    const pet = pets.find((p) => p.id === petId);
    if (pet) {
      setQueue((q) => sortPetsByPreference([...q, pet], profile, weights));
    }
  };
  const handleBookConfirm = async (date, time) => {
    const pet = booking;
    const coords = await resolveShelterCoords(pet.location);
    setAppointments((a) => {
      const next = [...a, {
        pet,
        date,
        time,
        shelterLat: coords?.lat ?? null,
        shelterLng: coords?.lng ?? null,
      }];
      persistToCloud({ appointments: next });
      return next;
    });

    if (pet.shelterUid && user?.uid) {
      try {
        await notifyShelterOfAppointment({
          shelterUid: pet.shelterUid,
          adopterUid: user.uid,
          adopterName: profile?.name || user.email || "An adopter",
          adopterEmail: user.email || "",
          pet,
          date,
          time,
        });
        setSyncNote(`Visit booked! ${pet.shelterName || "The shelter"} has been notified.`);
      } catch (e) {
        console.error(e);
        setSyncNote(`Visit booked at ${pet.location}. (Shelter notification failed — check Firebase.)`);
      }
    } else {
      setSyncNote(`Visit booked at ${pet.location}. Tap the card for directions.`);
    }

    setBooking(null);
    setScreen("appointments");
    setTimeout(() => setSyncNote(""), 4000);
  };

  const handleWipe = async () => {
    if (user) await deleteUserData(user.uid);
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="pt-root h-full min-h-[640px] flex flex-col items-center justify-center">
        <GlobalStyle />
        <PawPrint size={36} color="var(--pine)" className="pt-float" />
        <p className="pt-stamp text-xs mt-3" style={{ color: "var(--ink)", opacity: 0.6 }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-root h-full min-h-[640px]">
        <GlobalStyle />
        <AuthScreen prepareAuth={prepareAuth} />
      </div>
    );
  }

  if (!profileReady) {
    return (
      <div className="pt-root h-full min-h-[640px] flex flex-col items-center justify-center">
        <GlobalStyle />
        <PawPrint size={36} color="var(--pine)" className="pt-float" />
        <p className="pt-stamp text-xs mt-3" style={{ color: "var(--ink)", opacity: 0.6 }}>Loading your profile…</p>
      </div>
    );
  }

  if (needsProfileSetup) {
    const isShelter = user.accountType === "shelter";
    return (
      <div className="pt-root h-full min-h-[640px] flex flex-col">
        <GlobalStyle />
        <div className="flex justify-end px-5 pt-4">
          <SignOutButton onClick={handleLogout} disabled={loggingOut} label={loggingOut ? "Signing out…" : "Sign out"} />
        </div>
        <div className="flex-1 min-h-0">
          {isShelter ? (
            <ShelterOnboarding shelterName={user.shelterName} onDone={handleShelterOnboardingDone} />
          ) : (
            <Onboarding onDone={handleOnboardingDone} />
          )}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-root h-full min-h-[640px] flex flex-col items-center justify-center">
        <GlobalStyle />
        <PawPrint size={36} color="var(--pine)" className="pt-float" />
        <p className="pt-stamp text-xs mt-3" style={{ color: "var(--ink)", opacity: 0.6 }}>Starting up…</p>
      </div>
    );
  }

  const isShelter = user.accountType === "shelter" || profile.role === "shelter";
  const unreadMessages = shelterMessages.filter((m) => !m.read).length;

  return (
    <div className="pt-root h-full min-h-[640px] flex flex-col" style={{ maxWidth: 420, margin: "0 auto" }}>
      <GlobalStyle />
      <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PawPrint size={22} color="var(--pine)" />
          <span className="pt-display text-lg truncate" style={{ color: "var(--pine)" }}>Petinder</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="pt-stamp text-xs hidden sm:inline" style={{ color: "var(--brick)" }}>hi, {profile.name}</span>
          <SignOutButton onClick={handleLogout} compact disabled={loggingOut} label={loggingOut ? "…" : "Sign out"} />
        </div>
      </div>

      {syncNote && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-lg pt-stamp text-xs" style={{ background: "var(--paper-dark)", color: "var(--pine)" }}>
          {syncNote}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="pt-float"><PawPrint size={36} color="var(--pine)" /></div>
            <p className="pt-stamp text-xs mt-3" style={{ color: "var(--ink)", opacity: 0.6 }}>Fetching kennel cards…</p>
          </div>
        ) : screen === "listings" ? (
          <ShelterListingsScreen user={user} profile={profile} onPetsUpdated={reloadPets} />
        ) : screen === "messages" ? (
          <ShelterMessagesScreen messages={shelterMessages} />
        ) : screen === "swipe" ? (
          <SwipeScreen
            profile={profile}
            queue={queue} setQueue={setQueue}
            weights={weights} setWeights={setWeights}
            onMatch={handleMatch} history={history} setHistory={setHistory}
          />
        ) : screen === "matches" ? (
          <MatchesScreen matches={matches} onBook={setBooking} onRemove={handleRemoveMatch} />
        ) : screen === "appointments" ? (
          <AppointmentsScreen appointments={appointments} onCancel={(i) => setAppointments((a) => a.filter((_, idx) => idx !== i))} />
        ) : screen === "map" ? (
          <ShelterMapScreen />
        ) : screen === "chat" ? (
          <ChatScreen
            profile={profile}
            weights={weights}
            matches={matches}
            queue={queue}
            sessions={chatSessions}
            activeChatId={activeChatId}
            onSessionsChange={setChatSessions}
            onActiveChatChange={setActiveChatId}
          />
        ) : (
          <ProfileScreen
            profile={profile} weights={weights} history={history} matches={matches} appointments={appointments}
            onReset={handleWipe} onLogout={handleLogout}
            displayName={user.email || user.username}
            syncLabel="synced to cloud"
            loggingOut={loggingOut}
          />
        )}
      </div>

      <BottomNav
        screen={screen}
        setScreen={setScreen}
        matchCount={matches.length}
        apptCount={appointments.length}
        isShelter={isShelter}
        messageCount={unreadMessages}
      />

      {booking && <BookingModal pet={booking} onClose={() => setBooking(null)} onConfirm={handleBookConfirm} />}
    </div>
  );
}
