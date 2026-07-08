// Data-access layer for goals (macro-objectives that own habits).
// Replaces the old active_operations concept.

import { supabase } from "../supabase";

/** Fetch every goal for the current user. */
export async function getGoals() {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Create a goal and attach existing habits to it.
 * (AI-generated goals in Phase 3 will also populate category / source_metadata.)
 */
export async function createGoal({ userId, title, targetStreak, habitIds = [] }) {
  const { data: goal, error } = await supabase
    .from("goals")
    .insert([
      {
        user_id: userId,
        title,
        target_streak: Number(targetStreak) || null,
        status: "active",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  if (habitIds.length > 0) {
    const { error: attachErr } = await supabase
      .from("habits")
      .update({ goal_id: goal.id })
      .in("id", habitIds);
    if (attachErr) throw attachErr;
  }

  return goal;
}
