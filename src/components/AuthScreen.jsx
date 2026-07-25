import { useState } from "react";
import { PawPrint } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../firebase.js";
import { saveUserData } from "../userData.js";
import { userRecordPayload } from "../utils/profile.js";

function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use": "That email is already registered. Try logging in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase. Enable it under Authentication → Sign-in method.",
    "auth/unauthorized-domain": "This website URL is not allowed in Firebase. Add your Vercel URL under Authentication → Settings → Authorized domains.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
  };
  return map[code] || err?.message || "Something went wrong. Please try again.";
}

function FirebaseSetupScreen() {
  return (
    <div className="pt-root min-h-full flex flex-col items-center justify-center px-6 py-10">
      <PawPrint size={44} color="var(--pine)" className="mb-3" />
      <h1 className="pt-display text-2xl mb-2" style={{ color: "var(--pine)" }}>Firebase required</h1>
      <p className="text-sm text-center max-w-sm mb-4" style={{ color: "var(--ink)", opacity: 0.75 }}>
        Accounts, pet listings, and messages sync through Firebase so you can log in on any device.
      </p>
      <div className="text-xs text-left max-w-sm rounded-xl p-4" style={{ background: "var(--paper-dark)" }}>
        <p className="mb-2 font-bold">Add to <code>.env</code> (local) or Vercel env vars:</p>
        <p className="font-mono text-[10px] leading-relaxed opacity-80">
          VITE_FIREBASE_API_KEY<br />
          VITE_FIREBASE_AUTH_DOMAIN<br />
          VITE_FIREBASE_PROJECT_ID<br />
          VITE_FIREBASE_STORAGE_BUCKET<br />
          VITE_FIREBASE_MESSAGING_SENDER_ID<br />
          VITE_FIREBASE_APP_ID
        </p>
      </div>
    </div>
  );
}

function ShelterSignupFields({ isShelter, setIsShelter, shelterName, setShelterName }) {
  return (
    <>
      <label className="flex items-start gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isShelter}
          onChange={(e) => setIsShelter(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm" style={{ color: "var(--ink)" }}>
          Create a shelter account
          <span className="block text-xs mt-0.5" style={{ opacity: 0.65 }}>
            List adoptable pets that appear in everyone&apos;s swipe feed.
          </span>
        </span>
      </label>

      {isShelter && (
        <>
          <label className="pt-stamp text-xs block mb-1">Shelter name</label>
          <input
            type="text"
            value={shelterName}
            onChange={(e) => setShelterName(e.target.value)}
            placeholder="e.g. Hillsboro Paws Rescue"
            className="w-full px-4 py-3 rounded-xl mb-3"
            style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
          />
        </>
      )}
    </>
  );
}

export default function AuthScreen({ prepareAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isShelter, setIsShelter] = useState(false);
  const [shelterName, setShelterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isFirebaseConfigured()) {
    return <FirebaseSetupScreen />;
  }

  const submit = async () => {
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (isShelter && !shelterName.trim()) {
        setError("Enter your shelter name.");
        return;
      }
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase not configured");

      const accountType = isShelter ? "shelter" : "adopter";
      const trimmedShelter = isShelter ? shelterName.trim() : "";
      const hydratePromise = prepareAuth?.({
        isNewSignup: mode === "signup",
        accountType: mode === "signup" ? accountType : undefined,
        shelterName: mode === "signup" ? trimmedShelter : undefined,
      });

      let cred;
      if (mode === "signup") {
        cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await saveUserData(cred.user.uid, userRecordPayload(cred.user, {
          accountType,
          shelterName: trimmedShelter,
        }));
      } else {
        cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      if (hydratePromise) await hydratePromise;
    } catch (err) {
      setError(friendlyAuthError(err));
      if (prepareAuth) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-root min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="pt-float mb-2"><PawPrint size={44} color="var(--pine)" /></div>
      <h1 className="pt-display text-3xl mb-1" style={{ color: "var(--pine)" }}>Petinder</h1>
      <p className="pt-stamp text-xs mb-8" style={{ color: "var(--brick)" }}>a shelter kennel-card matchmaker</p>

      <div className="w-full max-w-sm pt-card-shadow rounded-2xl p-6" style={{ background: "white" }}>
        <div className="flex rounded-xl mb-5 overflow-hidden" style={{ border: "2px solid var(--pine)" }}>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 pt-stamp text-xs"
              style={{
                background: mode === m ? "var(--pine)" : "var(--paper)",
                color: mode === m ? "var(--paper)" : "var(--pine)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <h2 className="pt-display text-xl mb-1" style={{ color: "var(--ink)" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--ink)", opacity: 0.65 }}>
          {mode === "login"
            ? "Your saved preferences load automatically. No profile yet? You can still browse pets."
            : "Create an account, then set up your profile. Adopters swipe; shelters publish listings."}
        </p>

        <label className="pt-stamp text-xs block mb-1">Email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl mb-3"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        <label className="pt-stamp text-xs block mb-1">Password</label>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="at least 6 characters"
          className="w-full px-4 py-3 rounded-xl mb-3"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        {mode === "signup" && (
          <>
            <label className="pt-stamp text-xs block mb-1">Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="repeat password"
              className="w-full px-4 py-3 rounded-xl mb-3"
              style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
            />
            <ShelterSignupFields
              isShelter={isShelter}
              setIsShelter={setIsShelter}
              shelterName={shelterName}
              setShelterName={setShelterName}
            />
          </>
        )}

        {error && <p className="text-xs mb-2" style={{ color: "var(--brick)" }}>{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="pt-display w-full mt-3 py-3 rounded-xl text-white"
          style={{ background: "var(--pine)", border: "none", cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </div>
    </div>
  );
}
