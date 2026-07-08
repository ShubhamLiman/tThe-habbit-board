// Midnight audit — pure logic (no DB), so it's easy to reason about and test.
//
// For each habit it scans the fully-elapsed days since the last log (any
// status) up to yesterday, ignoring scheduled REST days, and penalizes the
// non-rest days that have no completed log:
//   - hard mode        -> instant reset (streak 0)
//   - standard + shield -> shield absorbs the miss (streak survives)
//   - standard, no shield -> streak resets
//
// It emits log rows (rest / missed / shield_saved) for every scanned day so
// the baseline advances and a later run never re-penalizes the same gap.

import { addDays, daysBetween, getDayOfWeek } from "./time";

/**
 * @returns { missed, didReset, shieldsUsed, newLogs, patch }
 *   newLogs: rows to insert into habit_logs
 *   patch:   habit field updates (or null if unchanged)
 */
export function computeHabitAudit(habit, todayStr, shieldsAvailable) {
  const schedByDow = {};
  for (const s of habit.schedules ?? []) schedByDow[s.day_of_week] = s;

  const baseline = habit.lastLogDate ?? habit.start_date;
  const noop = { missed: 0, didReset: false, shieldsUsed: 0, newLogs: [], patch: null };
  if (!baseline) return noop;

  const scanStart = addDays(baseline, 1);
  const scanEnd = addDays(todayStr, -1); // yesterday — today is still executable
  if (daysBetween(scanStart, scanEnd) < 0) return noop;

  const restDates = [];
  const missedDates = [];
  for (let d = scanStart; daysBetween(d, scanEnd) >= 0; d = addDays(d, 1)) {
    const sched = schedByDow[getDayOfWeek(d)];
    if (sched?.is_rest_day) {
      restDates.push({ date: d, scheduleId: sched.id });
    } else {
      missedDates.push({ date: d, scheduleId: sched?.id ?? null });
    }
  }

  const restLogs = restDates.map((r) => logRow(habit.id, r, "rest"));
  const missed = missedDates.length;

  if (missed === 0) {
    // Only rest days elapsed — nothing to penalize, but advance the baseline.
    return { missed: 0, didReset: false, shieldsUsed: 0, newLogs: restLogs, patch: null };
  }

  let didReset;
  let shieldsUsed;
  let missedLogs;

  if (habit.is_hard_mode) {
    didReset = true;
    shieldsUsed = 0;
    missedLogs = missedDates.map((m) => logRow(habit.id, m, "missed"));
  } else if (shieldsAvailable - missed < 0) {
    // Shields breached: absorb what we can, the rest are true misses, streak resets.
    didReset = true;
    shieldsUsed = shieldsAvailable;
    missedLogs = missedDates.map((m, i) =>
      logRow(habit.id, m, i < shieldsAvailable ? "shield_saved" : "missed"),
    );
  } else {
    // Shields hold: streak survives.
    didReset = false;
    shieldsUsed = missed;
    missedLogs = missedDates.map((m) => logRow(habit.id, m, "shield_saved"));
  }

  return {
    missed,
    didReset,
    shieldsUsed,
    newLogs: [...restLogs, ...missedLogs],
    patch: didReset ? { current_streak: 0, current_day_index: 0 } : null,
  };
}

/**
 * Run the audit across all habits, sharing the global shield pool sequentially
 * (same as the original dashboard logic).
 * @returns { perHabit: [{ habitId, patch, newLogs }], endingShields, changed }
 */
export function runAudit(habits, todayStr, startingShields) {
  let shields = startingShields;
  const perHabit = [];
  let changed = false;

  for (const habit of habits) {
    const result = computeHabitAudit(habit, todayStr, shields);
    shields -= result.shieldsUsed;
    if (result.newLogs.length || result.patch) {
      changed = true;
      perHabit.push({ habitId: habit.id, patch: result.patch, newLogs: result.newLogs });
    }
  }

  return { perHabit, endingShields: shields, changed };
}

function logRow(habitId, { date, scheduleId }, status) {
  return {
    habit_id: habitId,
    schedule_id: scheduleId,
    log_date: date,
    status,
  };
}
