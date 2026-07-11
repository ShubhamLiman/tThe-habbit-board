import "server-only";
import { ai } from "./client";

// One place for every structured Gemini call. classify / interview / plan all
// route through here so the resilience logic — forced-JSON output, a transient
// retry loop, and a caller-supplied validator — lives in exactly one spot.

// Transient Gemini failures worth retrying: overloaded (503), rate-limited (429),
// or a server blip (500). Anything else (bad key, bad schema) should fail fast.
const TRANSIENT = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 4;

/**
 * Call Gemini for structured JSON and return the validated object.
 *
 * @param {object}   o
 * @param {string}   o.model             model id (from MODELS)
 * @param {*}        o.contents           the user content to send
 * @param {string}   o.systemInstruction  standing rules for the model
 * @param {object}   o.schema            responseSchema (constrains the shape)
 * @param {Function} o.validate          (parsed) => boolean — trust nothing guard
 * @param {number}  [o.temperature=0]    0 = deterministic
 * @returns the parsed, validated object
 * @throws  the last transient error, or immediately on a non-transient one
 */
export async function generateStructured({
  model,
  contents,
  systemInstruction,
  schema,
  validate,
  temperature = 0,
}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json", // force JSON
          responseSchema: schema, // constrain the shape
          temperature,
        },
      });
      const parsed = safeParse(response.text);
      if (parsed && validate(parsed)) return parsed;
      // Reached the model but got junk back — retry (counts against the cap).
      lastErr = new Error("generateStructured: model returned invalid output");
    } catch (err) {
      if (!isTransient(err)) throw err; // real, non-retryable error
      lastErr = err;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
  }
  throw lastErr;
}

function isTransient(err) {
  const status = Number(err?.status ?? err?.code);
  return TRANSIENT.has(status);
}

function backoffMs(attempt) {
  // Exponential 0.5s → 1s → 2s, capped at 4s, plus jitter so retries don't sync up.
  const base = Math.min(500 * 2 ** (attempt - 1), 4000);
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
