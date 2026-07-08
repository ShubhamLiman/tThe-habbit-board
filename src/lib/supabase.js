import { createClient } from "@supabase/supabase-js";

// 1. Pull the keys from your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Initialize the Supabase connection
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
