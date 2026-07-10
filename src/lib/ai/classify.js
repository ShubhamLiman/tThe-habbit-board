import "server-only";
import { ai, MODELS } from "./client";
import { CLASSIFIER_SCHEMA } from "./schemas";
import { CLASSIFIER_PROMPT } from "./prompts";
import { DOMAIN_SLUGS } from "./domains";

// Transient Gemini failures worth retrying: overloaded (503), rate-limited (429),
// or a server blip (500). Anything else (bad key, bad schema) should fail fast.
const TRANSIENT = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 4;

// Classify a user's goal into the routing taxonomy.
// Returns { domain, sub_domain, confidence, multi_domain, sensitive }.
export async function classifyGoal(goalText) {
  const trimmed = (goalText || "").trim();
  if (!trimmed) throw new Error("classifyGoal: empty goal");

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const parsed = await callModel(trimmed);
      if (parsed && isValid(parsed)) return parsed;
      // Reached the model but got junk back — retry (counts against the cap).
      lastErr = new Error("classifyGoal: model returned invalid output");
    } catch (err) {
      if (!isTransient(err)) throw err; // real, non-retryable error
      lastErr = err;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
  }
  throw lastErr;
}

async function callModel(goalText) {
  const response = await ai.models.generateContent({
    model: MODELS.classifier,
    contents: goalText,                     // the thing to classify
    config: {
      systemInstruction: CLASSIFIER_PROMPT, // the standing rules
      responseMimeType: "application/json", // force JSON
      responseSchema: CLASSIFIER_SCHEMA,    // constrain the shape
      temperature: 0,                       // deterministic
    },
  });
  return safeParse(response.text);
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

// Trust nothing: verify shape AND that `domain` is a real taxonomy value.
function isValid(o) {
  return (
    o &&
    typeof o.domain === "string" &&
    DOMAIN_SLUGS.includes(o.domain) &&
    typeof o.sub_domain === "string" &&
    typeof o.confidence === "number" &&
    typeof o.multi_domain === "boolean" &&
    typeof o.sensitive === "boolean"
  );
}
