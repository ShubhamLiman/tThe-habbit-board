import { Type } from "@google/genai";
import { DOMAIN_SLUGS } from "./domains";

// The exact JSON shape we force the classifier's answer into. Passed as Gemini's
// `responseSchema`, it constrains the model to exactly these fields and types, so
// downstream code can trust the result without defensive parsing.
export const CLASSIFIER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    domain: {
      type: Type.STRING,
      enum: DOMAIN_SLUGS, // taxonomy lives in domains.js — one source of truth
      description: "The single best top-level category for the user's goal.",
    },
    sub_domain: {
      type: Type.STRING,
      description:
        "Specific canonical slug within the domain, lowercase-hyphenated, " +
        "e.g. 'rust-programming', 'fat-loss', 'calculus-final-exam'.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "0-1: how confident the classification of `domain` is.",
    },
    multi_domain: {
      type: Type.BOOLEAN,
      description: "True if the goal genuinely spans more than one domain.",
    },
    sensitive: {
      type: Type.BOOLEAN,
      description:
        "True if the goal touches medical, mental-health, financial-risk, or " +
        "other sensitive territory that needs careful handling.",
    },
  },
  required: ["domain", "sub_domain", "confidence", "multi_domain", "sensitive"],
  propertyOrdering: [
    "domain", "sub_domain", "confidence", "multi_domain", "sensitive",
  ],
};

// How the UI should render each interview answer input. The planner reads the
// answer text regardless; `type` only shapes the onboarding form.
export const QUESTION_TYPES = ["text", "single_select", "multi_select", "number", "date"];

// The onboarding interview: a short list of tailored questions whose answers
// give the planner everything it needs to build a personalized plan. Passed as
// Gemini's `responseSchema` so the model returns exactly this shape.
export const INTERVIEW_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "4-6 onboarding questions, ordered as they should be asked.",
      items: {
        type: Type.OBJECT,
        properties: {
          key: {
            type: Type.STRING,
            description:
              "Stable snake_case slug for the dimension this question captures " +
              "(e.g. 'success_criteria', 'capacity', 'starting_point', " +
              "'constraints', 'deadline'). Becomes the key in goals.source_metadata.",
          },
          question: {
            type: Type.STRING,
            description: "The question text shown to the user. One idea, plain language.",
          },
          type: {
            type: Type.STRING,
            enum: QUESTION_TYPES,
            description: "Which input control the UI should render for the answer.",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "3-5 choices for single_select / multi_select questions. " +
              "Empty for other types.",
          },
          placeholder: {
            type: Type.STRING,
            description: "Short example answer for text / number inputs. May be empty.",
          },
        },
        required: ["key", "question", "type"],
        propertyOrdering: ["key", "question", "type", "options", "placeholder"],
      },
    },
  },
  required: ["questions"],
  propertyOrdering: ["questions"],
};
