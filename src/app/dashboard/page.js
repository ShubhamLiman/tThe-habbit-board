"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // 1. Import the Router
import { supabase } from "../../lib/supeabase.js";
import EscalatingHabitCard from "../components/Habbitcard";
import { LiveDirectiveCard } from "../components/LiveDirectiveCard.js";

export default function Dashboard() {
  const router = useRouter();

  const [operativeName, setOperativeName] = useState("...");

  const [globalShields, setGlobalShields] = useState(0);
  const [isDirectivesOpen, setIsDirectivesOpen] = useState(true);

  // --- ARRAYS FOR OUR DATA ---
  const [simpleTasks, setSimpleTasks] = useState([]);
  const [coreProtocols, setCoreProtocols] = useState([]);

  // --- MODAL STATE MANAGEMENT ---
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isDirectiveModalOpen, setIsDirectiveModalOpen] = useState(false);

  // Form Inputs
  const [newProtocolName, setNewProtocolName] = useState("");
  const [newDirectiveName, setNewDirectiveName] = useState("");
  const [directiveDays, setDirectiveDays] = useState(0);
  const [directiveHours, setDirectiveHours] = useState(0);
  const [directiveMinutes, setDirectiveMinutes] = useState(0);

  // --- ADD TO DASHBOARD STATE ---
  const [isRoutineMode, setIsRoutineMode] = useState(false);
  const [routineSteps, setRoutineSteps] = useState(["", "", ""]); // Start with 3 empty slots

  const [isHardMode, setIsHardMode] = useState(false);

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

  const handleAddProtocol = async (e) => {
    e.preventDefault();
    if (!newProtocolName.trim()) return;

    try {
      // 1. SECURE AUTHORIZATION: Verify Operative Identity
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

      // 2. FORMAT ROUTINE DATA: Clean up empty steps
      const cleanedSteps = routineSteps.filter((step) => step.trim() !== "");
      const isRoutine = isRoutineMode && cleanedSteps.length > 0;

      const formattedSubTasks = isRoutine
        ? cleanedSteps.map((step, index) => ({
            id: index,
            name: step,
            completedToday: false,
          }))
        : [];

      // 3. PREPARE MATRIX: Generate the starting 21-day array
      const initialDaysArray = Array(21).fill("pending");

      // 4. DATABASE INJECTION: Send payload to Supabase
      // 4. DATABASE INJECTION: Send payload to Supabase
      const { data, error } = await supabase
        .from("core_protocols")
        .insert([
          {
            user_id: user.id,
            name: newProtocolName,
            target: 21,
            streak: 0,
            current_day_index: 0,
            days_array: initialDaysArray,
            achievements: [],
            is_routine: isRoutine,
            sub_tasks: formattedSubTasks,
            start_date: getLocalDateString(), // <-- ADD THIS LINE
            last_execution_date: null,
            is_hard_mode: isHardMode, // Explicitly null until they execute
          },
        ])
        .select()
        .single();
      if (error) throw error;

      // 5. UPDATE UI: Push the real database record into your dashboard
      setCoreProtocols([...coreProtocols, data]);

      // 6. RESET MODAL
      setNewProtocolName("");
      setIsRoutineMode(false);
      setRoutineSteps(["", "", ""]);
      setIsProtocolModalOpen(false);
    } catch (error) {
      console.error("Failed to initialize protocol:", error.message);
      alert("System Error: Could not commit protocol to database.");
    }
  };

  const handleRoutineStepChange = (index, value) => {
    const newSteps = [...routineSteps];
    newSteps[index] = value;
    setRoutineSteps(newSteps);
  };
  const handleAddDirective = async (e) => {
    e.preventDefault();
    if (!newDirectiveName.trim()) return;

    // 1. Calculate the total time in milliseconds
    const timeToAddMs =
      Number(directiveDays) * 24 * 60 * 60 * 1000 +
      Number(directiveHours) * 60 * 60 * 1000 +
      Number(directiveMinutes) * 60 * 1000;

    // Prevent submission if the timer is 0
    if (timeToAddMs === 0) {
      alert("System Error: Directive requires a valid time duration.");
      return;
    }

    // 2. Generate the exact future expiration timestamp
    const deadlineTimestamp = new Date(Date.now() + timeToAddMs).toISOString();

    try {
      // 3. SECURE AUTHORIZATION: Get the active Operative's ID
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        alert(
          "Authentication lost. Re-establish connection to submit directives.",
        );
        return;
      }

      // 4. DATABASE INJECTION: Send to Supabase
      const { data, error } = await supabase
        .from("temporary_directives")
        .insert([
          {
            user_id: user.id, // Required by your Row Level Security policies
            name: newDirectiveName,
            valid_until: deadlineTimestamp,
            completed: false,
          },
        ])
        .select() // Tells Supabase to hand the newly created row back to us
        .single();

      if (error) throw error;

      // 5. UPDATE UI: Push the real database record (with its true UUID) into your array
      setSimpleTasks((prevTasks) => [...prevTasks, data]);

      // 6. Reset the form
      setNewDirectiveName("");
      setDirectiveDays(0);
      setDirectiveHours(0);
      setDirectiveMinutes(0);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8 md:px-12 md:py-12 font-oswald relative overflow-hidden">
      {/* --- DASHBOARD HEADER --- */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
          <span className="text-blue-500 dark:text-cyan-500 font-bold tracking-widest uppercase text-xs mb-2 block">
            {currentDate}
          </span>
          <h1 className="text-4xl md:text-5xl italic font-bold text-gray-900 dark:text-white uppercase tracking-tight">
            Welcome,{" "}
            <span className="text-blue-500 dark:text-cyan-500">
              {operativeName}
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 italic mt-1 tracking-widest uppercase text-sm">
            System Online. Awaiting execution.
          </p>
          <div className="flex gap-2 m-2">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-cyan-500 font-bold uppercase tracking-widest transition-colors cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-cyan-500 px-2 py-1 rounded-sm"
            >
              <svg
                className="w-3.5 h-3.5"
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
              Operative Profile
            </button>
          </div>
        </div>

        <div className="flex gap-4 md:gap-6 mt-6 md:mt-0 w-full md:w-auto">
          <div className="flex-1 md:flex-none bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-6 py-3 rounded-sm shadow-sm text-center">
            <span className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              Active
            </span>
            <span
              className={`text-2xl font-bold italic leading-none ${coreProtocols.length > 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"}`}
            >
              {coreProtocols.length < 10 && coreProtocols.length > 0
                ? `0${coreProtocols.length}`
                : coreProtocols.length === 0
                  ? "00"
                  : coreProtocols.length}
            </span>
          </div>
          <div className="flex-1 md:flex-none bg-white dark:bg-black border border-gray-200 dark:border-gray-800 px-6 py-3 rounded-sm shadow-sm text-center">
            <span className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              Global Shields
            </span>
            <span
              className={`text-2xl font-bold italic leading-none ${globalShields > 0 ? "text-yellow-500" : "text-gray-400 dark:text-gray-600"}`}
            >
              {globalShields < 10 && globalShields > 0
                ? `0${globalShields}`
                : globalShields === 0
                  ? "00"
                  : globalShields}
            </span>
          </div>
        </div>
      </header>

      {/* --- MAIN GRID LAYOUT --- */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* TEMPORARY DIRECTIVES */}
        <div className="order-1 lg:order-2 lg:col-span-4 flex flex-col gap-8">
          {coreProtocols.length > 0 && (
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-lg p-6">
              <h2 className="text-xl italic font-bold text-gray-900 dark:text-white uppercase mb-4 border-b border-gray-100 dark:border-gray-900 pb-4">
                System{" "}
                <span className="text-blue-500 dark:text-cyan-500">Index</span>
              </h2>
              <div className="flex flex-col gap-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                {coreProtocols.map((protocol) => (
                  <a
                    key={protocol.id}
                    href={`#protocol-${protocol.id}`}
                    className="group flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-cyan-500 transition-colors uppercase tracking-widest cursor-pointer"
                  >
                    <span className="text-blue-500/50 dark:text-cyan-500/50 group-hover:text-blue-500 dark:group-hover:text-cyan-500 transition-colors">
                      ▹
                    </span>
                    <span className="truncate">{protocol.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-lg p-6 transition-all">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-900 pb-4">
              <h2 className="text-xl italic font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                Temporary{" "}
                <span className="text-blue-500 dark:text-cyan-500">
                  Directives
                </span>
              </h2>
              <button
                onClick={() => setIsDirectiveModalOpen(true)}
                className="text-gray-400 hover:text-blue-500 dark:hover:text-cyan-500 transition-colors cursor-pointer"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>

            {simpleTasks.length === 0 ? (
              <p className="text-sm italic text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center py-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-sm">
                Queue Empty
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* NEW: RENDER THE LIVE CLOCK CARDS */}
                {simpleTasks.map((task) => (
                  <LiveDirectiveCard
                    key={task.id}
                    task={task}
                    onToggle={toggleSimpleTask}
                    onDelete={handleDeleteDirective} // <-- ADD THIS PROP
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CORE PROTOCOLS */}
        <div className="order-2 lg:order-1 lg:col-span-8 flex flex-col gap-8">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
            <h2 className="text-2xl italic font-bold text-gray-900 dark:text-white uppercase">
              Core Protocols
            </h2>
            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold italic uppercase tracking-widest px-3 py-1.5 rounded-sm border border-blue-500/50 dark:border-cyan-500/50 text-blue-500 dark:text-cyan-500 hover:bg-blue-500 dark:hover:bg-cyan-500 hover:text-white dark:hover:text-black hover:border-transparent hover:shadow-[0_0_12px_rgba(6,182,212,0.5)] transition-all cursor-pointer"
              title="Initialize New Protocol"
            >
              <svg
                className="w-3.5 h-3.5"
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
              Initialize
            </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4 transition-opacity">
          <div className="w-full max-w-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsProtocolModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
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
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="text-3xl italic font-bold text-gray-900 dark:text-white uppercase mb-2">
              New{" "}
              <span className="text-blue-500 dark:text-cyan-500">Protocol</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-6">
              Establish a new 21-day neural rewrite.
            </p>

            <form onSubmit={handleAddProtocol} className="flex flex-col gap-6">
              <div className="flex flex-col">
                <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
                  Protocol Name
                </label>
                <input
                  type="text"
                  value={newProtocolName}
                  onChange={(e) => setNewProtocolName(e.target.value)}
                  placeholder="e.g. Morning Physical Protocol"
                  className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Routine Toggle */}
              <div className="flex items-center justify-between border-t border-b border-gray-100 dark:border-gray-900 py-4">
                <div>
                  <h4 className="text-sm italic font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Routine Wrapper
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Require multiple sub-tasks to be checked off daily.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoutineMode(!isRoutineMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isRoutineMode ? "bg-blue-500 dark:bg-cyan-500" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isRoutineMode ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
              {/* --- NEW: HARD MODE TOGGLE --- */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-900 py-4">
                <div>
                  <h4 className="text-sm italic font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      ></path>
                    </svg>
                    Zero-Tolerance Mode
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Shields disabled. Miss one day, lose everything.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHardMode(!isHardMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isHardMode ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHardMode ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
              {/* Dynamic Routine Steps Input */}
              {isRoutineMode && (
                <div className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-sm border border-gray-200 dark:border-gray-800">
                  <label className="text-sm text-gray-500 dark:text-gray-400 italic uppercase tracking-wider">
                    Checklist Items
                  </label>
                  {routineSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm font-bold">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) =>
                          handleRoutineStepChange(index, e.target.value)
                        }
                        placeholder={`e.g. ${index === 0 ? "5km Run" : index === 1 ? "100 Pushups" : "Cold Shower"}`}
                        className="w-full bg-transparent border-b border-gray-300 dark:border-gray-700 py-1 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRoutineSteps([...routineSteps, ""])}
                    className="text-xs text-blue-500 dark:text-cyan-500 font-bold uppercase tracking-widest mt-2 hover:text-blue-600 dark:hover:text-cyan-400 self-start cursor-pointer"
                  >
                    + Add Another Step
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="mt-2 w-full py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm"
              >
                Commit to System
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Temporary Directive Modal */}
      {isDirectiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4 transition-opacity">
          <div className="w-full max-w-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-2xl p-8 relative">
            <button
              onClick={() => setIsDirectiveModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
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
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="text-3xl italic font-bold text-gray-900 dark:text-white uppercase mb-2">
              New{" "}
              <span className="text-blue-500 dark:text-cyan-500">
                Directive
              </span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-8">
              Add a temporary task to the queue.
            </p>

            <form onSubmit={handleAddDirective} className="flex flex-col gap-6">
              <div className="flex flex-col">
                <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
                  Directive Objective
                </label>
                <input
                  type="text"
                  value={newDirectiveName}
                  onChange={(e) => setNewDirectiveName(e.target.value)}
                  placeholder="e.g. Schedule Dentist Appointment"
                  className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                  autoFocus
                />
              </div>
              {/* --- NEW: COUNTDOWN TIMER UI --- */}
              <div className="flex flex-col">
                <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-3 uppercase tracking-wider">
                  Time Allocation (Countdown)
                </label>
                <div className="flex gap-4">
                  {/* Days */}
                  <div className="flex-1 flex flex-col relative group">
                    <input
                      type="number"
                      min="0"
                      value={directiveDays}
                      onChange={(e) => setDirectiveDays(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-2xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors text-center"
                    />
                    <span className="text-[10px] text-gray-400 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-500 uppercase tracking-widest mt-1 text-center transition-colors">
                      Days
                    </span>
                  </div>

                  {/* Hours */}
                  <div className="flex-1 flex flex-col relative group">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={directiveHours}
                      onChange={(e) => setDirectiveHours(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-2xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors text-center"
                    />
                    <span className="text-[10px] text-gray-400 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-500 uppercase tracking-widest mt-1 text-center transition-colors">
                      Hours
                    </span>
                  </div>

                  {/* Minutes */}
                  <div className="flex-1 flex flex-col relative group">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={directiveMinutes}
                      onChange={(e) => setDirectiveMinutes(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-2xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors text-center"
                    />
                    <span className="text-[10px] text-gray-400 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-500 uppercase tracking-widest mt-1 text-center transition-colors">
                      Mins
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 w-full py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm"
              >
                Add Directive
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
