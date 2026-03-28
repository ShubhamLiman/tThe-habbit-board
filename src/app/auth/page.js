"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; // Added useRouter
import { supabase } from "../../lib/supeabase"; // Import the database bridge

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter(); // Initialize router for redirecting after login

  const [isLogin, setIsLogin] = useState(true);

  // --- NEW: FORM STATE ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [operativeName, setOperativeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "register") {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [searchParams]);

  // --- NEW: THE AUTHENTICATION ENGINE ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isLogin) {
        // === LOGIN SEQUENCE ===
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Success! Teleport to Command Center
        router.push("/dashboard");
      } else {
        // === REGISTRATION SEQUENCE ===
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              operative_name: operativeName,
            },
            // NEW: Tell Supabase where to redirect the user after clicking the email link
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;

        // NEW: Security check for duplicate sign-ups
        if (
          data.user &&
          data.user.identities &&
          data.user.identities.length === 0
        ) {
          throw new Error(
            "This operative is already registered but unverified. Check your inbox.",
          );
        }

        // NEW: If session is null, Supabase is waiting for the email click
        if (!data.session) {
          setSuccessMsg(
            "MISSION UPDATE: Verification link sent. Check your email to authorize this device.",
          );
          setIsLogin(true); // Flip them back to the login screen
          setPassword(""); // Clear password for security
          return;
        }

        // Fallback: If verification gets turned off in the future, just log them in
        router.push("/dashboard");
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-sm shadow-2xl p-8 relative z-10">
      <div className="mb-10 text-center">
        <h1 className="font-oswald text-4xl md:text-5xl antialiased italic font-bold text-gray-900 dark:text-white uppercase tracking-tight">
          {isLogin ? "Enter The " : "Initialize "}
          <span className="text-blue-500 dark:text-cyan-500">
            {isLogin ? "System" : "Sequence"}
          </span>
        </h1>
        <p className="font-oswald text-gray-500 dark:text-gray-400 italic mt-2 tracking-widest uppercase text-sm">
          {isLogin ? "Resume your discipline." : "Start your 21-day rewrite."}
        </p>
      </div>

      {/* --- NEW: HUD ALERTS (Errors & Success) --- */}
      {errorMsg && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500 rounded-sm text-center animate-pulse">
          <p className="text-red-500 font-oswald italic font-bold text-sm tracking-widest uppercase">
            {errorMsg}
          </p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-3 bg-green-500/10 border border-green-500 rounded-sm text-center">
          <p className="text-green-500 font-oswald italic font-bold text-sm tracking-widest uppercase">
            {successMsg}
          </p>
        </div>
      )}

      {/* Wired up onSubmit to handleAuth */}
      <form className="flex flex-col gap-6" onSubmit={handleAuth}>
        {!isLogin && (
          <div className="flex flex-col">
            <label className="font-oswald text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase">
              Operative_Name
            </label>
            <input
              type="text"
              required={!isLogin}
              value={operativeName}
              onChange={(e) => setOperativeName(e.target.value)}
              placeholder="John Doe"
              className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
            />
          </div>
        )}

        <div className="flex flex-col">
          <label className="font-oswald text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase">
            Email_Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@system.com"
            className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex flex-col">
          <label className="font-oswald text-sm text-gray-500 dark:text-gray-400 italic mb-1 uppercase">
            Passcode
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-transparent border-b-2 border-gray-300 dark:border-gray-800 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`mt-4 w-full py-4 font-oswald text-xl italic font-bold uppercase rounded-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:shadow-[0_0_15px_rgba(6,182,212,0.3)] ${
            loading
              ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "bg-blue-500 dark:bg-cyan-500 text-white dark:text-black hover:bg-blue-600 dark:hover:bg-cyan-400 hover:scale-[1.02] cursor-pointer"
          }`}
        >
          {loading
            ? "Processing..."
            : isLogin
              ? "Authenticate"
              : "Commit_To_System"}
        </button>
      </form>

      <div className="mt-8 text-center border-t border-gray-100 dark:border-gray-900 pt-6">
        <p className="text-gray-600 dark:text-gray-400 font-oswald italic">
          {isLogin
            ? "Don't have clearance yet?"
            : "Already part of the system?"}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="ml-2 text-blue-500 dark:text-cyan-500 hover:text-blue-600 dark:hover:text-cyan-400 font-bold tracking-wide transition-colors cursor-pointer focus:outline-none"
          >
            {isLogin ? "Register_Now" : "Login_Here"}
          </button>
        </p>
      </div>
    </div>
  );
}

// Your exact wrapper remains completely untouched
export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-blue-500/10 dark:bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <a
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-cyan-500 transition-colors font-oswald text-lg italic tracking-wide cursor-pointer z-10"
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
        Back_to_Base
      </a>

      <Suspense
        fallback={
          <div className="text-cyan-500 font-oswald text-xl italic animate-pulse">
            Initializing System...
          </div>
        }
      >
        <AuthContent />
      </Suspense>
    </div>
  );
}
