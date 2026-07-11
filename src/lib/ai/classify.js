import "server-only";
import { MODELS } from "./client";
import { generateStructured } from "./generate";
import { CLASSIFIER_SCHEMA } from "./schemas";
import { CLASSIFIER_PROMPT } from "./prompts";
import { DOMAIN_SLUGS } from "./domains";

// Classify a user's goal into the routing taxonomy.
// Returns { domain, sub_domain, confidence, multi_domain, sensitive }.
export async function classifyGoal(goalText) {
  const trimmed = (goalText || "").trim();
  if (!trimmed) throw new Error("classifyGoal: empty goal");

  return generateStructured({
    model: MODELS.classifier,
    contents: trimmed, // the thing to classify
    systemInstruction: CLASSIFIER_PROMPT, // the standing rules
    schema: CLASSIFIER_SCHEMA,
    validate: isValidClassification,
  });
}

// Trust nothing: verify shape AND that `domain` is a real taxonomy value.
// Exported so the interview endpoint can reuse it to vet a client-passed result.
export function isValidClassification(o) {
  return (
    !!o &&
    typeof o.domain === "string" &&
    DOMAIN_SLUGS.includes(o.domain) &&
    typeof o.sub_domain === "string" &&
    typeof o.confidence === "number" &&
    typeof o.multi_domain === "boolean" &&
    typeof o.sensitive === "boolean"
  );
}
