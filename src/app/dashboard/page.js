"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // 1. Import the Router
import { supabase } from "../../lib/supeabase.js";
import EscalatingHabitCard from "../components/Habbitcard";
import { LiveDirectiveCard } from "../components/LiveDirectiveCard.js";
import OperationModal from "../components/modals/OperationModal.js";
import DirectiveModal from "../components/modals/DirectiveModals.js";
import ProtocolModal from "../components/modals/ProtocolModal.js";

export default function Dashboard() {
  const router = useRouter();

  // --- TACTICAL COMMAND DOCK STATE ---
  const [isCommandDockOpen, setIsCommandDockOpen] = useState(false);

  const [operativeName, setOperativeName] = useState("...");
  const [globalShields, setGlobalShields] = useState(0);
  const [isDirectivesOpen, setIsDirectivesOpen] = useState(true);

  // --- ARRAYS FOR OUR DATA ---
  const [simpleTasks, setSimpleTasks] = useState([]);
  const [coreProtocols, setCoreProtocols] = useState([]);

  // --- MODAL STATE MANAGEMENT ---
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isDirectiveModalOpen, setIsDirectiveModalOpen] = useState(false);

  // --- ACTIVE OPERATIONS STATE ---
  const [activeOperations, setActiveOperations] = useState([]);
  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);

  // --- MOBILE VIEW CONTROLLER ---
  // Controls which tab is active on smartphones (protocols, directives, or index)
  const [mobileView, setMobileView] = useState("protocols");

  // --- TEMPORAL AUDIT: MIDNIGHT RESET LOGIC ---
  const getLocalDateString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  };

  const calculateMissedDays = (lastExecutionDateStr, startDateStr) => {
    const todayStr = getLocalDateString();

    if (!startDateStr || todayStr < startDateStr) return 0;

    const baseline = lastExecutionDateStr
      ? new Date(lastExecutionDateStr)
      : new Date(startDateStr);
    const today = new Date(todayStr);

    const diffTime = Math.abs(today - baseline);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 1 ? diffDays - 1 : 0;
  };

  useEffect(() => {
    const bootSequence = async () => {
      // 1. Ask Supabase for the current active session
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      // 2. Security Check: If no user is found, kick them out
      if (authError || !user) {
        console.warn("No active session detected. Terminating access.");
        router.push("/");
        return;
      }

      // 3. Set the Operative Name
      if (user.user_metadata && user.user_metadata.operative_name) {
        setOperativeName(user.user_metadata.operative_name);
      } else {
        setOperativeName(user.email.split("@")[0]);
      }

      // 4. NEW: FETCH TEMPORARY DIRECTIVES
      // --- THE MASTER DATA FETCH (WITH TACTICAL CACHING) ---
      try {
        // 1. INSTANT LOAD: Check local memory first to bypass loading screens
        const cachedProtocols = sessionStorage.getItem("coreProtocols");
        const cachedDirectives = sessionStorage.getItem("temporaryDirectives");

        if (cachedProtocols) setCoreProtocols(JSON.parse(cachedProtocols));
        if (cachedDirectives) setSimpleTasks(JSON.parse(cachedDirectives));

        // 2. BACKGROUND SYNC: Silently fetch fresh data from Supabase

        // A. Fetch Temporary Directives
        const { data: directives, error: dirError } = await supabase
          .from("temporary_directives")
          .select("*")
          .order("created_at", { ascending: true });

        if (dirError) throw dirError;
        if (directives) {
          setSimpleTasks(directives);
          sessionStorage.setItem(
            "temporaryDirectives",
            JSON.stringify(directives),
          ); // Update Cache
        }

        // A.5 Fetch Active Operations
        const { data: operations, error: opError } = await supabase
          .from("active_operations")
          .select("*")
          .eq("user_id", user.id) // Only get this user's operations
          .order("created_at", { ascending: true });

        if (opError) throw opError;
        if (operations) {
          setActiveOperations(operations);
        }

        // B. Fetch Core Protocols
        // B. Fetch Global Shields FIRST (The audit needs this data)
        let currentShields = 0;
        const { data: stats, error: statsError } = await supabase
          .from("user_stats")
          .select("global_shields")
          .eq("id", user.id)
          .maybeSingle();

        if (statsError) throw statsError;
        if (stats && stats.global_shields !== undefined) {
          currentShields = stats.global_shields;
          setGlobalShields(currentShields);
        }

        // C. Fetch Core Protocols & RUN MIDNIGHT AUDIT
        const { data: protocols, error: protError } = await supabase
          .from("core_protocols")
          .select("*")
          .order("created_at", { ascending: true });

        if (protError) throw protError;

        if (protocols) {
          let auditTriggered = false;
          let updatedShields = currentShields;

          // Process each protocol to check for missed days
          // Process each protocol to check for missed days
          const auditedProtocols = protocols.map((protocol) => {
            const missedDays = calculateMissedDays(
              protocol.last_execution_date,
              protocol.start_date,
            );

            if (missedDays > 0) {
              auditTriggered = true;

              let newStreak = protocol.streak;
              let newCurrentDayIndex = protocol.current_day_index;
              let newDaysArray = [...(protocol.days_array || [])];

              // --- NEW: HARD MODE AUDIT ---
              if (protocol.is_hard_mode) {
                // HARD MODE: Instant death. No shield calculations.
                newStreak = 0;
                newCurrentDayIndex = 0;
                newDaysArray = Array(protocol.target).fill("pending");
              } else {
                // STANDARD MODE: Calculate shield damage
                let remainingShields = updatedShields - missedDays;
                if (remainingShields < 0) {
                  // Shields breached. Break the streak.
                  newStreak = 0;
                  newCurrentDayIndex = 0;
                  newDaysArray = Array(protocol.target).fill("pending");
                  updatedShields = 0;
                } else {
                  // Shields held. Absorb the damage.
                  updatedShields = remainingShields;
                }
              }

              return {
                ...protocol,
                streak: newStreak,
                current_day_index: newCurrentDayIndex,
                days_array: newDaysArray,
                _needsDbSync: true,
              };
            }
            return protocol;
          });

          // If the audit caught a failure, silently update Supabase in the background
          if (auditTriggered) {
            auditedProtocols.forEach(async (p) => {
              if (p._needsDbSync) {
                await supabase
                  .from("core_protocols")
                  .update({
                    streak: p.streak,
                    current_day_index: p.current_day_index,
                    days_array: p.days_array,
                  })
                  .eq("id", p.id);
              }
            });

            // Update Global Shields if they took damage
            if (updatedShields !== currentShields) {
              await supabase
                .from("user_stats")
                .update({ global_shields: updatedShields })
                .eq("id", user.id);
              setGlobalShields(updatedShields);
            }
          }

          setCoreProtocols(auditedProtocols);
          sessionStorage.setItem(
            "coreProtocols",
            JSON.stringify(auditedProtocols),
          );
        }
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

  const handleAddProtocol = async (
    name,
    isRoutineMode,
    routineSteps,
    isHardMode,
  ) => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        alert(
          "Authentication lost. Re-establish connection to initialize protocols.",
        );
        return;
      }

      const cleanedSteps = routineSteps.filter((step) => step.trim() !== "");
      const isRoutine = isRoutineMode && cleanedSteps.length > 0;
      const formattedSubTasks = isRoutine
        ? cleanedSteps.map((step, index) => ({
            id: index,
            name: step,
            completedToday: false,
          }))
        : [];

      const initialDaysArray = Array(21).fill("pending");

      const { data, error } = await supabase
        .from("core_protocols")
        .insert([
          {
            user_id: user.id,
            name: name,
            target: 21,
            streak: 0,
            current_day_index: 0,
            days_array: initialDaysArray,
            achievements: [],
            is_routine: isRoutine,
            sub_tasks: formattedSubTasks,
            start_date: getLocalDateString(),
            last_execution_date: null,
            is_hard_mode: isHardMode,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      setCoreProtocols([...coreProtocols, data]);
      setIsProtocolModalOpen(false);
    } catch (error) {
      console.error("Failed to initialize protocol:", error.message);
      alert("System Error: Could not commit protocol to database.");
    }
  };
  // --- INITIALIZE OPERATION ---
  // Notice we now pass parameters into this function
  const handleAddOperation = async (opName, opTarget, selectedIds) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newOp, error: opError } = await supabase
        .from("active_operations")
        .insert([
          { user_id: user.id, name: opName, target_days: Number(opTarget) },
        ])
        .select()
        .single();

      if (opError) throw opError;

      const { error: attachError } = await supabase
        .from("core_protocols")
        .update({ operation_id: newOp.id })
        .in("id", selectedIds);

      if (attachError) throw attachError;

      setActiveOperations([...activeOperations, newOp]);

      const updatedProtocols = coreProtocols.map((p) =>
        selectedIds.includes(p.id) ? { ...p, operation_id: newOp.id } : p,
      );
      setCoreProtocols(updatedProtocols);
      sessionStorage.setItem("coreProtocols", JSON.stringify(updatedProtocols));
    } catch (error) {
      console.error("Failed to initialize Operation:", error.message);
    }
  };

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
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        alert("Authentication lost.");
        return;
      }

      const { data, error } = await supabase
        .from("temporary_directives")
        .insert([
          {
            user_id: user.id,
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

  // --- SYNC PROTOCOL PROGRESS TO MAINFRAME ---
  const handleUpdateProgress = async (
    protocolId,
    updatedProtocolData,
    newShieldCount,
  ) => {
    try {
      // 1. Get the current user ID
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Auth missing.");

      // 2. Update the Protocol in the database
      const { error: protError } = await supabase
        .from("core_protocols")
        .update(updatedProtocolData)
        .eq("id", protocolId);

      if (protError) throw protError;

      // 3. Update the Global Shields in the database (if it changed)
      if (newShieldCount !== undefined && newShieldCount !== globalShields) {
        const { error: shieldError } = await supabase
          .from("user_stats")
          .update({ global_shields: newShieldCount })
          .eq("id", user.id);

        if (shieldError) throw shieldError;
        setGlobalShields(newShieldCount);
      }

      // 4. Update the Local React State & Cache
      setCoreProtocols((protocols) => {
        const updated = protocols.map((p) =>
          p.id === protocolId ? { ...p, ...updatedProtocolData } : p,
        );
        sessionStorage.setItem("coreProtocols", JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Failed to sync progress:", error.message);
      alert("Database sync failed. Your execution may not have saved.");
    }
  };

  const handleUpdateProtocolName = async (protocolId, newName) => {
    // 1. Validate
    if (!newName || !newName.trim()) return;

    // 2. Optimistic UI Update (Instant feedback)
    setCoreProtocols((protocols) =>
      protocols.map((p) => (p.id === protocolId ? { ...p, name: newName } : p)),
    );

    // 3. Database Update
    try {
      const { error } = await supabase
        .from("core_protocols")
        .update({ name: newName })
        .eq("id", protocolId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to update protocol name:", error.message);
      alert("Database sync failed. Your change may not have saved.");
    }
  };
  // --- UPDATE ROUTINE TASKS ---
  const handleUpdateRoutine = async (protocolId, newSubTasks) => {
    // 1. Optimistic UI Update
    setCoreProtocols((protocols) =>
      protocols.map((p) =>
        p.id === protocolId ? { ...p, sub_tasks: newSubTasks } : p,
      ),
    );

    // 2. Database Update
    try {
      const { error } = await supabase
        .from("core_protocols")
        .update({ sub_tasks: newSubTasks })
        .eq("id", protocolId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to update routine tasks:", error.message);
      alert("Database sync failed. Your changes may not have saved.");
    }
  };

  const toggleSimpleTask = async (taskId) => {
    // 1. Find the target task
    const task = simpleTasks.find((t) => t.id === taskId);
    if (!task) return;

    // 2. Calculate the new state
    const isNowCompleted = !task.completed;
    const timestamp = isNowCompleted ? new Date().toISOString() : null;

    // 3. Optimistic UI Update (Instant feedback)
    setSimpleTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, completed: isNowCompleted, terminated_at: timestamp }
          : t,
      ),
    );

    // 4. Update the Database
    try {
      const { error } = await supabase
        .from("temporary_directives")
        .update({
          completed: isNowCompleted,
          terminated_at: timestamp,
        })
        .eq("id", taskId);

      if (error) throw error;
    } catch (error) {
      console.error("Database sync failed:", error.message);
    }
  };

  // --- MANUAL OVERRIDE: DELETE DIRECTIVE ---
  const handleDeleteDirective = async (taskId) => {
    // 1. Optimistic UI Update
    setSimpleTasks((tasks) => tasks.filter((t) => t.id !== taskId));

    // 2. Database Deletion
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
              className={`text-xl md:text-2xl font-bold italic leading-none ${coreProtocols.length > 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"}`}
            >
              {coreProtocols.length < 10 && coreProtocols.length > 0
                ? `0${coreProtocols.length}`
                : coreProtocols.length === 0
                  ? "00"
                  : coreProtocols.length}
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
      {/* --- ACTIVE OPERATIONS HUD --- */}
      {activeOperations.map((op) => {
        // Calculate Operation Progress based on attached protocols
        const attachedProtocols = coreProtocols.filter(
          (p) => p.operation_id === op.id,
        );
        const avgStreak =
          attachedProtocols.length > 0
            ? attachedProtocols.reduce((sum, p) => sum + p.streak, 0) /
              attachedProtocols.length
            : 0;
        const progressPercent = Math.min(
          100,
          (avgStreak / op.target_days) * 100,
        );
        const isComplete = progressPercent >= 100;

        return (
          <div
            key={op.id}
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
                  {op.name}
                </h2>
                <p className="text-[10px] md:text-sm text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                  TGT: {op.target_days}D | LOAD: {attachedProtocols.length}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl md:text-4xl italic font-bold text-white leading-none">
                  {avgStreak.toFixed(1)}{" "}
                  <span className="text-gray-600 text-sm md:text-2xl">
                    / {op.target_days}
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

          {coreProtocols.length === 0 ? (
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
              {/* OPEN PROTOCOL MODAL BUTTON (ZERO STATE) */}
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-8 py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:scale-105 rounded-sm cursor-pointer"
              >
                + Initialize Protocol
              </button>
            </div>
          ) : (
            // MAP THROUGH THE ARRAYS AND RENDER CARDS
            coreProtocols.map((protocol) => (
              <div
                key={protocol.id}
                id={`protocol-${protocol.id}`}
                className="scroll-mt-12"
              >
                <EscalatingHabitCard
                  protocolId={protocol.id}
                  name={protocol.name}
                  createdAt={new Date(protocol.created_at)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                    .toUpperCase()}
                  globalShields={globalShields}
                  setGlobalShields={setGlobalShields}
                  isRoutine={protocol.is_routine}
                  initialSubTasks={protocol.sub_tasks}
                  initialTarget={protocol.target}
                  initialStreak={protocol.streak}
                  initialDayIndex={protocol.current_day_index}
                  initialDaysArray={protocol.days_array}
                  initialAchievements={protocol.achievements}
                  onUpdateRoutine={handleUpdateRoutine}
                  onUpdateName={handleUpdateProtocolName}
                  onUpdateProgress={handleUpdateProgress}
                  isHardMode={protocol.is_hard_mode}
                  lastExecutionDate={protocol.last_execution_date}
                />
              </div>
            ))
          )}
        </div>
      </main>

      {/* ========================================= */}
      {/* MODALS OVERLAYS */}
      {/* ========================================= */}

      {/* 1. Add Protocol Modal */}
      {isProtocolModalOpen && (
        <ProtocolModal
          isOpen={isProtocolModalOpen}
          onClose={() => setIsProtocolModalOpen(false)}
          onCommence={handleAddProtocol}
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

      {/* 3. Add Operation Modal */}
      {isOperationModalOpen && (
        <OperationModal
          isOpen={isOperationModalOpen}
          onClose={() => setIsOperationModalOpen(false)}
          availableProtocols={coreProtocols.filter((p) => !p.operation_id)}
          onCommence={handleAddOperation}
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
