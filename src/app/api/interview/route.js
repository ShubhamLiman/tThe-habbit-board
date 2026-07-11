import { getUserFromRequest } from "@/lib/server/auth";
import { classifyGoal, isValidClassification } from "@/lib/ai/classify";
import { generateInterview } from "@/lib/ai/interview";

// Node.js runtime: uses the Gemini SDK + service-role Supabase client (see /classify).
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

  try {
    // 3. Use the client's classification if it passed a valid one (it already
    //    called /api/classify), otherwise classify here so this endpoint works
    //    standalone in one call.
    const classification = isValidClassification(body?.classification)
      ? body.classification
      : await classifyGoal(goal);

    // 4. Generate the interview and return it alongside the classification used.
    const { questions } = await generateInterview({ goal, classification });
    return Response.json({ classification, questions });
  } catch (err) {
    console.error("[/api/interview] interview generation failed:", err);
    return Response.json({ error: "Interview generation failed" }, { status: 502 });
  }
}
