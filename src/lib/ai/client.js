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
  planner: "gemini-pro-latest",   // higher quality: KB enrichment + plan generation
};
