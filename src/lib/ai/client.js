import "server-only";
import { GoogleGenAI } from "@google/genai";

// One shared Gemini client for all server-side AI calls.
// Reads GEMINI_API_KEY from the environment (server-only secret, never NEXT_PUBLIC_).
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Every model ID the app uses lives here, so swapping a model is a one-line change.
// Verified against your live key: it is on the Gemini 3.x line (the 2.5 models
// 404 for this key), and free-tier per-minute quota is tight — so default to flash
// and reserve the Pro model for jobs that genuinely need the quality.
export const MODELS = {
  classifier: "gemini-3.5-flash", // cheap + fast: domain classification, interview questions
  // Ideally the Pro model (gemini-pro-latest → gemini-3.x-pro) for plan/enrichment
  // quality, but this key's FREE tier has a hard limit of 0 for Pro (429
  // RESOURCE_EXHAUSTED, limit: 0 — not a transient blip, so retries can't help).
  // Using Flash to prove the flow; swap back to "gemini-pro-latest" once billing
  // is enabled. One-line change, no caller touches.
  planner: "gemini-3.5-flash",
};
