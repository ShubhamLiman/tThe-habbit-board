"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="relative w-full z-50">
      <nav className="w-full h-20 px-6 lg:px-12 bg-white dark:bg-black flex items-center justify-between border-b border-gray-100 dark:border-gray-900 shadow-sm transition-colors duration-300 relative z-20">
        <div className="flex items-center">
          <a
            href="/"
            className="font-oswald text-3xl antialiased italic font-bold tracking-wide cursor-pointer"
          >
            <span className="text-gray-900 dark:text-white">The_Habit</span>
            <span className="text-blue-500 dark:text-cyan-500">_board</span>
          </a>
        </div>

        <div className="hidden lg:flex items-center gap-4 font-oswald text-lg antialiased italic font-bold">
          <Link
            href="/auth?mode=login"
            className="px-5 h-10 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-cyan-400 transition-colors cursor-pointer flex justify-center items-center"
          >
            Login
          </Link>
          <Link
            href="/auth?mode=register"
            className="px-6 h-10 bg-gray-900 dark:bg-white text-white dark:text-black rounded-sm hover:bg-blue-500 dark:hover:bg-cyan-500 hover:text-white transition-all shadow-md cursor-pointer flex justify-center items-center"
          >
            Sign_Up
          </Link>
        </div>

        <button
          onClick={toggleMenu}
          className="lg:hidden p-2 text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-cyan-500 transition-colors cursor-pointer focus:outline-none"
          aria-label="Toggle Menu"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      <div
        className={`lg:hidden absolute top-20 left-0 w-full bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 shadow-lg flex flex-col font-oswald text-xl italic font-bold transition-all duration-300 ease-in-out z-10 overflow-hidden ${
          isMobileMenuOpen ? "max-h-100 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col px-6 py-4 gap-4 text-gray-700 dark:text-gray-300">
          <a
            href="#philosophy"
            onClick={toggleMenu}
            className="hover:text-blue-500 dark:hover:text-cyan-400 transition-colors"
          >
            The_Philosophy
          </a>
          <a
            href="#method"
            onClick={toggleMenu}
            className="hover:text-blue-500 dark:hover:text-cyan-400 transition-colors"
          >
            The_Method
          </a>
        </div>

        <div className="h-px w-full bg-gray-200 dark:bg-gray-800"></div>

        <div className="flex flex-col px-6 py-6 gap-4">
          <Link
            href="/auth?mode=login"
            className="w-full py-3 text-center text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white rounded-sm hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Login
          </Link>
          <Link
            href="/auth?mode=register"
            className="w-full py-3 text-center bg-blue-500 dark:bg-cyan-500 text-white dark:text-black rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.4)] cursor-pointer"
          >
            Sign_Up
          </Link>
        </div>
      </div>
    </div>
  );
}
