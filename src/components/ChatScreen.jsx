import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Loader2, Sparkles, Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { createChatSession, sessionTitle, welcomeMessage } from "../utils/chat.js";
import { fetchJson } from "../utils/api.js";

const STARTERS = [
  "Which of my matches is the best fit for me?",
  "How do I prepare my home for a new pet?",
  "What should I ask at a shelter visit?",
];

export default function ChatScreen({
  profile,
  weights,
  matches,
  queue,
  sessions,
  activeChatId,
  onSessionsChange,
  onActiveChatChange,
}) {
  const activeSession = sessions.find((s) => s.id === activeChatId) || sessions[0];
  const messages = activeSession?.messages || [welcomeMessage(profile)];

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, activeChatId]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions]
  );

  const topPreferences = Object.entries(weights || {})
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const updateSession = (sessionId, updater) => {
    onSessionsChange(
      sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const next = typeof updater === "function" ? updater(s) : { ...s, ...updater };
        return {
          ...next,
          title: sessionTitle(next.messages),
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleNewChat = () => {
    const session = createChatSession(profile);
    onSessionsChange([session, ...sessions]);
    onActiveChatChange(session.id);
    setListOpen(false);
    setError("");
  };

  const handleDeleteChat = (sessionId, e) => {
    e?.stopPropagation();
    if (sessions.length === 1) {
      const fresh = createChatSession(profile);
      onSessionsChange([fresh]);
      onActiveChatChange(fresh.id);
      return;
    }
    const remaining = sessions.filter((s) => s.id !== sessionId);
    onSessionsChange(remaining);
    if (activeChatId === sessionId) {
      onActiveChatChange(remaining[0].id);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !activeSession) return;

    setError("");
    const userMsg = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    updateSession(activeSession.id, { messages: nextMessages });
    setInput("");
    setBusy(true);

    try {
      const data = await fetchJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          context: {
            profile,
            matches: matches.map(({ id, name, species, breed, age, temperament, energyLevel, size, bio }) => ({
              id, name, species, breed, age, temperament, energyLevel, size, bio,
            })),
            topPreferences,
            petsAvailable: queue.slice(0, 8).map(({ id, name, species, breed, temperament, energyLevel, size }) => ({
              id, name, species, breed, temperament, energyLevel, size,
            })),
          },
        }),
      });

      updateSession(activeSession.id, {
        messages: [...nextMessages, { role: "assistant", content: data.reply }],
      });
    } catch (err) {
      setError(err.message || "Could not reach PawPal. Is the server running?");
      updateSession(activeSession.id, { messages });
      setInput(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={20} color="var(--mustard)" className="shrink-0" />
            <div className="min-w-0">
              <h2 className="pt-display text-xl truncate" style={{ color: "var(--pine)" }}>PawPal AI</h2>
              <p className="text-[11px] truncate" style={{ color: "var(--ink)", opacity: 0.6 }}>
                {activeSession?.title || "Pet care & match advice"}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleNewChat}
              aria-label="New chat"
              className="p-2 rounded-lg"
              style={{ background: "var(--paper-dark)", border: "none", cursor: "pointer" }}
            >
              <Plus size={18} color="var(--pine)" />
            </button>
            <button
              onClick={() => setListOpen((o) => !o)}
              aria-label="Chat history"
              className="p-2 rounded-lg flex items-center"
              style={{ background: listOpen ? "var(--mustard)" : "var(--paper-dark)", border: "none", cursor: "pointer" }}
            >
              <MessageSquare size={18} color={listOpen ? "white" : "var(--pine)"} />
              <ChevronDown size={14} color={listOpen ? "white" : "var(--pine)"} />
            </button>
          </div>
        </div>

        {listOpen && (
          <div className="mt-2 rounded-xl pt-card-shadow overflow-hidden" style={{ background: "white", border: "1px solid var(--paper-dark)" }}>
            <div className="pt-scroll max-h-36 overflow-y-auto">
              {sortedSessions.map((s) => (
                <div
                  key={s.id}
                  className="w-full flex items-center gap-1 px-2 py-1"
                  style={{ background: s.id === activeChatId ? "var(--paper-dark)" : "transparent" }}
                >
                  <button
                    onClick={() => { onActiveChatChange(s.id); setListOpen(false); setError(""); }}
                    className="flex-1 flex items-center gap-2 px-1 py-1 text-left min-w-0"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <MessageSquare size={14} color="var(--pine)" className="shrink-0" />
                    <span className="text-xs truncate" style={{ color: "var(--ink)" }}>{s.title}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(s.id, e)}
                    aria-label={`Delete ${s.title}`}
                    className="p-1.5 rounded shrink-0"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Trash2 size={14} color="var(--brick)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-scroll flex-1 min-h-0 px-4 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${msg.role === "user" ? "self-end" : "self-start"}`}
            style={{
              background: msg.role === "user" ? "var(--pine)" : "white",
              color: msg.role === "user" ? "var(--paper)" : "var(--ink)",
              border: msg.role === "assistant" ? "1px solid var(--paper-dark)" : "none",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </div>
        ))}
        {busy && (
          <div className="self-start flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: "white", border: "1px solid var(--paper-dark)" }}>
            <Loader2 size={16} color="var(--pine)" className="animate-spin" />
            <span className="text-xs" style={{ color: "var(--ink)", opacity: 0.7 }}>PawPal is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && !busy && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="pt-stamp text-[10px] px-2.5 py-1.5 rounded-full"
              style={{ border: "1px solid var(--pine)", color: "var(--pine)", background: "var(--paper)", cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="px-4 text-xs shrink-0" style={{ color: "var(--brick)" }}>{error}</p>
      )}

      <div className="p-3 shrink-0 flex gap-2" style={{ borderTop: "2px solid var(--paper-dark)", background: "var(--paper)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Ask about care or your best match…"
          disabled={busy}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm"
          style={{ border: "2px solid var(--pine)", background: "white" }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={busy || !input.trim()}
          aria-label="Send message"
          className="rounded-xl px-3 flex items-center justify-center"
          style={{
            background: input.trim() && !busy ? "var(--pine)" : "var(--clip)",
            border: "none",
            cursor: input.trim() && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? <Loader2 size={18} color="white" className="animate-spin" /> : <Send size={18} color="white" />}
        </button>
      </div>
    </div>
  );
}
