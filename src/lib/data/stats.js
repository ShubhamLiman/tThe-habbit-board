// Data-access for per-user stats (currently just the global shield pool).

import { supabase } from "../supabase";

/** Read the user's global shield count (0 if no row yet). */
export async function getGlobalShields(userId) {
  const { data, error } = await supabase
    .from("user_stats")
    .select("global_shields")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.global_shields ?? 0;
}

/**
 * Write the shield count. Upsert (not update) so a brand-new user with no
 * user_stats row doesn't silently fail — important on a fresh project.
 */
export async function setGlobalShields(userId, count) {
  const { error } = await supabase
    .from("user_stats")
    .upsert({ id: userId, global_shields: count });
  if (error) throw error;
}
