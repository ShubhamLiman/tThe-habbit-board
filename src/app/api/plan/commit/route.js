import { getUserFromRequest } from "@/lib/server/auth";
import { commitPlan, isCommittablePlan } from "@/lib/server/commit-plan";

// Node.js runtime: uses the service-role Supabase admin client.
export const runtime = "nodejs";

export async function POST(req) {
  // 1. Authenticate the caller — their id is stamped on every written row.
  const user = await getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Read + validate the body. The client posts the plan it got from /api/plan
  //    (after the user confirmed it), plus the classification + interview answers
  //    so we can store the full provenance in goals.source_metadata.
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isCommittablePlan(body?.plan)) {
    return Response.json({ error: "Missing or invalid 'plan'" }, { status: 400 });
  }

  // 3. Persist goal -> habits -> schedules and report what was written.
  try {
    const result = await commitPlan({
      userId: user.id,
      plan: body.plan,
      classification: body.classification,
      answers: body.answers,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    console.error("[/api/plan/commit] commit failed:", err);
    return Response.json({ error: "Plan commit failed" }, { status: 502 });
  }
}
