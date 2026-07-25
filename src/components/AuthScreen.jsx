import { useState } from "react";
import { PawPrint } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../firebase.js";
import { loadAccount, saveAccount, saveSession } from "../storage.js";
import { saveUserData } from "../userData.js";

function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "That email is already registered. Try logging in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
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

function LocalAuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isShelter, setIsShelter] = useState(false);
  const [shelterName, setShelterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const trimmed = username.trim();
    if (!trimmed || !passcode) {
      setError("Enter a username and passcode.");
      return;
    }
    if (mode === "signup") {
      if (passcode.length < 4) {
        setError("Passcode must be at least 4 characters.");
        return;
      }
      if (passcode !== confirm) {
        setError("Passcodes do not match.");
        return;
      }
      if (isShelter && !shelterName.trim()) {
        setError("Enter your shelter name.");
        return;
      }
    }

    setBusy(true);
    try {
      const existing = await loadAccount(trimmed);
      if (mode === "login") {
        if (!existing || existing.passcode !== passcode) {
          setError("Wrong username or passcode.");
          return;
        }
        saveSession(trimmed);
        onAuthSuccess({
          uid: trimmed.toLowerCase(),
          username: trimmed,
          mode: "local",
          accountType: existing.accountType || "adopter",
          shelterName: existing.shelterName || "",
        });
        return;
      }

      if (existing) {
        setError("That username is already taken. Try logging in.");
        return;
      }

      const accountType = isShelter ? "shelter" : "adopter";
      await saveAccount(trimmed, {
        passcode,
        accountType,
        shelterName: isShelter ? shelterName.trim() : "",
      });

      saveSession(trimmed);
      onAuthSuccess({
        uid: trimmed.toLowerCase(),
        username: trimmed,
        mode: "local",
        accountType,
        shelterName: isShelter ? shelterName.trim() : "",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-root min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="pt-float mb-2"><PawPrint size={44} color="var(--pine)" /></div>
      <h1 className="pt-display text-3xl mb-1" style={{ color: "var(--pine)" }}>Petinder</h1>
      <p className="pt-stamp text-xs mb-2" style={{ color: "var(--brick)" }}>a shelter kennel-card matchmaker</p>
      <p className="text-xs mb-8 text-center max-w-sm" style={{ color: "var(--ink)", opacity: 0.6 }}>
        Saved on this device. Add Firebase keys to .env for cloud sync across devices.
      </p>

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
            ? "Enter the username and passcode you saved on this device."
            : "Pick a username and passcode — adopters swipe, shelters publish pets."}
        </p>

        <label className="pt-stamp text-xs block mb-1">Username</label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. alex"
          className="w-full px-4 py-3 rounded-xl mb-3"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        <label className="pt-stamp text-xs block mb-1">Passcode</label>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="at least 4 characters"
          className="w-full px-4 py-3 rounded-xl mb-3"
          style={{ border: "2px solid var(--pine)", background: "var(--paper)" }}
        />

        {mode === "signup" && (
          <>
            <label className="pt-stamp text-xs block mb-1">Confirm passcode</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="repeat passcode"
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

function FirebaseAuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isShelter, setIsShelter] = useState(false);
  const [shelterName, setShelterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await saveUserData(cred.user.uid, {
          accountType: isShelter ? "shelter" : "adopter",
          shelterName: isShelter ? shelterName.trim() : "",
        });
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setError(friendlyAuthError(err.code));
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
            ? "Log in to sync matches, visits, and chats across devices."
            : "Adopters swipe pets. Shelters publish listings for everyone to see."}
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

export default function AuthScreen({ onLocalAuth }) {
  if (isFirebaseConfigured()) {
    return <FirebaseAuthScreen />;
  }
  return <LocalAuthScreen onAuthSuccess={onLocalAuth} />;
}
