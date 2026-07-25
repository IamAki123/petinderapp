import { Mail, Calendar, Clock, PawPrint } from "lucide-react";
import { formatTime12 } from "../utils/booking.js";
import { markMessageRead } from "../messages.js";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ShelterMessagesScreen({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="p-5 flex flex-col items-center justify-center h-full text-center">
        <Mail size={36} color="var(--pine)" className="mb-3 opacity-60" />
        <h2 className="pt-display text-xl mb-2" style={{ color: "var(--pine)" }}>Inbox</h2>
        <p className="text-sm max-w-xs" style={{ color: "var(--ink)", opacity: 0.7 }}>
          When someone books a visit for one of your listed pets, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full">
      <h2 className="pt-display text-xl mb-1" style={{ color: "var(--pine)" }}>Inbox</h2>
      <p className="text-xs mb-4" style={{ color: "var(--ink)", opacity: 0.65 }}>
        Appointment requests from adopters
      </p>

      <div className="flex flex-col gap-3">
        {messages.map((msg) => (
          <button
            key={msg.id}
            type="button"
            onClick={() => markMessageRead(msg.id).catch(console.error)}
            className="text-left pt-card-shadow rounded-2xl p-4 w-full"
            style={{
              background: msg.read ? "white" : "var(--paper-dark)",
              border: msg.read ? "2px solid transparent" : "2px solid var(--mustard)",
              cursor: "pointer",
            }}
          >
            <div className="flex items-start gap-2 mb-2">
              <PawPrint size={16} color="var(--pine)" className="shrink-0 mt-0.5" />
              <div>
                <p className="pt-display text-base" style={{ color: "var(--pine)" }}>
                  Visit booked for {msg.petName}
                </p>
                <p className="text-xs" style={{ opacity: 0.75 }}>
                  {msg.adopterName} wants to meet {msg.petName}
                  {msg.petSpecies ? ` (${msg.petSpecies})` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs pt-stamp" style={{ color: "var(--ink)" }}>
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {formatDate(msg.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {formatTime12(msg.time)}
              </span>
            </div>

            {msg.location && (
              <p className="text-xs mt-2" style={{ opacity: 0.7 }}>At {msg.location}</p>
            )}

            {!msg.read && (
              <span className="inline-block mt-2 pt-stamp text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--mustard)", color: "var(--pine)" }}>
                New
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
