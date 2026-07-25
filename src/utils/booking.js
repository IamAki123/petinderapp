export function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function officeTimeSlots() {
  const slots = [];
  for (let hour = 9; hour <= 17; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 17 && minute > 0) break;
      slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return slots;
}

export function formatTime12(time24) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function isPastDate(dateStr) {
  return dateStr < todayLocalISO();
}

export function isTimeAvailable(dateStr, timeStr) {
  if (!dateStr || !timeStr) return false;
  if (isPastDate(dateStr)) return false;

  const slots = officeTimeSlots();
  if (!slots.includes(timeStr)) return false;

  if (dateStr === todayLocalISO()) {
    const [h, m] = timeStr.split(":").map(Number);
    const slot = new Date();
    slot.setHours(h, m, 0, 0);
    return slot.getTime() > Date.now();
  }

  return true;
}

export function availableTimeSlots(dateStr) {
  if (!dateStr || isPastDate(dateStr)) return [];
  const all = officeTimeSlots();
  if (dateStr !== todayLocalISO()) return all;

  const now = new Date();
  return all.filter((timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const slot = new Date(now);
    slot.setHours(h, m, 0, 0);
    return slot.getTime() > now.getTime();
  });
}
