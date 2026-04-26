import React, { useState } from "react";

export default function OperationModal({
  isOpen,
  onClose,
  availableProtocols,
  onCommence,
}) {
  // 1. Local State (Moved from Dashboard)
  const [opName, setOpName] = useState("");
  const [opTarget, setOpTarget] = useState(50);
  const [selectedProtocols, setSelectedProtocols] = useState([]);

  // 2. Hide component if not open
  if (!isOpen) return null;

  // 3. Intercept Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!opName.trim() || selectedProtocols.length === 0) {
      alert("Operation requires a name and at least one attached protocol.");
      return;
    }

    // Fire the data back to the Dashboard's master function
    onCommence(opName, opTarget, selectedProtocols);

    // Reset local form and close
    setOpName("");
    setOpTarget(50);
    setSelectedProtocols([]);
    onClose();
  };

  // 4. The Isolated UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4">
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
          <span className="text-blue-500 dark:text-cyan-500">Operation</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-6">
          Group protocols into a macro-objective.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
              Operation Callsign
            </label>
            <input
              type="text"
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              placeholder="e.g. Primary Directive: Ironclad"
              className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-wider">
              Target Days (Milestone)
            </label>
            <input
              type="number"
              min="1"
              value={opTarget}
              onChange={(e) => setOpTarget(e.target.value)}
              className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-xl italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-900/30 p-4 border border-gray-200 dark:border-gray-800 rounded-sm">
            <label className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 pb-2 mb-2">
              Attach Protocols
            </label>
            {availableProtocols.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No free protocols available.
              </p>
            ) : (
              availableProtocols.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-500 dark:accent-cyan-500"
                    checked={selectedProtocols.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedProtocols([...selectedProtocols, p.id]);
                      else
                        setSelectedProtocols(
                          selectedProtocols.filter((id) => id !== p.id),
                        );
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-bold uppercase tracking-wide group-hover:text-blue-500 dark:group-hover:text-cyan-500 transition-colors">
                    {p.name}
                  </span>
                </label>
              ))
            )}
          </div>

          <button
            type="submit"
            className="mt-2 w-full py-4 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black font-bold italic uppercase tracking-wide hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all cursor-pointer rounded-sm"
          >
            Commence Operation
          </button>
        </form>
      </div>
    </div>
  );
}
