import { getUserFromRequest } from "@/lib/server/auth";
import { classifyGoal } from "@/lib/ai/classify";
import { aiErrorResponse } from "@/lib/server/ai-response";

// Runs on the Node.js runtime (not Edge): our server-only modules use the Gemini
// SDK and the service-role Supabase client, both of which need Node.
export const runtime = "nodejs";

export async function POST(req) {
  // 1. Authenticate the caller from their Supabase Bearer token.
  const user = await getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Read + validate the request body.
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const goal = body?.goal;
  if (typeof goal !== "string" || !goal.trim()) {
    return Response.json({ error: "Missing 'goal' string" }, { status: 400 });
  }

  // 3. Classify and return the result.
  try {
    const result = await classifyGoal(goal);
    return Response.json(result);
  } catch (err) {
    console.error("[/api/classify] classification failed:", err);
    return aiErrorResponse(err, "Classification failed");
  }
}
