import "server-only";
import { MODELS } from "./client";
import { generateStructured } from "./generate";
import { INTERVIEW_SCHEMA, QUESTION_TYPES } from "./schemas";
import { INTERVIEW_PROMPT } from "./prompts";

const MAX_QUESTIONS = 6;

// Generate the onboarding interview for a goal.
// Runs right after classification (the questions are ~80% domain-general, so this
// need not wait on any KB lookup). Returns { questions: [{ key, question, type,
// options?, placeholder? }] } — the answers later feed the planner and land in
// goals.source_metadata.
export async function generateInterview({ goal, classification }) {
  const trimmed = (goal || "").trim();
  if (!trimmed) throw new Error("generateInterview: empty goal");

  // Hand the model the goal plus only the classification fields it needs to tailor.
  const contents = JSON.stringify({
    goal: trimmed,
    domain: classification?.domain ?? null,
    sub_domain: classification?.sub_domain ?? null,
    sensitive: classification?.sensitive ?? false,
  });

  const result = await generateStructured({
    model: MODELS.classifier, // cheap + fast is right for question generation
    contents,
    systemInstruction: INTERVIEW_PROMPT,
    schema: INTERVIEW_SCHEMA,
    validate: isValidInterview,
  });

  // Belt-and-suspenders: drop any malformed question and cap the count, so the UI
  // always gets a clean, bounded list even if the model over-produces.
  const questions = result.questions
    .filter(isValidQuestion)
    .slice(0, MAX_QUESTIONS)
    .map(normalizeQuestion);

  return { questions };
}

function isValidInterview(o) {
  return !!o && Array.isArray(o.questions) && o.questions.some(isValidQuestion);
}

function isValidQuestion(q) {
  return (
    !!q &&
    typeof q.key === "string" &&
    q.key.trim() !== "" &&
    typeof q.question === "string" &&
    q.question.trim() !== "" &&
    typeof q.type === "string" &&
    QUESTION_TYPES.includes(q.type)
  );
}

// Guarantee the optional fields exist in a predictable shape for the UI.
function normalizeQuestion(q) {
  const isSelect = q.type === "single_select" || q.type === "multi_select";
  return {
    key: q.key,
    question: q.question,
    type: q.type,
    options: isSelect && Array.isArray(q.options) ? q.options : [],
    placeholder: typeof q.placeholder === "string" ? q.placeholder : "",
  };
}
