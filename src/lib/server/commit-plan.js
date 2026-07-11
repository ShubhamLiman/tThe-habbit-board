import "server-only";
import { supabaseAdmin } from "./supabase";
import { MODELS } from "@/lib/ai/client";
import { DOMAIN_SLUGS } from "@/lib/ai/domains";

// Persist an AI-generated plan as goal -> habits -> habit_schedules rows.
//
// Runs server-side with the admin client so all of a plan's inserts (up to ~28
// rows across 3 FK-linked tables) happen in one request. RLS is bypassed, so we
// stamp user_id from the AUTHENTICATED caller on every row — the dashboard's
// per-user reads then see exactly these rows and nothing leaks across users.

const DEFAULT_TARGET = 21; // legacy habits.target: the card's day-grid still reads
// it; a soft AI goal has no fixed streak target, so this is just a placeholder
// until the milestones layer replaces the streak-target mechanic.

export async function commitPlan({ userId, plan, classification, answers }) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  // 1) The goal — carries the AI provenance the manual createGoal() never did.
  const source_metadata = {
    ai_generated_via: "coach",
    planner_model: MODELS.planner,
    classification: classification ?? null,
    interview: normalizeAnswers(answers), // the raw signal, kept for later re-plans
    rationale: plan.goal.rationale ?? "",
  };

  const { data: goal, error: goalErr } = await supabaseAdmin
    .from("goals")
    .insert([
      {
        user_id: userId,
        title: plan.goal.title,
        description: plan.goal.description ?? null,
        category: plan.goal.category,
        target_date: plan.goal.target_date ?? null, // null = open-ended
        target_streak: null, // AI goals drive off the plan, not a fixed streak
        ai_generated: true,
        source_metadata,
        status: "active",
      },
    ])
    .select()
    .single();
  if (goalErr) throw goalErr;

  // 2) Habits + their weekly schedules. If any insert fails partway, best-effort
  //    clean up so we never strand an orphan goal / half-written plan.
  const createdHabitIds = [];
  try {
    const scheduleRows = [];
    for (const h of plan.habits) {
      const { data: habit, error: habitErr } = await supabaseAdmin
        .from("habits")
        .insert([
          {
            user_id: userId,
            goal_id: goal.id,
            name: h.name,
            is_routine: !!h.is_routine,
            target: DEFAULT_TARGET,
            start_date: today,
            status: "active",
          },
        ])
        .select()
        .single();
      if (habitErr) throw habitErr;
      createdHabitIds.push(habit.id);

      for (const s of h.schedules) {
        scheduleRows.push({
          user_id: userId,
          habit_id: habit.id,
          day_of_week: s.day_of_week,
          variant_label: s.variant_label,
          is_rest_day: !!s.is_rest_day,
          sub_tasks: normalizeSubTasks(s.sub_tasks), // -> [{id,name,completedToday}]
          target_metric: s.target_metric ?? null,
        });
      }
    }

    if (scheduleRows.length) {
      const { error: schedErr } = await supabaseAdmin
        .from("habit_schedules")
        .insert(scheduleRows);
      if (schedErr) throw schedErr;
    }

    return {
      goalId: goal.id,
      habitCount: createdHabitIds.length,
      scheduleCount: scheduleRows.length,
    };
  } catch (err) {
    await cleanup(goal.id, createdHabitIds);
    throw err;
  }
}

// Deleting the habits cascades their schedules (FK on delete cascade); then the
// goal. Swallow cleanup errors so the original failure is what surfaces.
async function cleanup(goalId, habitIds) {
  try {
    if (habitIds.length) {
      await supabaseAdmin.from("habits").delete().in("id", habitIds);
    }
  } catch {}
  try {
    await supabaseAdmin.from("goals").delete().eq("id", goalId);
  } catch {}
}

// The card renders sub-tasks as {id, name, completedToday}; the plan emits {name}.
function normalizeSubTasks(subTasks) {
  if (!Array.isArray(subTasks)) return [];
  return subTasks
    .filter((t) => t && typeof t.name === "string")
    .map((t, i) => ({ id: i, name: t.name, completedToday: false }));
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers
    .filter((a) => a && typeof a.key === "string")
    .map((a) => ({
      key: a.key,
      question: typeof a.question === "string" ? a.question : "",
      answer: Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer ?? ""),
    }));
}

// Validate the plan the client posts back (the normalized /api/plan output).
// We stamp the caller's own user_id, so a bad plan can only corrupt their own
// rows — but we still guard the shape so no malformed row reaches the DB.
export function isCommittablePlan(plan) {
  if (!plan || typeof plan.goal !== "object" || !Array.isArray(plan.habits)) return false;
  const g = plan.goal;
  const goalOk =
    typeof g.title === "string" &&
    g.title.trim() !== "" &&
    typeof g.category === "string" &&
    DOMAIN_SLUGS.includes(g.category) &&
    (g.target_date === null || typeof g.target_date === "string");
  if (!goalOk) return false;
  return plan.habits.length > 0 && plan.habits.every(isCommittableHabit);
}

function isCommittableHabit(h) {
  if (!h || typeof h.name !== "string" || h.name.trim() === "") return false;
  if (!Array.isArray(h.schedules) || h.schedules.length === 0) return false;
  const days = new Set();
  for (const s of h.schedules) {
    if (
      !s ||
      !Number.isInteger(s.day_of_week) ||
      s.day_of_week < 0 ||
      s.day_of_week > 6 ||
      typeof s.variant_label !== "string" ||
      days.has(s.day_of_week) // one row per weekday (DB unique constraint)
    ) {
      return false;
    }
    days.add(s.day_of_week);
  }
  return true;
}
