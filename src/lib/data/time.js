// Local-timezone date helpers shared across the app (and, later, the worker service).
// A "day" is the operative's local calendar day, keyed as an ISO 'YYYY-MM-DD' string.

/** Today (or a given Date) as a local 'YYYY-MM-DD' string. */
export function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
}

/** Day of week for a 'YYYY-MM-DD' string. 0 = Sunday .. 6 = Saturday (matches habit_schedules). */
export function getDayOfWeek(dateStr) {
  // Parse as local midnight to avoid UTC drift.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Add `n` days to a 'YYYY-MM-DD' string, returning a new 'YYYY-MM-DD' string. */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return getLocalDateString(dt);
}

/** Whole days from `fromStr` to `toStr` (positive if toStr is later). */
export function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * Derive the escalating day-matrix (for the card visual) from streak position,
 * since habit_logs starts empty on a fresh project. Pure — no DB dependency.
 * index < currentDayIndex => "completed", otherwise "pending".
 */
export function deriveDaysArray(target, currentDayIndex) {
  return Array.from({ length: target }, (_, i) =>
    i < currentDayIndex ? "completed" : "pending",
  );
}
