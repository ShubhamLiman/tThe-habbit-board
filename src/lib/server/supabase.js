import "server-only";
import { createClient } from "@supabase/supabase-js";

// Trusted, SERVER-ONLY Supabase client, built with the SECRET key.
// This client BYPASSES row-level security (god-mode), so it must never be
// imported into a client component — the `server-only` import above makes the
// build fail if it ever is. Use it only for shared-KB writes and admin work.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
