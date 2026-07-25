import dotenv from "dotenv";
import { fetchNearbyShelters } from "./shelters.js";

dotenv.config();

function buildSystemPrompt(context = {}) {
  const { profile, matches, topPreferences, petsAvailable } = context;
  const lines = [
    "You are Petinder PawPal, a warm and practical pet adoption assistant for the Petinder shelter app.",
    "Help users with pet care basics (feeding, exercise, grooming, vet visits, introducing pets to kids or other animals).",
    "When asked about best pet matches, use their onboarding profile, swipe preferences, and current matches.",
    "Keep answers concise (2-4 short paragraphs max), friendly, and specific. Never make up pets not in their data.",
  ];

  if (profile) lines.push(`User profile: ${JSON.stringify(profile)}`);
  if (topPreferences?.length) {
    lines.push(`Learned swipe preferences (higher = liked more): ${topPreferences.map(([k, v]) => `${k}:${v}`).join(", ")}`);
  }
  if (matches?.length) {
    lines.push(`Current matches: ${matches.map((p) => `${p.name} (${p.species}, ${p.breed}, ${p.temperament?.join(", ")})`).join("; ")}`);
  }
  if (petsAvailable?.length) {
    lines.push(`Pets still in their swipe queue (top picks): ${petsAvailable.slice(0, 5).map((p) => `${p.name} (${p.species}, ${p.breed})`).join("; ")}`);
  }

  return lines.join("\n");
}

export function getHealthPayload() {
  return { ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY) };
}

export async function getNearbySheltersPayload(lat, lng, radius = 50) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 400, body: { error: "lat and lng query parameters are required" } };
  }

  try {
    const shelters = await fetchNearbyShelters(lat, lng, radius);
    return { status: 200, body: { shelters } };
  } catch (err) {
    console.error("Shelter lookup error:", err);
    return { status: 502, body: { error: "Failed to look up nearby shelters" } };
  }
}

export async function postChatPayload(body = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env" } };
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: "messages array required" } };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 600,
        messages: [
          { role: "system", content: buildSystemPrompt(context) },
          ...messages.filter((m) => m.role === "user" || m.role === "assistant"),
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        status: response.status,
        body: { error: data?.error?.message || "OpenAI request failed" },
      };
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { status: 502, body: { error: "Empty response from OpenAI" } };
    }

    return { status: 200, body: { reply } };
  } catch (err) {
    console.error("Chat API error:", err);
    return { status: 500, body: { error: "Failed to reach OpenAI" } };
  }
}
