import React, { useState } from "react";

export default function ProtocolModal({ isOpen, onClose, onCommence }) {
  // 1. Local State (Moved from Dashboard)
  const [name, setName] = useState("");
  const [isRoutineMode, setIsRoutineMode] = useState(false);
  const [routineSteps, setRoutineSteps] = useState(["", "", ""]);
  const [isHardMode, setIsHardMode] = useState(false);

  // 2. Hide component if not open
  if (!isOpen) return null;

  // 3. Handle Routine Input Changes
  const handleRoutineStepChange = (index, value) => {
    const newSteps = [...routineSteps];
    newSteps[index] = value;
    setRoutineSteps(newSteps);
  };

  // 4. Intercept Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Pass data up to Dashboard
    onCommence(name, isRoutineMode, routineSteps, isHardMode);

    // Reset local form and close
    setName("");
    setIsRoutineMode(false);
    setRoutineSteps(["", "", ""]);
    setIsHardMode(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
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
          New <span className="text-blue-500 dark:text-cyan-500">Protocol</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-6">
          Establish a new 21-day neural rewrite.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
              Protocol Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          {/* Hard Mode Toggle */}
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
                  />
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
  );
}
