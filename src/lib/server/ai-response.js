import "server-only";

// Map an AI-call failure to a client Response. A 429 (rate limit / depleted quota)
// is a temporary, user-actionable state — surface it as its own message and status
// so the UI can say "wait and retry" instead of a generic failure. Everything else
// is an unexpected server error (502).
export function aiErrorResponse(err, fallbackMessage) {
  const status = Number(err?.status ?? err?.code);
  if (status === 429) {
    return Response.json(
      {
        error:
          "The AI is rate-limited or out of quota right now. Please wait a minute and try again.",
      },
      { status: 429 },
    );
  }
  return Response.json({ error: fallbackMessage }, { status: 502 });
}
