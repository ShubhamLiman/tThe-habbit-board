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
