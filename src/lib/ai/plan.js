import "server-only";
import { MODELS } from "./client";
import { generateStructured } from "./generate";
import { PLAN_SCHEMA, METRIC_TYPES } from "./schemas";
import { PLANNER_PROMPT } from "./prompts";
import { DOMAIN_SLUGS } from "./domains";

// Generate the starting plan for a goal from the interview answers.
// Uses the higher-quality planner model (this is the expensive, load-bearing call).
// Returns { goal: {...}, habits: [{ name, is_routine, schedules: [...] }] } — a shape
// that maps directly onto the goals / habits / habit_schedules tables at persist time.
export async function generatePlan({ goal, classification, answers = [] }) {
  const trimmed = (goal || "").trim();
  if (!trimmed) throw new Error("generatePlan: empty goal");

  const contents = JSON.stringify({
    goal: trimmed,
    domain: classification?.domain ?? null,
    sub_domain: classification?.sub_domain ?? null,
    sensitive: classification?.sensitive ?? false,
    answers: normalizeAnswers(answers),
  });

  const plan = await generateStructured({
    model: MODELS.planner, // Gemini Pro: quality matters here
    contents,
    systemInstruction: PLANNER_PROMPT,
    schema: PLAN_SCHEMA,
    validate: isValidPlan,
  });

  return normalizePlan(plan);
}

// Accept answers either as an array of {key, question, answer} or as a plain
// {key: answer} map, and hand the model a clean array either way.
function normalizeAnswers(answers) {
  if (Array.isArray(answers)) {
    return answers
      .filter((a) => a && typeof a.key === "string")
      .map((a) => ({
        key: a.key,
        question: typeof a.question === "string" ? a.question : "",
        answer: stringifyAnswer(a.answer),
      }));
  }
  if (answers && typeof answers === "object") {
    return Object.entries(answers).map(([key, answer]) => ({
      key,
      question: "",
      answer: stringifyAnswer(answer),
    }));
  }
  return [];
}

function stringifyAnswer(answer) {
  if (Array.isArray(answer)) return answer.join(", "); // multi_select
  if (answer == null) return "";
  return String(answer);
}

function isValidPlan(o) {
  if (!o || typeof o.goal !== "object" || !Array.isArray(o.habits)) return false;
  const g = o.goal;
  const goalOk =
    typeof g.title === "string" &&
    g.title.trim() !== "" &&
    typeof g.description === "string" &&
    typeof g.category === "string" &&
    DOMAIN_SLUGS.includes(g.category) &&
    typeof g.target_date === "string" &&
    typeof g.rationale === "string";
  if (!goalOk) return false;
  return o.habits.length > 0 && o.habits.every(isValidHabit);
}

function isValidHabit(h) {
  if (
    !h ||
    typeof h.name !== "string" ||
    h.name.trim() === "" ||
    typeof h.is_routine !== "boolean" ||
    !Array.isArray(h.schedules) ||
    h.schedules.length === 0
  ) {
    return false;
  }
  const days = new Set();
  for (const s of h.schedules) {
    if (!isValidSchedule(s) || days.has(s.day_of_week)) return false; // no dup weekday
    days.add(s.day_of_week);
  }
  return true;
}

function isValidSchedule(s) {
  return (
    !!s &&
    Number.isInteger(s.day_of_week) &&
    s.day_of_week >= 0 &&
    s.day_of_week <= 6 &&
    typeof s.variant_label === "string" &&
    typeof s.is_rest_day === "boolean"
  );
}

// Shape the validated plan into predictable, persistence-ready values: an empty
// deadline becomes null, and the optional per-day fields always exist.
function normalizePlan(plan) {
  const target = plan.goal.target_date?.trim();
  return {
    goal: {
      title: plan.goal.title,
      description: plan.goal.description ?? "",
      category: plan.goal.category,
      target_date: target ? target : null,
      rationale: plan.goal.rationale ?? "",
    },
    habits: plan.habits.map((h) => ({
      name: h.name,
      is_routine: h.is_routine,
      schedules: h.schedules
        .slice()
        .sort((a, b) => a.day_of_week - b.day_of_week)
        .map(normalizeSchedule),
    })),
  };
}

function normalizeSchedule(s) {
  return {
    day_of_week: s.day_of_week,
    variant_label: s.variant_label,
    is_rest_day: s.is_rest_day,
    sub_tasks: Array.isArray(s.sub_tasks)
      ? s.sub_tasks.filter((t) => t && typeof t.name === "string")
      : [],
    target_metric: normalizeMetric(s.target_metric),
  };
}

// Drop empty/placeholder metrics down to null so downstream code has one "no metric"
// signal instead of several ({}, {type:"none"}, unknown type).
function normalizeMetric(m) {
  if (!m || typeof m.type !== "string" || !METRIC_TYPES.includes(m.type)) return null;
  if (m.type === "none") return null;
  const out = { type: m.type };
  if (typeof m.value === "number") out.value = m.value;
  if (typeof m.unit === "string" && m.unit.trim() !== "") out.unit = m.unit;
  return out;
}
