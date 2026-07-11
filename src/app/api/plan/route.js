import { getUserFromRequest } from "@/lib/server/auth";
import { classifyGoal, isValidClassification } from "@/lib/ai/classify";
import { generatePlan } from "@/lib/ai/plan";
import { aiErrorResponse } from "@/lib/server/ai-response";

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
    // 3. Reuse a valid client-passed classification, else classify here so this
    //    endpoint works standalone in one call.
    const classification = isValidClassification(body?.classification)
      ? body.classification
      : await classifyGoal(goal);

    // 4. Generate the plan from the goal + interview answers. This step only
    //    GENERATES and returns the plan; persistence is a separate step.
    const plan = await generatePlan({ goal, classification, answers: body?.answers });
    return Response.json({ classification, plan });
  } catch (err) {
    console.error("[/api/plan] plan generation failed:", err);
    return aiErrorResponse(err, "Plan generation failed");
  }
}
