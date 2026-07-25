/**
 * Local account storage (browser / Electron on this device).
 * Used when Firebase is not configured in .env.
 */

const PREFIX = "petinder-account:";
const SESSION_KEY = "petinder-session";

export function accountKey(username) {
  return `${PREFIX}${username.trim().toLowerCase()}`;
}

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export async function loadAccount(username) {
  try {
    const raw = localStorage.getItem(accountKey(username));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAccount(username, record) {
  try {
    localStorage.setItem(accountKey(username), JSON.stringify(record));
    return true;
  } catch (e) {
    console.error("Petinder save failed:", e);
    return false;
  }
}

export async function deleteAccount(username) {
  try {
    localStorage.removeItem(accountKey(username));
  } catch (e) {
    console.error("Petinder delete failed:", e);
  }
}

export function saveSession(username) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: username.trim() }));
  } catch (e) {
    console.error("Petinder session save failed:", e);
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error("Petinder session clear failed:", e);
  }
}
