import "server-only";

// Background-work boundary. Today it runs a task fire-and-forget, in-process. Later
// this SAME interface can be swapped for a durable queue (Supabase Edge Functions,
// Inngest, QStash, ...) without touching a single caller.
//
// NOTE: for work started inside a route handler that must outlive the HTTP response,
// wrap it in `after()` from "next/server" so the runtime doesn't kill it early:
//   import { after } from "next/server";
//   after(() => enqueue(() => enrichDomain(subDomain)));
export function enqueue(taskFn) {
  Promise.resolve()
    .then(taskFn)
    .catch((err) => console.error("[jobs] background task failed:", err));
}
