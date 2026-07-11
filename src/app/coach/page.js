"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// POST to one of our server routes with the caller's Supabase Bearer token.
async function authedPost(path, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expired. Please sign in again.");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function formatMetric(m) {
  if (!m) return null;
  if (m.value != null) return `${m.value} ${m.unit || m.type}`.trim();
  return m.type;
}

export default function CoachPage() {
  const router = useRouter();

  // Wizard flow: goal -> interview -> preview
  const [step, setStep] = useState("goal");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");

  const [goal, setGoal] = useState("");
  const [classification, setClassification] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // keyed by question.key
  const [plan, setPlan] = useState(null);

  // Auth guard.
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error: authErr }) => {
      if (authErr || !data?.user) router.push("/");
    });
  }, [router]);

  const run = async (label, fn) => {
    setError("");
    setBusy(true);
    setBusyLabel(label);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  // Step 1 -> 2: classify + generate the interview in one call.
  const startInterview = () =>
    run("Reading your goal…", async () => {
      const res = await authedPost("/api/interview", { goal: goal.trim() });
      setClassification(res.classification);
      setQuestions(res.questions);
      const seed = {};
      res.questions.forEach((q) => {
        seed[q.key] = q.type === "multi_select" ? [] : "";
      });
      setAnswers(seed);
      setStep("interview");
    });

  // Step 2 -> 3: turn the answers into a plan.
  const generatePlan = () =>
    run("Designing your plan…", async () => {
      const answerList = questions.map((q) => ({
        key: q.key,
        question: q.question,
        answer: answers[q.key],
      }));
      const res = await authedPost("/api/plan", {
        goal: goal.trim(),
        classification,
        answers: answerList,
      });
      setPlan(res.plan);
      setStep("preview");
    });

  // Step 3: persist and land on the dashboard.
  const commit = () =>
    run("Saving your plan…", async () => {
      const answerList = questions.map((q) => ({
        key: q.key,
        question: q.question,
        answer: answers[q.key],
      }));
      await authedPost("/api/plan/commit", {
        plan,
        classification,
        answers: answerList,
      });
      router.push("/dashboard");
    });

  const setAnswer = (key, value) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const toggleMulti = (key, option) =>
    setAnswers((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [key]: next };
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-oswald px-4 py-10 md:px-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-150 bg-blue-500/10 dark:bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Back */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-500 dark:hover:text-cyan-500 transition-colors italic tracking-widest uppercase mb-8 cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Return to Base
        </button>

        {/* Header */}
        <div className="mb-8">
          <span className="text-blue-500 dark:text-cyan-500 font-bold tracking-widest uppercase text-[10px] mb-1 block">
            AI Coach
          </span>
          <h1 className="text-3xl md:text-4xl italic font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-none">
            Build a{" "}
            <span className="text-blue-500 dark:text-cyan-500">Plan</span>
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-[10px] font-bold uppercase tracking-widest">
          {["Goal", "Interview", "Plan"].map((label, i) => {
            const idx = ["goal", "interview", "preview"].indexOf(step);
            const active = i <= idx;
            return (
              <React.Fragment key={label}>
                <span
                  className={
                    active
                      ? "text-blue-500 dark:text-cyan-500"
                      : "text-gray-400 dark:text-gray-600"
                  }
                >
                  {label}
                </span>
                {i < 2 && (
                  <span className="text-gray-300 dark:text-gray-700">—</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500 rounded-sm text-center">
            <p className="text-red-500 italic font-bold text-sm tracking-widest uppercase">
              {error}
            </p>
          </div>
        )}

        {/* Busy banner */}
        {busy && (
          <div className="mb-6 p-3 bg-blue-500/10 dark:bg-cyan-500/10 border border-blue-500 dark:border-cyan-500 rounded-sm text-center animate-pulse">
            <p className="text-blue-500 dark:text-cyan-500 italic font-bold text-sm tracking-widest uppercase">
              {busyLabel}
            </p>
          </div>
        )}

        {/* --- STEP 1: GOAL --- */}
        {step === "goal" && (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-xl p-6 md:p-8">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-2 uppercase tracking-wider block">
              What do you want to achieve?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. Learn Rust and build a CLI tool — I know JS but I'm new to systems programming"
              className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-lg italic text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors resize-none"
            />
            <button
              onClick={startInterview}
              disabled={busy || !goal.trim()}
              className="mt-6 w-full py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Begin Interview
            </button>
          </div>
        )}

        {/* --- STEP 2: INTERVIEW --- */}
        {step === "interview" && (
          <div className="flex flex-col gap-6">
            {classification && (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic tracking-widest uppercase">
                Detected:{" "}
                <span className="text-blue-500 dark:text-cyan-500">
                  {classification.domain}
                </span>
                {" / "}
                {classification.sub_domain}
              </p>
            )}

            {questions.map((q) => (
              <div
                key={q.key}
                className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm p-5"
              >
                <label className="text-base italic font-bold text-gray-900 dark:text-white block mb-3">
                  {q.question}
                </label>

                {q.type === "text" && (
                  <input
                    type="text"
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswer(q.key, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                  />
                )}

                {q.type === "number" && (
                  <input
                    type="number"
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswer(q.key, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                  />
                )}

                {q.type === "date" && (
                  <input
                    type="date"
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswer(q.key, e.target.value)}
                    className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                  />
                )}

                {(q.type === "single_select" || q.type === "multi_select") && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const selected =
                        q.type === "multi_select"
                          ? Array.isArray(answers[q.key]) &&
                            answers[q.key].includes(opt)
                          : answers[q.key] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            q.type === "multi_select"
                              ? toggleMulti(q.key, opt)
                              : setAnswer(q.key, opt)
                          }
                          className={`px-3 py-2 text-sm italic rounded-sm border transition-all cursor-pointer ${
                            selected
                              ? "bg-blue-500 dark:bg-cyan-500 text-white dark:text-black border-blue-500 dark:border-cyan-500"
                              : "bg-transparent text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-cyan-500"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("goal")}
                disabled={busy}
                className="px-6 py-4 text-gray-500 dark:text-gray-400 italic uppercase tracking-widest font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={generatePlan}
                disabled={busy}
                className="flex-1 py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm disabled:opacity-50"
              >
                Generate My Plan
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: PLAN PREVIEW --- */}
        {step === "preview" && plan && (
          <div className="flex flex-col gap-6">
            <div className="bg-gray-900 dark:bg-black border border-gray-800 rounded-sm p-6">
              <span className="text-[10px] font-bold text-blue-500 dark:text-cyan-500 uppercase tracking-widest block mb-1">
                Proposed Operation
              </span>
              <h2 className="text-2xl md:text-3xl italic font-bold text-white uppercase tracking-tight mb-2">
                {plan.goal.title}
              </h2>
              {plan.goal.description && (
                <p className="text-sm text-gray-400 italic mb-3">
                  {plan.goal.description}
                </p>
              )}
              {plan.goal.rationale && (
                <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-blue-500 dark:border-cyan-500 pl-3">
                  {plan.goal.rationale}
                </p>
              )}
              {plan.goal.target_date && (
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-3">
                  Target date: {plan.goal.target_date}
                </p>
              )}
            </div>

            {plan.habits.map((habit, hi) => (
              <div
                key={hi}
                className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg italic font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                    {habit.name}
                  </h3>
                  {habit.is_routine && (
                    <span className="text-[9px] px-2 py-0.5 border border-blue-500/50 dark:border-cyan-500/50 text-blue-500 dark:text-cyan-500 uppercase tracking-widest rounded-sm">
                      Routine
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {habit.schedules.map((s, si) => (
                    <div
                      key={si}
                      className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-t border-gray-100 dark:border-gray-900 pt-3"
                    >
                      <span
                        className={`shrink-0 w-12 text-xs font-bold uppercase tracking-widest ${
                          s.is_rest_day
                            ? "text-gray-400 dark:text-gray-600"
                            : "text-blue-500 dark:text-cyan-500"
                        }`}
                      >
                        {DAY_NAMES[s.day_of_week]}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm italic font-bold text-gray-900 dark:text-white">
                            {s.variant_label}
                          </span>
                          {formatMetric(s.target_metric) && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase tracking-widest rounded-sm">
                              {formatMetric(s.target_metric)}
                            </span>
                          )}
                        </div>
                        {Array.isArray(s.sub_tasks) &&
                          s.sub_tasks.length > 0 && (
                            <ul className="mt-1.5 flex flex-col gap-1">
                              {s.sub_tasks.map((t, ti) => (
                                <li
                                  key={ti}
                                  className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2"
                                >
                                  <span className="text-blue-500 dark:text-cyan-500 mt-0.5">
                                    ›
                                  </span>
                                  {t.name}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("interview")}
                disabled={busy}
                className="px-6 py-4 text-gray-500 dark:text-gray-400 italic uppercase tracking-widest font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Tweak Answers
              </button>
              <button
                onClick={commit}
                disabled={busy}
                className="flex-1 py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm disabled:opacity-50"
              >
                Commit to System
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
