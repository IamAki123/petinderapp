export async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Cannot reach the Petinder server. Run: npm run dev");
  }

  const text = await res.text();
  const trimmed = text.trimStart();

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error("Could not reach the Petinder API. Restart with: npm run dev");
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid server response (${res.status}). Is the backend running on port 3001?`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}
