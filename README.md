# The Habit Board

**An AI-driven, domain-agnostic goal-achievement engine.**

Not a habit tracker. Not a fitness app. You bring a goal — *pass an exam, learn Rust,
get fit, ship a side project* — and The Habit Board's AI builds you a personalized
roadmap of milestones and daily habits, then **continuously adapts it** to your real
progress and state. The intelligence understands how you're doing and steers the app's
behavior toward *your* benefit.

> Complexity lives in the AI. Simplicity stays in the UI.

---

## The core loop

```
State a goal (one sentence)
        │
        ▼
AI interviews you  ──►  builds a milestone roadmap  ──►  suggests adaptive daily habits
        ▲                                                          │
        │                                                          ▼
   AI adapts  ◄──  evaluates your day  ◄──  you log it in seconds ─┘
```

1. **State a goal** — as loose as *"get good at chess."* The AI turns fuzzy intent into a structured goal.
2. **AI interviews you** — just enough questions to understand your intent, resources, current level, and deadline.
3. **AI builds a roadmap** — an ordered spine of milestones, backward-planned from your deadline.
4. **AI suggests adaptive habits** — the daily activities that move you through each milestone.
5. **You log your day** — a near-zero-typing end-of-day form (numbers, yes/no, one effort tap).
6. **AI evaluates & adapts** — spots when you're cruising (offers to level up) or struggling (diagnoses why and reshapes the plan). Repeat.

---

## Principles

- **Domain-agnostic** — fitness, learning, exam prep, creative projects. The model never hard-codes one domain.
- **Adaptive, not rigid** — no "21 days of the same thing." Habits scale harder or easier with your progress; the AI sets the horizon, not a fixed rule.
- **Supportive, not punitive** — the AI owns consequences. Rest days *pause* your streak instead of shattering it, and it always tells you *why*.
- **Ask-first to increase, autonomous to lighten** — the AI grants rest and forgiveness on its own, but *proposes* (never forces) anything that asks more of you.
- **Transparent** — every adaptation comes with the AI's reasoning, so it feels like a coach, not a black box.

---

## Features

### 🤖 AI features
- **Goal structuring** — turns a one-sentence intent into a structured, actionable goal.
- **Adaptive onboarding interview** — the right few questions, branching by domain.
- **Milestone roadmap generation** — ordered milestones with target dates, planned back from your deadline.
- **Adaptive habit generation** — proposes the daily engine, then tunes difficulty from your logs.
- **Daily-log evaluation** — reads your day and judges *on-track* vs *struggling*.
- **Rest days & contextual forgiveness** — personalized from your logs, each with a stated reason.
- **Struggle diagnosis → plan adaptation** — on a bad streak, probes the cause and reshapes habits/milestones via a reason→remedy map.
- **Fatigue-aware coaching notifications** — speaks only at real inflection points, not constant pings.
- **Outcome verification** — in learning/exam domains, can *verify* (quiz you, check a repo) instead of trusting a checkbox.
- **Self-correcting knowledge base (RAG)** — autonomously gathers and sanitizes authoritative domain content so roadmaps aren't hallucinated.

### 🔗 Hybrid features (AI + system + you)
- **Adaptive habits** — AI suggests → you execute → system tracks.
- **Milestone roadmap** — AI creates → system tracks dates/progress → you see a light progress spine.
- **Streak as a consistency signal** — AI controls (pauses/forgives) → deterministic counter → you monitor. No shatter, no punishment.
- **Auto-generated daily log** — the form is derived from each habit's metric type (number / yes-no / duration / 1–5 effort) → you fill it in seconds → AI interprets it.
- **Difficulty changes** — AI proposes → you approve *(slightly / more / keep same)* → system applies.
- **Metric capture** — manual taps today, **wearable auto-fill** tomorrow (every metric tagged `manual | wearable`).

---

## Status & roadmap

The data foundation is built; the AI coach is being built on top of it.

| Phase | What | Status |
|------|------|--------|
| **1** | Data foundation — `goals → habits → habit_schedules → habit_logs`, RLS, day-of-week schedules, rest-day-aware streak audit, DB-enforced one-log-per-day | ✅ **Live** |
| **2** | Health/state ingestion + wearable integration (auto-fills the daily log) | 🔜 Planned |
| **3** | AI Coach — onboarding interview, roadmap + adaptive habit generation, daily-log evaluation & coaching | 🔜 Planned |
| **4** | Self-correcting RAG knowledge base (gap-detect → gather → sanitize → embed via `pgvector`) | 🔜 Planned |

**Live today:** email/password auth, goals & habits with dynamic day-of-week schedules,
daily execution logging with a rest-day-aware midnight audit, temporary time-boxed
directives, a dark tactical UI, and installable PWA support. *(Some current mechanics —
fixed 21→50→100 targets and consistency shields — are placeholders that the AI coach will
replace with adaptive, AI-owned logic.)*

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS v4, Oswald type, PWA via `@ducanh2912/next-pwa`
- **Backend:** Supabase — Postgres, Auth, Row Level Security, `pgvector` (for RAG)
- **Planned:** a separate Node worker service for the AI coach + knowledge-base pipeline

---

## Getting started

**Prerequisites:** Node.js 18+ and a Supabase project.

1. **Install**
   ```bash
   npm install
   ```

2. **Configure environment** — create `.env` (or `.env.local`) in the project root:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxx   # the Publishable key (safe for the browser)
   ```
   > Use the **publishable** key, never the secret key — it ships to the browser and is
   > protected only by Row Level Security.

3. **Apply the schema** — in the Supabase SQL editor, run the migrations in order:
   ```
   supabase/migrations/0001_new_schema.sql
   supabase/migrations/0002_drop_legacy_tables.sql
   ```

4. **Run**
   ```bash
   npm run dev      # http://localhost:3000
   ```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

---

## Project structure

```
src/
  app/
    page.js                 Landing page
    auth/                   Login / register (Supabase auth)
    dashboard/              Main app — goals, habits, daily execution, audit
    profile/                Operative settings + habit management
    components/             Habit card, directives, modals, nav
  lib/
    supabase.js             Supabase client
    data/                   Shared data-access layer (reused by the future worker service)
      time.js               Local-date + day-of-week helpers
      habits.js             Habit + schedule + log queries
      goals.js              Goal queries
      stats.js              Shield pool
      audit.js              Pure, rest-day-aware midnight-audit logic
supabase/
  migrations/               Versioned SQL schema (source of truth)
```

---

*The Habit Board turns any goal into an AI-managed system of milestones and adaptive
habits — the discipline is yours, the planning is the machine's.*
