import React, { useState } from "react";

export default function DirectiveModal({ isOpen, onClose, onCommence }) {
  const [name, setName] = useState("");
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCommence(name, days, hours, minutes);

    setName("");
    setDays(0);
    setHours(0);
    setMinutes(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-2xl p-8 relative">
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
          New{" "}
          <span className="text-blue-500 dark:text-cyan-500">Directive</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-8">
          Add a temporary task to the queue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
              Directive Objective
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Schedule Dentist Appointment"
              className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-3 uppercase tracking-wider">
              Time Allocation (Countdown)
            </label>
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col relative group">
                <input
                  type="number"
                  min="0"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-2xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors text-center"
                />
                <span className="text-[10px] text-gray-400 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-500 uppercase tracking-widest mt-1 text-center transition-colors">
                  Days
                </span>
              </div>

              <div className="flex-1 flex flex-col relative group">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-2xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors text-center"
                />
                <span className="text-[10px] text-gray-400 group-focus-within:text-blue-500 dark:group-focus-within:text-cyan-500 uppercase tracking-widest mt-1 text-center transition-colors">
                  Hours
                </span>
              </div>

              <div className="flex-1 flex flex-col relative group">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
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
  );
}
