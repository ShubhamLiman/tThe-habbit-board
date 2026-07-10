import "server-only";
import { supabaseAdmin } from "./supabase";

// Verify the caller's Supabase login from the request's Authorization header.
//
// The browser already holds a logged-in Supabase session. When it calls our
// API, it sends that session's access token as:  Authorization: Bearer <token>
// We hand that token to Supabase, which checks the signature + expiry and tells
// us who it belongs to.
//
// Returns the authenticated user object, or null if the token is missing/invalid.
export async function getUserFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
