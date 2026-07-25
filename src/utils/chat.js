export function welcomeMessage(profile) {
  return {
    role: "assistant",
    content: `Hi ${profile?.name || "there"}! I'm PawPal — ask me about pet care, your matches, or which pets suit you best.`,
  };
}

export function createChatSession(profile, id) {
  const sessionId = id || (crypto.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  return {
    id: sessionId,
    title: "New chat",
    messages: [welcomeMessage(profile)],
    updatedAt: Date.now(),
  };
}

export function sessionTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim();
  return text.length > 36 ? `${text.slice(0, 36)}…` : text;
}

export function normalizeChatSessions(savedSessions, profile) {
  if (Array.isArray(savedSessions) && savedSessions.length > 0) {
    return savedSessions.map((s) => ({
      id: s.id,
      title: s.title || sessionTitle(s.messages || []),
      messages: s.messages?.length ? s.messages : [welcomeMessage(profile)],
      updatedAt: s.updatedAt || Date.now(),
    }));
  }
  return [createChatSession(profile)];
}
