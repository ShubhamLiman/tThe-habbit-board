// The coarse routing taxonomy — single source of truth for BOTH the classifier
// schema (enum) and the classifier prompt, so the two can never drift apart.
//
// A goal that fits none of these classifies as `other` (with a truthful sub_domain),
// which works fully via the generic path — `other` acts as a discovery queue, not a
// dead end. When a cluster of `other` sub_domains deserves specialized handling,
// promote it to its own domain.
//
// LATER: swap this constant for a cached fetch from a `goal_domains` Supabase table
// to make the taxonomy editable (and promotable) without a code deploy. Callers won't change.
export const DOMAINS = [
  { slug: "fitness",   description: "Physical training & performance" },
  { slug: "learning",  description: "Acquiring a skill or body of knowledge" },
  { slug: "exam-prep", description: "Deadline-driven study for a specific test" },
  { slug: "career",    description: "Job, professional growth, business" },
  { slug: "creative",  description: "Art, writing, music, making things" },
  { slug: "finance",   description: "Saving, budgeting, investing" },
  { slug: "health",    description: "Medical, sleep, mental health, habits like quitting" },
  { slug: "other",     description: "Anything that doesn't fit the above" },
];

export const DOMAIN_SLUGS = DOMAINS.map((d) => d.slug);
