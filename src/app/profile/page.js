"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supeabase";

export default function ProfilePage() {
  const router = useRouter();

  // --- USER STATE ---
  const [operativeName, setOperativeName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [coreProtocols, setCoreProtocols] = useState([]);

  // --- UI STATE ---
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [isLoading, setIsLoading] = useState(true);

  // --- ABORT MODAL STATE ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [deletePasscode, setDeletePasscode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // --- BOOT SEQUENCE ---
  useEffect(() => {
    const fetchProfileData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/");
        return;
      }

      setEmail(user.email);
      if (user.user_metadata?.operative_name) {
        setOperativeName(user.user_metadata.operative_name);
      } else {
        setOperativeName(user.email.split("@")[0]);
      }

      // Fetch active protocols
      const { data: protocols } = await supabase
        .from("core_protocols")
        .select("*")
        .order("created_at", { ascending: true });

      if (protocols) setCoreProtocols(protocols);
      setIsLoading(false);
    };

    fetchProfileData();
  }, [router]);

  // --- UPDATE PROFILE (Name & Email) ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: "Updating profile...", type: "loading" });

    try {
      const { error } = await supabase.auth.updateUser({
        email: email,
        data: { operative_name: operativeName },
      });

      if (error) throw error;
      setStatusMsg({ text: "Profile updated successfully.", type: "success" });
      setTimeout(() => setStatusMsg({ text: "", type: "" }), 3000);
    } catch (error) {
      setStatusMsg({ text: `ERROR: ${error.message}`, type: "error" });
    }
  };

  // --- UPDATE PASSWORD ---
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: "Updating passcode...", type: "loading" });

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      setStatusMsg({ text: "Passcode updated successfully.", type: "success" });
      setNewPassword("");
      setTimeout(() => setStatusMsg({ text: "", type: "" }), 3000);
    } catch (error) {
      setStatusMsg({ text: `ERROR: ${error.message}`, type: "error" });
    }
  };

  // --- HOSTILE ABORT SEQUENCE ---
  const executeSelfDestruct = async () => {
    if (confirmText !== "CONFIRM" || !selectedProtocol) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      // 1. Re-verify Passcode
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: deletePasscode,
      });

      if (authError) throw new Error("ACCESS DENIED: Incorrect Passcode.");

      // 2. Purge Database
      const { error: deleteError } = await supabase
        .from("core_protocols")
        .delete()
        .eq("id", selectedProtocol.id);

      if (deleteError) throw deleteError;

      // 3. Update UI
      // 3. Update UI
      const updatedProtocols = coreProtocols.filter(
        (p) => p.id !== selectedProtocol.id,
      );
      setCoreProtocols(updatedProtocols);

      // Update the local cache so the Dashboard knows it was deleted
      sessionStorage.setItem("coreProtocols", JSON.stringify(updatedProtocols));
      // 4. Close Modal
      setIsDeleteModalOpen(false);
      setSelectedProtocol(null);
      setDeletePasscode("");
      setConfirmText("");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };
  const getInitials = (name) => {
    if (!name) return "OP"; // Fallback if empty
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    // Grab first letter of the first word, and first letter of the last word
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center font-oswald text-blue-500 italic animate-pulse tracking-widest text-xl">
        Accessing Secure Logs...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-oswald p-4 md:p-8 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Navigation */}
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

        <h1 className="text-4xl md:text-5xl italic font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-2">
          Command{" "}
          <span className="text-blue-500 dark:text-cyan-500">Center</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 italic text-sm tracking-widest uppercase mb-12">
          Operative settings and protocol management.
        </p>

        {/* Global HUD Alert */}
        {statusMsg.text && (
          <div
            className={`mb-8 p-4 border rounded-sm text-center font-bold italic tracking-widest uppercase text-sm ${
              statusMsg.type === "error"
                ? "bg-red-500/10 border-red-500 text-red-500"
                : statusMsg.type === "success"
                  ? "bg-green-500/10 border-green-500 text-green-500"
                  : "bg-blue-500/10 border-blue-500 text-blue-500 animate-pulse"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* --- LEFT COLUMN: PROFILE --- */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm p-6 shadow-xl">
              {/* Tactical Avatar */}
              <div className="flex flex-col items-center justify-center mb-8 pb-8 border-b border-gray-100 dark:border-gray-900">
                {/* Tactical Avatar */}
                <div className="flex flex-col items-center justify-center mb-8 pb-8 border-b border-gray-100 dark:border-gray-900">
                  <div className="w-32 h-32 rounded-full border-4 border-blue-500 dark:border-cyan-500 flex items-center justify-center bg-blue-500/10 shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-4">
                    {/* UPDATED: Removed tracking, added leading-none, adjusted text size for 2 letters */}
                    <span className="text-5xl font-bold text-blue-500 dark:text-cyan-500 uppercase leading-none pl-1">
                      {getInitials(operativeName)}
                    </span>
                  </div>

                  <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                    Clearance Level: Alpha
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                  OP: {operativeName}
                </h2>
                <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                  Clearance Level: Alpha
                </span>
              </div>

              {/* Profile Details Form */}
              <form
                onSubmit={handleUpdateProfile}
                className="flex flex-col gap-5 mb-8"
              >
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-widest">
                    Operative Designation
                  </label>
                  <input
                    type="text"
                    value={operativeName}
                    onChange={(e) => setOperativeName(e.target.value)}
                    required
                    className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-lg italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 dark:text-gray-400 italic mb-1 uppercase tracking-widest">
                    Comm Link (Email)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-lg italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-2 py-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white font-bold italic uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer rounded-sm border border-gray-300 dark:border-gray-700"
                >
                  Save Identity
                </button>
              </form>

              {/* Security Form */}
              <form
                onSubmit={handleUpdatePassword}
                className="flex flex-col gap-5 pt-6 border-t border-gray-100 dark:border-gray-900"
              >
                <div className="flex flex-col">
                  <label className="text-xs text-red-500/80 italic mb-1 uppercase tracking-widest">
                    Reset Passcode
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-lg italic font-bold text-gray-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newPassword || newPassword.length < 6}
                  className="mt-2 py-3 bg-red-500/10 text-red-500 font-bold italic uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors cursor-pointer rounded-sm border border-red-500/50 disabled:opacity-50"
                >
                  Update Security
                </button>
              </form>
            </div>
          </div>

          {/* --- RIGHT COLUMN: ACTIVE PROTOCOLS --- */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm p-6 shadow-xl h-full">
              <h3 className="text-2xl italic font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-gray-800 pb-4 mb-6 flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-blue-500 dark:text-cyan-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Active Matrix
              </h3>

              {coreProtocols.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-sm">
                  <span className="italic uppercase tracking-widest font-bold">
                    No Active Protocols
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {coreProtocols.map((protocol) => (
                    <div
                      key={protocol.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-sm group hover:border-blue-500/50 transition-colors"
                    >
                      <div className="mb-4 sm:mb-0">
                        <span className="block text-xl italic font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                          {protocol.name}
                        </span>
                        <div className="flex gap-4">
                          <span className="text-xs text-blue-500 dark:text-cyan-500 font-bold uppercase tracking-widest">
                            Streak: {protocol.streak} / {protocol.target}
                          </span>
                          <span className="text-xs text-gray-500 uppercase tracking-widest">
                            {protocol.is_routine ? "Routine" : "Habit"}
                          </span>
                        </div>
                      </div>

                      {/* Trigger the Hostile Modal */}
                      <button
                        onClick={() => {
                          setSelectedProtocol(protocol);
                          setIsDeleteModalOpen(true);
                        }}
                        className="text-sm border-2 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 uppercase tracking-widest font-bold transition-all cursor-pointer rounded-sm active:scale-95"
                      >
                        Abort
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- PROTOCOL ABORT MODAL (HOSTILE UI) --- */}
      {isDeleteModalOpen && selectedProtocol && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity">
          <div className="w-full max-w-lg bg-black border-2 border-red-500/50 rounded-sm shadow-[0_0_50px_rgba(239,68,68,0.2)] p-8 relative">
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <svg
                className="w-8 h-8 animate-pulse"
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
              <h2 className="text-3xl italic font-bold uppercase tracking-widest">
                Warning
              </h2>
            </div>

            <p className="text-gray-400 italic mb-6 tracking-wide leading-relaxed">
              You are attempting to abort{" "}
              <span className="text-white font-bold">
                "{selectedProtocol.name}"
              </span>
              . This action is permanent. Surrendering this protocol will
              instantly incinerate your{" "}
              <span className="text-red-500 font-bold">
                {selectedProtocol.streak}-day streak
              </span>{" "}
              and all associated discipline logs.
            </p>

            {/* Error HUD */}
            {deleteError && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500 rounded-sm text-center">
                <p className="text-red-500 italic font-bold text-sm tracking-widest uppercase">
                  {deleteError}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-5 mb-8">
              <div className="flex flex-col">
                <label className="text-xs text-red-500/80 italic mb-1 uppercase tracking-widest">
                  Authorization Passcode
                </label>
                <input
                  type="password"
                  value={deletePasscode}
                  onChange={(e) => setDeletePasscode(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-b-2 border-red-500/30 py-2 text-xl italic font-bold text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-red-500/80 italic mb-1 uppercase tracking-widest">
                  Type "CONFIRM" to surrender
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  className="bg-transparent border-b-2 border-red-500/30 py-2 text-xl italic font-bold text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-4 flex-col sm:flex-row">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletePasscode("");
                  setConfirmText("");
                  setDeleteError("");
                  setSelectedProtocol(null);
                }}
                className="flex-1 py-3 text-gray-400 hover:text-white uppercase tracking-widest font-bold transition-colors cursor-pointer"
              >
                Maintain Discipline
              </button>

              <button
                onClick={executeSelfDestruct}
                disabled={
                  confirmText !== "CONFIRM" || !deletePasscode || isDeleting
                }
                className={`flex-1 py-3 uppercase tracking-widest font-bold transition-all rounded-sm
                  ${
                    confirmText === "CONFIRM" && deletePasscode && !isDeleting
                      ? "bg-red-500 text-black hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer"
                      : "bg-red-500/10 text-red-500/50 border border-red-500/20 cursor-not-allowed"
                  }
                `}
              >
                {isDeleting ? "Purging..." : "Abort Protocol"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
