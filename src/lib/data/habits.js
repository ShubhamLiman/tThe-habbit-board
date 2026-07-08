// Data-access layer for the Goal -> Habit -> Schedule -> Log model.
// All queries are RLS-scoped server-side (auth.uid() = user_id), so the
// client only ever sees the signed-in operative's rows.

import { supabase } from "../supabase";
import { getLocalDateString, getDayOfWeek, deriveDaysArray } from "./time";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// Re-export for convenience so callers can import it from the habits module too.
export { deriveDaysArray };

/**
 * Fetch every habit for the current user, bundled with its 7-day schedule,
 * its logs, and derived render helpers (today's variant, last log, etc.).
 */
export async function getHabitsBundle() {
  const [habitsRes, schedulesRes, logsRes] = await Promise.all([
    supabase.from("habits").select("*").order("created_at", { ascending: true }),
    supabase.from("habit_schedules").select("*"),
    supabase.from("habit_logs").select("*").order("log_date", { ascending: false }),
  ]);

  if (habitsRes.error) throw habitsRes.error;
  if (schedulesRes.error) throw schedulesRes.error;
  if (logsRes.error) throw logsRes.error;

  const todayStr = getLocalDateString();
  const todayDow = getDayOfWeek(todayStr);

  const schedulesByHabit = groupBy(schedulesRes.data ?? [], "habit_id");
  const logsByHabit = groupBy(logsRes.data ?? [], "habit_id");

  const habits = (habitsRes.data ?? []).map((habit) => {
    const schedules = (schedulesByHabit[habit.id] ?? []).sort(
      (a, b) => a.day_of_week - b.day_of_week,
    );
    const logs = logsByHabit[habit.id] ?? []; // already sorted desc by log_date
    const todaySchedule =
      schedules.find((s) => s.day_of_week === todayDow) ?? null;
    const todayLog = logs.find((l) => l.log_date === todayStr) ?? null;

    return {
      ...habit,
      schedules,
      logs,
      todaySchedule,
      isRestToday: !!todaySchedule?.is_rest_day,
      isExecutedToday: !!todayLog && todayLog.status === "completed",
      lastLogDate: logs[0]?.log_date ?? null,
      daysArray: deriveDaysArray(habit.target, habit.current_day_index),
    };
  });

  return habits;
}

/**
 * Create a habit plus a uniform 7-day schedule. Per-day variation (rest days,
 * different labels/sub-tasks) is supported by the schema and can be edited
 * later; Phase 1 seeds all weekdays identically to preserve current behavior.
 */
export async function createHabit({
  userId,
  name,
  isRoutine = false,
  isHardMode = false,
  goalId = null,
  subTasks = [],
  target = 21,
}) {
  const { data: habit, error } = await supabase
    .from("habits")
    .insert([
      {
        user_id: userId,
        goal_id: goalId,
        name,
        is_routine: isRoutine,
        is_hard_mode: isHardMode,
        target,
        current_streak: 0,
        current_day_index: 0,
        longest_streak: 0,
        achievements: [],
        start_date: getLocalDateString(),
        status: "active",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const scheduleRows = WEEKDAYS.map((dow) => ({
    user_id: userId,
    habit_id: habit.id,
    day_of_week: dow,
    variant_label: name,
    is_rest_day: false,
    sub_tasks: subTasks,
  }));

  const { data: schedules, error: schedErr } = await supabase
    .from("habit_schedules")
    .insert(scheduleRows)
    .select();

  if (schedErr) throw schedErr;

  return { ...habit, schedules: schedules ?? [] };
}

/** Update mutable habit fields (name, streak cache, achievements, status...). */
export async function updateHabit(habitId, patch) {
  const { error } = await supabase.from("habits").update(patch).eq("id", habitId);
  if (error) throw error;
}

/** Replace the sub-task checklist across all of a habit's schedule days (uniform habits). */
export async function updateHabitSubTasks(habitId, subTasks) {
  const { error } = await supabase
    .from("habit_schedules")
    .update({ sub_tasks: subTasks })
    .eq("habit_id", habitId);
  if (error) throw error;
}

/** Delete a habit (schedules + logs cascade via FK). */
export async function deleteHabit(habitId) {
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) throw error;
}

/**
 * Record a day's execution. Relies on the unique(habit_id, log_date) constraint
 * to enforce one execution per day at the database — not a client check.
 * Returns { duplicate: true } if the day was already logged.
 */
export async function logHabitExecution({
  userId,
  habitId,
  scheduleId = null,
  logDate = getLocalDateString(),
  status = "completed",
  completedSubTasks = [],
}) {
  const { data, error } = await supabase
    .from("habit_logs")
    .insert([
      {
        user_id: userId,
        habit_id: habitId,
        schedule_id: scheduleId,
        log_date: logDate,
        status,
        completed_sub_tasks: completedSubTasks,
        executed_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  // 23505 = unique_violation -> already executed today.
  if (error && error.code === "23505") return { duplicate: true, data: null };
  if (error) throw error;
  return { duplicate: false, data };
}

/** Bulk-insert audit-generated logs (rest / missed / shield_saved). Ignores dupes. */
export async function insertAuditLogs(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("habit_logs")
    .upsert(rows, { onConflict: "habit_id,log_date", ignoreDuplicates: true });
  if (error) throw error;
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    (acc[row[key]] ??= []).push(row);
    return acc;
  }, {});
}
