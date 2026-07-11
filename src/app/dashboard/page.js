"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EscalatingHabitCard from "../components/Habbitcard";
import { LiveDirectiveCard } from "../components/LiveDirectiveCard.js";
import OperationModal from "../components/modals/OperationModal.js";
import DirectiveModal from "../components/modals/DirectiveModals.js";
import ProtocolModal from "../components/modals/ProtocolModal.js";

import {
  getHabitsBundle,
  createHabit,
  updateHabit,
  updateHabitSubTasks,
  logHabitExecution,
  insertAuditLogs,
  deriveDaysArray,
} from "@/lib/data/habits";
import { getGoals, createGoal } from "@/lib/data/goals";
import { getGlobalShields, setGlobalShields as saveGlobalShields } from "@/lib/data/stats";
import { runAudit } from "@/lib/data/audit";
import { getLocalDateString, getDayOfWeek } from "@/lib/data/time";

export default function Dashboard() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);

  // --- TACTICAL COMMAND DOCK STATE ---
  const [isCommandDockOpen, setIsCommandDockOpen] = useState(false);

  const [operativeName, setOperativeName] = useState("...");
  const [globalShields, setGlobalShields] = useState(0);
  const [isDirectivesOpen, setIsDirectivesOpen] = useState(true);

  // --- ARRAYS FOR OUR DATA ---
  const [simpleTasks, setSimpleTasks] = useState([]); // temporary_directives
  const [habits, setHabits] = useState([]); // habits + schedules + logs bundle
  const [goals, setGoals] = useState([]); // macro-objectives

  // --- MODAL STATE MANAGEMENT ---
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isDirectiveModalOpen, setIsDirectiveModalOpen] = useState(false);
  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);

  // --- MOBILE VIEW CONTROLLER ---
  const [mobileView, setMobileView] = useState("protocols");

  useEffect(() => {
    const bootSequence = async () => {
      // 1. Verify the active session
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.warn("No active session detected. Terminating access.");
        router.push("/");
        return;
      }

      setUserId(user.id);
      setOperativeName(
        user.user_metadata?.operative_name ?? user.email.split("@")[0],
      );

      try {
        // 2. INSTANT LOAD: hydrate directives from local cache
        const cachedDirectives = sessionStorage.getItem("temporaryDirectives");
        if (cachedDirectives) setSimpleTasks(JSON.parse(cachedDirectives));

        // 3. Temporary Directives (user-scoped; RLS also enforces this server-side)
        const { data: directives, error: dirError } = await supabase
          .from("temporary_directives")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (dirError) throw dirError;
        if (directives) {
          setSimpleTasks(directives);
          sessionStorage.setItem(
            "temporaryDirectives",
            JSON.stringify(directives),
          );
        }

        // 4. Goals (macro-objectives)
        const goalsData = await getGoals();
        setGoals(goalsData);

        // 5. Global Shields (audit needs this first)
        let currentShields = await getGlobalShields(user.id);

        // 6. Habits bundle (habit + 7-day schedule + logs, with derived helpers)
        let bundle = await getHabitsBundle();

        // 7. MIDNIGHT AUDIT — rest-day aware, log-based, shares the shield pool
        const todayStr = getLocalDateString();
        const { perHabit, endingShields, changed } = runAudit(
          bundle,
          todayStr,
          currentShields,
        );

        if (changed) {
          for (const { habitId, patch, newLogs } of perHabit) {
            if (newLogs.length) {
              await insertAuditLogs(
                newLogs.map((l) => ({ ...l, user_id: user.id })),
              );
            }
            if (patch) await updateHabit(habitId, patch);
          }

          if (endingShields !== currentShields) {
            await saveGlobalShields(user.id, endingShields);
            currentShields = endingShields;
          }

          const patchMap = {};
          perHabit.forEach((p) => {
            if (p.patch) patchMap[p.habitId] = p.patch;
          });
          bundle = bundle.map((h) =>
            patchMap[h.id]
              ? {
                  ...h,
                  ...patchMap[h.id],
                  daysArray: deriveDaysArray(
                    h.target,
                    patchMap[h.id].current_day_index,
                  ),
                }
              : h,
          );
        }

        setGlobalShields(currentShields);
        setHabits(bundle);
      } catch (error) {
        console.error("Failed to sync profile from mainframe:", error.message);
      }
    };

    bootSequence();
  }, [router]);

  const currentDate = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  // --- INITIALIZE HABIT (from ProtocolModal) ---
  const handleAddHabit = async (
    name,
    isRoutineMode,
    routineSteps,
    isHardMode,
  ) => {
    try {
      if (!userId) {
        alert(
          "Authentication lost. Re-establish connection to initialize protocols.",
        );
        return;
      }

      const cleanedSteps = routineSteps.filter((step) => step.trim() !== "");
      const isRoutine = isRoutineMode && cleanedSteps.length > 0;
      const subTasks = isRoutine
        ? cleanedSteps.map((step, index) => ({
            id: index,
            name: step,
            completedToday: false,
          }))
        : [];

      const habit = await createHabit({
        userId,
        name,
        isRoutine,
        isHardMode,
        subTasks,
        target: 21,
      });

      const todayDow = getDayOfWeek(getLocalDateString());
      const todaySchedule =
        habit.schedules.find((s) => s.day_of_week === todayDow) ?? null;

      setHabits((prev) => [
        ...prev,
        {
          ...habit,
          logs: [],
          todaySchedule,
          isRestToday: !!todaySchedule?.is_rest_day,
          isExecutedToday: false,
          lastLogDate: null,
          daysArray: deriveDaysArray(habit.target, 0),
        },
      ]);
      setIsProtocolModalOpen(false);
    } catch (error) {
      console.error("Failed to initialize habit:", error.message);
      alert("System Error: Could not commit protocol to database.");
    }
  };

  // --- INITIALIZE GOAL (from OperationModal) ---
  const handleAddGoal = async (title, targetStreak, habitIds) => {
    try {
      const goal = await createGoal({ userId, title, targetStreak, habitIds });
      setGoals((prev) => [...prev, goal]);
      setHabits((prev) =>
        prev.map((h) =>
          habitIds.includes(h.id) ? { ...h, goal_id: goal.id } : h,
        ),
      );
    } catch (error) {
      console.error("Failed to initialize Goal:", error.message);
    }
  };

  // --- ADD TEMPORARY DIRECTIVE ---
  const handleAddDirective = async (
    name,
    directiveDays,
    directiveHours,
    directiveMinutes,
  ) => {
    const timeToAddMs =
      Number(directiveDays) * 24 * 60 * 60 * 1000 +
      Number(directiveHours) * 60 * 60 * 1000 +
      Number(directiveMinutes) * 60 * 1000;

    if (timeToAddMs === 0) {
      alert("System Error: Directive requires a valid time duration.");
      return;
    }

    const deadlineTimestamp = new Date(Date.now() + timeToAddMs).toISOString();

    try {
      if (!userId) {
        alert("Authentication lost.");
        return;
      }

      const { data, error } = await supabase
        .from("temporary_directives")
        .insert([
          {
            user_id: userId,
            name: name,
            valid_until: deadlineTimestamp,
            completed: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setSimpleTasks((prevTasks) => [...prevTasks, data]);
      setIsDirectiveModalOpen(false);
    } catch (error) {
      console.error("System Failure:", error.message);
      alert("Failed to commit directive to the mainframe.");
    }
  };

  // --- EXECUTE HABIT (from card): write a habit_logs row + update streak cache ---
  const handleExecute = async (habitId, { patch, log, newShieldCount }) => {
    try {
      const { duplicate } = await logHabitExecution({
        userId,
        habitId,
        scheduleId: log.scheduleId,
        completedSubTasks: log.completedSubTasks,
        status: "completed",
      });

      if (duplicate) {
        alert(
          "Already executed today. The system enforces one execution per day.",
        );
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId ? { ...h, isExecutedToday: true } : h,
          ),
        );
        return;
      }

      await updateHabit(habitId, patch);

      if (newShieldCount !== undefined) {
        await saveGlobalShields(userId, newShieldCount);
        setGlobalShields(newShieldCount);
      }

      const todayStr = getLocalDateString();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habitId
            ? {
                ...h,
                ...patch,
                isExecutedToday: true,
                lastLogDate: todayStr,
                daysArray: deriveDaysArray(
                  patch.target,
                  patch.current_day_index,
                ),
              }
            : h,
        ),
      );
    } catch (error) {
      console.error("Failed to sync execution:", error.message);
      alert("Database sync failed. Your execution may not have saved.");
    }
  };

  // --- RENAME HABIT ---
  const handleUpdateName = async (habitId, newName) => {
    if (!newName || !newName.trim()) return;

    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? { ...h, name: newName } : h)),
    );

    try {
      await updateHabit(habitId, { name: newName });
    } catch (error) {
      console.error("Failed to update habit name:", error.message);
      alert("Database sync failed. Your change may not have saved.");
    }
  };

  // --- UPDATE ROUTINE SUB-TASKS (uniform across the week for Phase 1) ---
  const handleUpdateSubTasks = async (habitId, newSubTasks) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const schedules = h.schedules.map((s) => ({
          ...s,
          sub_tasks: newSubTasks,
        }));
        const todayDow = getDayOfWeek(getLocalDateString());
        return {
          ...h,
          schedules,
          todaySchedule:
            schedules.find((s) => s.day_of_week === todayDow) ??
            h.todaySchedule,
        };
      }),
    );

    try {
      await updateHabitSubTasks(habitId, newSubTasks);
    } catch (error) {
      console.error("Failed to update routine tasks:", error.message);
      alert("Database sync failed. Your changes may not have saved.");
    }
  };

  const toggleSimpleTask = async (taskId) => {
    const task = simpleTasks.find((t) => t.id === taskId);
    if (!task) return;

    const isNowCompleted = !task.completed;
    const timestamp = isNowCompleted ? new Date().toISOString() : null;

    setSimpleTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, completed: isNowCompleted, terminated_at: timestamp }
          : t,
      ),
    );

    try {
      const { error } = await supabase
        .from("temporary_directives")
        .update({ completed: isNowCompleted, terminated_at: timestamp })
        .eq("id", taskId);
      if (error) throw error;
    } catch (error) {
      console.error("Database sync failed:", error.message);
    }
  };

  const handleDeleteDirective = async (taskId) => {
    setSimpleTasks((tasks) => tasks.filter((t) => t.id !== taskId));
    try {
      const { error } = await supabase
        .from("temporary_directives")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    } catch (error) {
      console.error("Failed to terminate directive:", error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8 md:px-12 md:py-12 pb-28 md:pb-12 font-oswald relative overflow-hidden">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
        {/* Left: Identity & Date */}
        <div>
          <span className="text-blue-500 dark:text-cyan-500 font-bold tracking-widest uppercase text-[10px] mb-1 block">
            {currentDate}
          </span>
          <h1 className="text-2xl md:text-3xl italic font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-none">
            {" "}
            <span className="text-blue-500 dark:text-cyan-500">
              {operativeName}
            </span>
          </h1>
        </div>

        {/* Right: Icon-Based Stat Bar & Profile */}
        <div className="flex w-full md:w-auto items-stretch gap-2 h-10 md:h-12">
          {/* Active Protocols (Grid Icon) */}
          <div
            className="flex-1 md:flex-none bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-4 rounded-sm shadow-sm flex items-center justify-center gap-2"
            title="Active Protocols"
          >
            <svg
              className="w-4 h-4 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <span
              className={`text-xl md:text-2xl font-bold italic leading-none ${habits.length > 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"}`}
            >
              {habits.length < 10 && habits.length > 0
                ? `0${habits.length}`
                : habits.length === 0
                  ? "00"
                  : habits.length}
            </span>
          </div>

          {/* Global Shields (Shield Icon) */}
          <div
            className="flex-1 md:flex-none bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-4 rounded-sm shadow-sm flex items-center justify-center gap-2"
            title="Global Shields"
          >
            <svg
              className="w-4 h-4 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span
              className={`text-xl md:text-2xl font-bold italic leading-none ${globalShields > 0 ? "text-yellow-500" : "text-gray-400 dark:text-gray-600"}`}
            >
              {globalShields < 10 && globalShields > 0
                ? `0${globalShields}`
                : globalShields === 0
                  ? "00"
                  : globalShields}
            </span>
          </div>

          {/* Operative Profile Button */}
          <button
            onClick={() => router.push("/profile")}
            className="flex-none bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-4 rounded-sm hover:bg-blue-500 dark:hover:bg-cyan-500 hover:border-blue-500 dark:hover:border-cyan-500 text-gray-400 hover:text-white dark:hover:text-black transition-all flex items-center justify-center cursor-pointer"
            title="Operative Profile"
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* --- ACTIVE OPERATIONS HUD (Goals) --- */}
      {goals.map((goal) => {
        const attachedHabits = habits.filter((h) => h.goal_id === goal.id);
        const avgStreak =
          attachedHabits.length > 0
            ? attachedHabits.reduce((sum, h) => sum + h.current_streak, 0) /
              attachedHabits.length
            : 0;
        const progressPercent = goal.target_streak
          ? Math.min(100, (avgStreak / goal.target_streak) * 100)
          : 0;
        const isComplete = progressPercent >= 100;

        return (
          <div
            key={goal.id}
            className="max-w-7xl mx-auto mb-4 md:mb-8 bg-gray-900 dark:bg-black border border-gray-800 rounded-sm p-4 md:p-6 relative overflow-hidden"
          >
            {/* Background glowing effect */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-900/20 dark:bg-cyan-900/20 transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />

            <div className="relative z-10 flex justify-between items-center gap-4">
              <div className="flex-1 overflow-hidden">
                <span className="text-[9px] md:text-xs font-bold text-blue-500 dark:text-cyan-500 uppercase tracking-widest animate-pulse block mb-0.5 md:mb-1">
                  {isComplete ? "Operation Successful" : "Active Operation"}
                </span>
                <h2 className="text-xl md:text-3xl italic font-bold text-white uppercase tracking-tight truncate">
                  {goal.title}
                </h2>
                <p className="text-[10px] md:text-sm text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                  TGT: {goal.target_streak}D | LOAD: {attachedHabits.length}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl md:text-4xl italic font-bold text-white leading-none">
                  {avgStreak.toFixed(1)}{" "}
                  <span className="text-gray-600 text-sm md:text-2xl">
                    / {goal.target_streak}
                  </span>
                </span>
              </div>
            </div>

            {/* The Hardline Progress Bar */}
            <div className="relative z-10 w-full h-1.5 md:h-2 bg-gray-800 mt-3 md:mt-4 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-out ${isComplete ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-blue-500 dark:bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* --- MAIN GRID LAYOUT --- */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div
          className={`order-2 lg:col-span-4 flex-col gap-4 md:gap-8 ${mobileView !== "protocols" ? "flex" : "hidden lg:flex"}`}
        >
          <div
            className={`bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-lg p-2 transition-all ${mobileView === "directives" ? "block" : "hidden lg:block"}`}
          >
            <button
              onClick={() => setIsDirectivesOpen(!isDirectivesOpen)}
              className="w-full flex justify-between items-center p-4 md:p-5 cursor-pointer group"
            >
              {/* Left Side: Title & Badge */}
              <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                <h2 className="text-base md:text-xl italic font-bold text-gray-900 dark:text-white uppercase tracking-wide whitespace-nowrap truncate">
                  Temporary{" "}
                  <span className="text-blue-500 dark:text-cyan-500">
                    Directives
                  </span>
                </h2>

                {/* --- TACTICAL INDICATOR BADGE --- */}
                {simpleTasks.filter((task) => !task.completed).length > 0 && (
                  <span className="shrink-0 px-2 py-0.5 border border-blue-500/50 dark:border-cyan-500/50 bg-blue-500/10 dark:bg-cyan-500/10 text-blue-500 dark:text-cyan-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-sm animate-pulse">
                    {simpleTasks.filter((task) => !task.completed).length < 10
                      ? `0${simpleTasks.filter((task) => !task.completed).length}`
                      : simpleTasks.filter((task) => !task.completed)
                          .length}{" "}
                    Pending
                  </span>
                )}
              </div>

              {/* Right Side: Chevron */}
              <svg
                className={`shrink-0 w-5 h-5 ml-2 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-cyan-500 transition-transform duration-300 ${isDirectivesOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isDirectivesOpen ? "max-h-200 opacity-100 border-t border-gray-100 dark:border-gray-900" : "max-h-0 opacity-0"}`}
            >
              <div className="p-5">
                {simpleTasks.length === 0 ? (
                  <p className="text-sm italic text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center py-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-sm">
                    Queue Empty
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {simpleTasks.map((task) => (
                      <LiveDirectiveCard
                        key={task.id}
                        task={task}
                        onToggle={toggleSimpleTask}
                        onDelete={handleDeleteDirective}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CORE PROTOCOLS */}
        <div
          className={`order-1 lg:col-span-8 flex-col gap-6 md:gap-8 ${mobileView === "protocols" ? "flex" : "hidden lg:flex"}`}
        >
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
            <h2 className="text-2xl italic font-bold text-gray-900 dark:text-white uppercase">
              Core Protocols
            </h2>
          </div>

          {habits.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center py-24 px-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-sm bg-white/50 dark:bg-black/30">
              <div className="w-20 h-20 mb-6 rounded-full bg-blue-50 dark:bg-cyan-900/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-blue-400 dark:text-cyan-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl md:text-4xl italic font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-3">
                System{" "}
                <span className="text-blue-500 dark:text-cyan-500">Idle</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg italic max-w-md mx-auto mb-8">
                No active protocols detected. Initialize your first keystone
                habit to begin the 21-day neural rewrite.
              </p>
              {/* ZERO-STATE ACTIONS: AI Coach (primary) + manual protocol */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <button
                  onClick={() => router.push("/coach")}
                  className="px-8 py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 rounded-sm cursor-pointer"
                >
                  ✦ Build with AI Coach
                </button>
                <button
                  onClick={() => setIsProtocolModalOpen(true)}
                  className="px-8 py-4 bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold italic uppercase tracking-wide border border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-cyan-500 transition-all rounded-sm cursor-pointer"
                >
                  + Manual Protocol
                </button>
              </div>
            </div>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                id={`protocol-${habit.id}`}
                className="scroll-mt-12"
              >
                <EscalatingHabitCard
                  habitId={habit.id}
                  name={habit.name}
                  createdAt={new Date(habit.created_at)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                    .toUpperCase()}
                  globalShields={globalShields}
                  setGlobalShields={setGlobalShields}
                  isRoutine={habit.is_routine}
                  isHardMode={habit.is_hard_mode}
                  target={habit.target}
                  streak={habit.current_streak}
                  dayIndex={habit.current_day_index}
                  achievements={habit.achievements}
                  longestStreak={habit.longest_streak}
                  todaySchedule={habit.todaySchedule}
                  isRestToday={habit.isRestToday}
                  isExecutedToday={habit.isExecutedToday}
                  onUpdateName={handleUpdateName}
                  onUpdateSubTasks={handleUpdateSubTasks}
                  onExecute={handleExecute}
                />
              </div>
            ))
          )}
        </div>
      </main>

      {/* ========================================= */}
      {/* MODALS OVERLAYS */}
      {/* ========================================= */}

      {/* 1. Add Protocol (Habit) Modal */}
      {isProtocolModalOpen && (
        <ProtocolModal
          isOpen={isProtocolModalOpen}
          onClose={() => setIsProtocolModalOpen(false)}
          onCommence={handleAddHabit}
        />
      )}

      {/* 2. Add Temporary Directive Modal */}
      {isDirectiveModalOpen && (
        <DirectiveModal
          isOpen={isDirectiveModalOpen}
          onClose={() => setIsDirectiveModalOpen(false)}
          onCommence={handleAddDirective}
        />
      )}

      {/* 3. Add Operation (Goal) Modal */}
      {isOperationModalOpen && (
        <OperationModal
          isOpen={isOperationModalOpen}
          onClose={() => setIsOperationModalOpen(false)}
          availableProtocols={habits.filter((h) => !h.goal_id)}
          onCommence={handleAddGoal}
        />
      )}

      {/* ========================================= */}
      {/* MOBILE TACTICAL BOTTOM NAVIGATION (WITH CENTER FAB) */}
      {/* ========================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex justify-between items-center z-40 px-8 h-16 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {/* Left: Core Protocols Tab */}
        <button
          onClick={() => setMobileView("protocols")}
          className={`flex flex-col items-center transition-colors w-16 ${mobileView === "protocols" ? "text-blue-500 dark:text-cyan-500" : "text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300"}`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Core
          </span>
        </button>

        {/* Center: Tactical Command Toggle */}
        <div className="relative flex justify-center w-16">
          {/* Mobile Pop-up Menu (Shoots up from the center) */}
          {isCommandDockOpen && (
            <div className="absolute bottom-16 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 min-w-[200px]">
              <button
                onClick={() => {
                  setIsOperationModalOpen(true);
                  setIsCommandDockOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold active:bg-gray-100 dark:active:bg-gray-900"
              >
                <span>Operation</span>
                <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsProtocolModalOpen(true);
                  setIsCommandDockOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold active:bg-gray-100 dark:active:bg-gray-900"
              >
                <span>Protocol</span>
                <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsDirectiveModalOpen(true);
                  setIsCommandDockOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold active:bg-gray-100 dark:active:bg-gray-900"
              >
                <span>Directive</span>
                <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </button>
            </div>
          )}

          {/* The Elevated '+' Button */}
          <button
            onClick={() => setIsCommandDockOpen(!isCommandDockOpen)}
            className={`absolute -bottom-5 w-10 h-10 rounded-sm flex items-center justify-center transition-all duration-300 shadow-[0_10px_20px_rgba(0,0,0,0.5)] z-50
              ${
                isCommandDockOpen
                  ? "bg-red-500 text-white rotate-45 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  : "bg-blue-500 dark:bg-cyan-500 text-white dark:text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* Right: Temporary Directives Tab */}
        <button
          onClick={() => setMobileView("directives")}
          className={`flex flex-col items-center transition-colors w-16 relative ${mobileView === "directives" ? "text-blue-500 dark:text-cyan-500" : "text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300"}`}
        >
          {simpleTasks.filter((t) => !t.completed).length > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 bg-blue-500 dark:bg-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          )}
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Queue
          </span>
        </button>
      </div>

      {/* ========================================= */}
      {/* TACTICAL COMMAND DOCK (FLOATING ACTION MENU) */}
      {/* ========================================= */}
      <div className="hidden lg:flex fixed bottom-10 right-10 z-40 flex-col items-end gap-3">
        {/* Expanded Menu Options */}
        {isCommandDockOpen && (
          <div className="flex flex-col items-end gap-3 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <button
              onClick={() => {
                router.push("/coach");
                setIsCommandDockOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black border border-blue-500 dark:border-cyan-500 hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold group cursor-pointer"
            >
              <span>AI Coach</span>
              <div className="bg-white/20 p-1.5 rounded-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </button>
            <button
              onClick={() => {
                setIsOperationModalOpen(true);
                setIsCommandDockOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-cyan-500 hover:border-blue-500 dark:hover:border-cyan-500 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold group cursor-pointer"
            >
              <span>Primary Directive</span>
              <div className="bg-gray-100 dark:bg-gray-900 group-hover:bg-blue-500/10 dark:group-hover:bg-cyan-500/10 p-1.5 rounded-sm transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </button>

            <button
              onClick={() => {
                setIsProtocolModalOpen(true);
                setIsCommandDockOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-cyan-500 hover:border-blue-500 dark:hover:border-cyan-500 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold group cursor-pointer"
            >
              <span>Core Protocol</span>
              <div className="bg-gray-100 dark:bg-gray-900 group-hover:bg-blue-500/10 dark:group-hover:bg-cyan-500/10 p-1.5 rounded-sm transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </div>
            </button>

            <button
              onClick={() => {
                setIsDirectiveModalOpen(true);
                setIsCommandDockOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-cyan-500 hover:border-blue-500 dark:hover:border-cyan-500 transition-all rounded-sm shadow-xl uppercase tracking-widest text-xs font-bold group cursor-pointer"
            >
              <span>Temp Directive</span>
              <div className="bg-gray-100 dark:bg-gray-900 group-hover:bg-blue-500/10 dark:group-hover:bg-cyan-500/10 p-1.5 rounded-sm transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Main Master Toggle */}
        <button
          onClick={() => setIsCommandDockOpen(!isCommandDockOpen)}
          className={`w-14 h-14 md:w-16 md:h-16 rounded-sm flex items-center justify-center transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer z-50
            ${
              isCommandDockOpen
                ? "bg-red-500 text-white rotate-45 hover:bg-red-600"
                : "bg-blue-500 dark:bg-cyan-500 text-white dark:text-black hover:scale-105 hover:bg-blue-600 dark:hover:bg-cyan-400 dark:hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            }`}
        >
          <svg
            className="w-6 h-6 md:w-8 md:h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
