"use client";

import React, { useState } from "react";

export default function EscalatingHabitCard({
  protocolId,
  name,
  createdAt,
  globalShields,
  setGlobalShields,
  isRoutine,
  initialSubTasks,
  initialTarget,
  initialStreak,
  initialDayIndex,
  initialDaysArray,
  initialAchievements,
  onUpdateName,
  onUpdateRoutine,
  onUpdateProgress,
}) {
  const [target, setTarget] = useState(initialTarget ?? 21);
  const [days, setDays] = useState(initialDaysArray ?? Array(21).fill("pending"));
  const [currentDayIndex, setCurrentDayIndex] = useState(initialDayIndex ?? 0);
  const [streak, setStreak] = useState(initialStreak ?? 0);
  const [achievements, setAchievements] = useState(initialAchievements ?? []);

  // --- ROUTINE STATE ---
  // This tracks the sub-tasks for the CURRENT day.
  const [dailyTasks, setDailyTasks] = useState(initialSubTasks ?? []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [isEditingRoutine, setIsEditingRoutine] = useState(false);
  const [editedTasks, setEditedTasks] = useState([]);

  const startEditingRoutine = () => {
    setEditedTasks([...dailyTasks]);
    setIsEditingRoutine(true);
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== name) {
      onUpdateName(protocolId, editedName);
    } else {
      setEditedName(name); // Reset if they left it blank
    }
    setIsEditingName(false);
  };
  const handleSaveRoutine = () => {
    // Filter out completely empty tasks so we don't save blanks
    const cleanedTasks = editedTasks.filter((t) => t.name.trim() !== "");

    setDailyTasks(cleanedTasks); // Update the visual UI immediately
    onUpdateRoutine(protocolId, cleanedTasks); // Send to Dashboard -> Supabase
    setIsEditingRoutine(false);
  };

  const updateEditedTask = (id, newName) => {
    setEditedTasks((tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, name: newName } : t)),
    );
  };

  const removeEditedTask = (id) => {
    setEditedTasks((tasks) => tasks.filter((t) => t.id !== id));
  };

  const addEditedTask = () => {
    // Generate a unique ID for the new task to prevent React mapping errors
    const newId =
      editedTasks.length > 0
        ? Math.max(...editedTasks.map((t) => t.id)) + 1
        : 0;
    setEditedTasks([
      ...editedTasks,
      { id: newId, name: "", completedToday: false },
    ]);
  };

  // Check if all sub-tasks are completed (Returns true if it's NOT a routine, bypassing the lock)
  const isExecutionLocked =
    isRoutine && !dailyTasks.every((task) => task.completedToday);

  const toggleSubTask = (taskId) => {
    setDailyTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, completedToday: !task.completedToday }
          : task,
      ),
    );
  };

  const handleExecute = () => {
    if (isExecutionLocked) return; // Prevent execution if locked

    const newStreak = streak + 1;
    setStreak(newStreak);

    if (newStreak % 6 === 0) {
      setGlobalShields((prev) => prev + 1);
    }

    const newDays = [...days];
    newDays[currentDayIndex] = "completed";
    setDays(newDays);
    setCurrentDayIndex((prev) => prev + 1);

    // --- RESET ROUTINE FOR TOMORROW ---
    if (isRoutine) {
      setDailyTasks((tasks) =>
        tasks.map((t) => ({ ...t, completedToday: false })),
      );
    }

    // Expansion Logic
    if (newStreak === 21 && target === 21) {
      setTarget(50);
      if (!achievements.includes("Foundation_Forged"))
        setAchievements((prev) => [...prev, "Foundation_Forged"]);
      setDays((prevDays) => [...prevDays, ...Array(29).fill("pending")]);
    }

    if (newStreak === 50 && target === 50) {
      setTarget(100);
      if (!achievements.includes("Deep_Wiring_Complete"))
        setAchievements((prev) => [...prev, "Deep_Wiring_Complete"]);
      setDays((prevDays) => [...prevDays, ...Array(50).fill("pending")]);
    }

    // Compute the final days array for the DB (include expansion padding if milestone reached)
    const expansionAt21 = newStreak === 21 && target === 21;
    const expansionAt50 = newStreak === 50 && target === 50;
    const finalDaysArray = expansionAt21
      ? [...newDays, ...Array(29).fill("pending")]
      : expansionAt50
        ? [...newDays, ...Array(50).fill("pending")]
        : newDays;

    onUpdateProgress(
      protocolId,
      {
        streak: newStreak,
        current_day_index: currentDayIndex + 1,
        days_array: finalDaysArray,
        target: expansionAt21 ? 50 : expansionAt50 ? 100 : target,
        achievements:
          expansionAt21
            ? [...achievements, "Foundation_Forged"]
            : expansionAt50
              ? [...achievements, "Deep_Wiring_Complete"]
              : achievements,
      },
      newStreak % 6 === 0 ? globalShields + 1 : undefined,
    );
  };

  const handleFail = () => {
    // Hoist all variables so they're accessible after the if/else blocks
    let pausedDays = null;
    let checkpoint = 0;
    let newTarget = 21;
    let resetDays = null;
    const usedShield = globalShields > 0;

    if (usedShield) {
      setGlobalShields((prev) => prev - 1);
      pausedDays = [...days];
      pausedDays[currentDayIndex] = "paused";
      setDays(pausedDays);
      setCurrentDayIndex((prev) => prev + 1);

      // Reset routine checklist for tomorrow even if paused
      if (isRoutine)
        setDailyTasks((tasks) =>
          tasks.map((t) => ({ ...t, completedToday: false })),
        );
    } else {
      if (achievements.includes("Deep_Wiring_Complete") || streak >= 50) {
        checkpoint = 50;
        newTarget = 100;
      } else if (achievements.includes("Foundation_Forged") || streak >= 21) {
        checkpoint = 21;
        newTarget = 50;
      }

      setStreak(checkpoint);
      setTarget(newTarget);
      setCurrentDayIndex(checkpoint);

      resetDays = Array(newTarget).fill("pending");
      for (let i = 0; i < checkpoint; i++) {
        resetDays[i] = "completed";
      }
      setDays(resetDays);

      // Reset routine checklist
      if (isRoutine)
        setDailyTasks((tasks) =>
          tasks.map((t) => ({ ...t, completedToday: false })),
        );
    }

    onUpdateProgress(
      protocolId,
      {
        streak: usedShield ? streak : checkpoint,
        current_day_index: usedShield ? currentDayIndex + 1 : checkpoint,
        days_array: usedShield ? pausedDays : resetDays,
        target: usedShield ? target : newTarget,
      },
      usedShield ? globalShields - 1 : undefined,
    );
  };

  const phaseName =
    target === 21
      ? "Phase 1: Foundation"
      : target === 50
        ? "Phase 2: Deep Wiring"
        : "Phase 3: Mastery";

  return (
    <div className="w-full max-w-4xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm p-6 md:p-8 shadow-2xl font-oswald relative overflow-hidden transition-all duration-500">
      {/* Header (Same as before) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-100 dark:border-gray-900 pb-4 relative z-10">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-blue-500 dark:text-cyan-500 font-bold tracking-widest uppercase block mr-2">
              {phaseName}
            </span>
            {achievements.map((badge, idx) => (
              <span
                key={idx}
                className="text-[10px] bg-blue-500/10 text-blue-500 dark:bg-cyan-500/10 dark:text-cyan-500 border border-blue-500/30 dark:border-cyan-500/30 px-2 py-0.5 rounded-sm uppercase tracking-wider"
              >
                ★ {badge.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <div className="w-full">
            {isEditingName ? (
              <div className="flex items-center gap-1 md:gap-2 mr-4">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setEditedName(name);
                      setIsEditingName(false);
                    }
                  }}
                  className="w-full bg-transparent border-b-2 border-blue-500 dark:border-cyan-500 py-1 md:py-2 text-2xl md:text-3xl italic font-bold text-gray-900 dark:text-white uppercase tracking-wide focus:outline-none transition-colors"
                  autoFocus
                />

                {/* Save Button */}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSaveName();
                  }}
                  className="text-green-500 hover:text-green-600 p-3 cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </button>

                {/* Cancel Button */}
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditedName(name);
                    setIsEditingName(false);
                  }}
                  className="text-red-500 hover:text-red-600 p-3 cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            ) : (
              <h2
                className="text-3xl italic font-bold text-gray-900 dark:text-white uppercase flex items-center gap-3 group/title cursor-pointer"
                onClick={() => setIsEditingName(true)}
              >
                {name}

                {/* Edit Icon: Visible on mobile, hidden-until-hover on desktop */}
                <button className="opacity-100 md:opacity-0 md:group-hover/title:opacity-100 text-gray-400 hover:text-blue-500 dark:hover:text-cyan-500 transition-all cursor-pointer p-2 md:p-0">
                  <svg
                    className="w-5 h-5 md:w-4 md:h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    ></path>
                  </svg>
                </button>
              </h2>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 tracking-widest uppercase mt-1">
            INIT_DATE:{" "}
            <span className="text-gray-700 dark:text-gray-300">
              {createdAt || "UNKNOWN"}
            </span>
          </p>
        </div>

        <div className="flex gap-8 mt-4 md:mt-0 text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              Streak
            </span>
            <span className="text-3xl italic font-bold text-blue-500 dark:text-cyan-500 leading-none">
              {streak} <span className="text-lg text-gray-400">/ {target}</span>
            </span>
          </div>
        </div>
      </div>

      {/* The 21-Day Matrix (Same as before) */}
      <div className="mb-6">
        <div
          className={`grid gap-2 md:gap-3 ${target === 21 ? "grid-cols-7" : "grid-cols-10"}`}
        >
          {days.map((status, index) => {
            let styleClasses =
              "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800";
            let content = null;

            if (status === "completed") {
              styleClasses =
                "bg-blue-500 dark:bg-cyan-500 border-blue-500 dark:border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]";
            } else if (status === "paused") {
              styleClasses =
                "bg-transparent border-yellow-500 border-dashed border-2 text-yellow-500";
              content = (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-1.998A11.954 11.954 0 0110 1.944z"
                    clipRule="evenodd"
                  />
                </svg>
              );
            }

            if (index === currentDayIndex) {
              styleClasses +=
                " ring-2 ring-blue-400 dark:ring-cyan-400 ring-offset-2 ring-offset-white dark:ring-offset-black animate-pulse";
            }

            return (
              <div
                key={index}
                className={`relative w-full aspect-square rounded-sm border-2 flex items-center justify-center transition-all duration-300 ${styleClasses}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- NEW: ROUTINE CHECKLIST UI --- */}
      {/* --- ROUTINE CHECKLIST UI --- */}
      {isRoutine && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 p-4 rounded-sm transition-all">
          <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-800 pb-2">
            <h3 className="text-sm italic font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Daily Execution Checklist
            </h3>

            {/* EDIT/SAVE BUTTON */}
            {!isEditingRoutine ? (
              <button
                onClick={startEditingRoutine}
                className="text-gray-400 hover:text-blue-500 dark:hover:text-cyan-500 transition-colors cursor-pointer p-1"
              >
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  ></path>
                </svg>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingRoutine(false)}
                  className="text-xs text-gray-400 hover:text-red-500 uppercase tracking-widest font-bold px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoutine}
                  className="text-xs bg-blue-500 dark:bg-cyan-500 text-white dark:text-black hover:bg-blue-600 dark:hover:bg-cyan-400 uppercase tracking-widest font-bold px-3 py-1 rounded-sm shadow-md cursor-pointer"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {/* VIEW MODE */}
            {!isEditingRoutine ? (
              dailyTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleSubTask(task.id)}
                  className="flex items-center gap-3 cursor-pointer group p-1"
                >
                  <div
                    className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center transition-colors rounded-sm ${task.completedToday ? "bg-blue-500 border-blue-500 dark:bg-cyan-500 dark:border-cyan-500" : "border-gray-400 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-cyan-400"}`}
                  >
                    {task.completedToday && (
                      <svg
                        className="w-3 h-3 text-white dark:text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`italic font-medium uppercase tracking-wide transition-colors ${task.completedToday ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-300 group-hover:text-blue-500 dark:group-hover:text-cyan-500"}`}
                  >
                    {task.name}
                  </span>
                </div>
              ))
            ) : (
              /* EDIT MODE */
              <div className="flex flex-col gap-3 mt-2">
                {editedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={task.name}
                      onChange={(e) =>
                        updateEditedTask(task.id, e.target.value)
                      }
                      placeholder="Enter task name..."
                      className="flex-1 bg-transparent border-b border-gray-300 dark:border-gray-700 py-1 text-sm italic font-medium text-gray-900 dark:text-white uppercase tracking-wide focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                    />
                    <button
                      onClick={() => removeEditedTask(task.id)}
                      className="text-gray-400 hover:text-red-500 p-2 cursor-pointer"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </button>
                  </div>
                ))}

                {/* ADD NEW TASK BUTTON */}
                <button
                  onClick={addEditedTask}
                  className="mt-2 text-xs text-blue-500 dark:text-cyan-500 hover:text-blue-600 dark:hover:text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1 w-fit p-1 cursor-pointer"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M12 4v16m8-8H4"
                    ></path>
                  </svg>
                  Add Step
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simulator Controls */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 border-t border-gray-100 dark:border-gray-900 pt-6 mt-4 relative z-10">
        {/* Primary Action: Execute */}
        <button
          onClick={handleExecute}
          disabled={isExecutionLocked}
          className={`w-full md:flex-1 py-4 md:py-3 text-lg md:text-base font-bold italic uppercase tracking-wide transition-all shadow-lg rounded-sm flex items-center justify-center gap-2 active:scale-[0.98] select-none
            ${
              isExecutionLocked
                ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "bg-blue-500 dark:bg-cyan-500 text-white dark:text-black hover:bg-blue-600 dark:hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
            }
          `}
        >
          {isExecutionLocked ? (
            <>
              <svg
                className="w-5 h-5 md:w-6 md:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Complete Sub-Tasks
            </>
          ) : (
            `Execute Day ${streak + 1}`
          )}
        </button>

        {/* Secondary Action: Fail / Miss */}
        <button
          onClick={handleFail}
          className="w-full md:w-1/3 py-4 md:py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold italic text-lg md:text-base uppercase tracking-widest transition-all cursor-pointer rounded-sm active:scale-[0.98] select-none"
        >
          Miss Day
        </button>
      </div>
    </div>
  );
}
