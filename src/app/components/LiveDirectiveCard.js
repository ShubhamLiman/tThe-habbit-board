import React, { useState, useEffect } from "react";

// --- NEW: ISOLATED COUNTDOWN COMPONENT ---
export const LiveDirectiveCard = ({ task, onToggle, onDelete }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // If there's no valid timestamp or the task is already done, don't run the timer
    if (!task.valid_until || task.completed) return;

    const targetDate = new Date(task.valid_until).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setIsExpired(false);
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          ),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    };

    // Run it immediately once, then set the 1-second interval
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    // Cleanup interval when component unmounts
    return () => clearInterval(intervalId);
  }, [task.valid_until, task.completed]);

  // Formatting helpers to keep numbers double-digit (e.g., "09" instead of "9")
  const formatNum = (num) => num.toString().padStart(2, "0");

  // Determine styling based on state
  const isUrgent =
    timeLeft.days === 0 && timeLeft.hours < 12 && !isExpired && !task.completed;

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-sm border transition-all ${
        task.completed
          ? "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
          : isExpired
            ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/30 dark:border-red-500/30"
            : isUrgent
              ? "bg-yellow-500/5 dark:bg-yellow-500/10 border-yellow-500/30 dark:border-yellow-500/30"
              : "bg-white dark:bg-black border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-cyan-400"
      }`}
    >
      {/* Checkbox */}
      <div
        onClick={() => onToggle(task.id)}
        className={`mt-1 w-5 h-5 shrink-0 border-2 flex items-center justify-center transition-colors rounded-sm cursor-pointer ${
          task.completed
            ? "bg-blue-500 border-blue-500 dark:bg-cyan-500 dark:border-cyan-500"
            : "border-gray-400 dark:border-gray-600 group-hover:border-blue-500 dark:group-hover:border-cyan-500"
        }`}
      >
        {task.completed && (
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

      {/* Task Details & HUD Timer */}
      <div className="flex-1 min-w-0">
        <span
          className={`block italic font-bold uppercase tracking-wide truncate transition-colors ${
            task.completed
              ? "text-gray-400 line-through"
              : "text-gray-900 dark:text-white"
          }`}
        >
          {task.name}
        </span>

        {/* The Live Clock */}
        <div className="mt-1 flex items-center gap-2">
          {task.completed ? (
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-sm">
              Terminated
            </span>
          ) : isExpired ? (
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-sm animate-pulse">
              Mission Failed
            </span>
          ) : (
            <div
              className={`flex gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                isUrgent
                  ? "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                  : "text-blue-500 dark:text-cyan-500 bg-blue-500/10 dark:bg-cyan-500/10 border-blue-500/20 dark:border-cyan-500/20"
              }`}
            >
              {timeLeft.days > 0 && <span>{formatNum(timeLeft.days)}D</span>}
              <span>{formatNum(timeLeft.hours)}H</span>
              <span>{formatNum(timeLeft.minutes)}M</span>
              <span
                className={
                  timeLeft.seconds % 2 === 0
                    ? "opacity-100"
                    : "opacity-50 transition-opacity"
                }
              >
                {formatNum(timeLeft.seconds)}S
              </span>
            </div>
          )}
        </div>
        {(task.completed || isExpired) && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-500 transition-all cursor-pointer"
            title="Purge Directive"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
