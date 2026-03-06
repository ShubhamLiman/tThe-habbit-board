"use client";
import React, { useState, useEffect } from "react";

const quotes = [
  "Habits are built with discipline, not motivation",
  "We are what we repeatedly do",
  "First we make our habits, then our habits make us",
  "Suffer the pain of discipline, or suffer the pain of regret",
  "Motivation gets you going, discipline keeps you growing",
];

export default function RotatingQuotes() {
  const [index, setIndex] = useState(0);

  // Track where the text currently is in the animation cycle
  // States: 'hidden-left' | 'center' | 'hidden-right'
  const [position, setPosition] = useState("hidden-left");

  useEffect(() => {
    let timeout1, timeout2, timeout3;

    const cycleQuote = () => {
      // 1. Instantly teleport the text off-screen to the left
      setPosition("hidden-left");

      // 2. A tiny fraction of a second later, trigger the fast slide into the center
      timeout1 = setTimeout(() => {
        setPosition("center");
      }, 50);

      // 3. Keep it in the center for 4.5 seconds, then shoot it out to the right
      timeout2 = setTimeout(() => {
        setPosition("hidden-right");
      }, 4500);

      // 4. Wait 500ms for it to fully leave the screen, then change the quote
      timeout3 = setTimeout(() => {
        setIndex((prev) => (prev + 1) % quotes.length);
      }, 5000);
    };

    // Start the first loop
    cycleQuote();

    // Set it to repeat exactly every 5 seconds
    const interval = setInterval(cycleQuote, 5000);

    // Cleanup timers to prevent memory leaks if the component unmounts
    return () => {
      clearInterval(interval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, []);

  // Map our React states to Tailwind classes
  let animationClasses = "";
  if (position === "hidden-left") {
    // -translate-x-[100vw] pushes it completely off the left side of the screen.
    // Notice there is NO 'transition' class here, so it teleports instantly.
    animationClasses = "-translate-x-[100vw] opacity-0";
  } else if (position === "center") {
    // translate-x-0 brings it to the middle.
    // ease-out makes it "brake" smoothly as it arrives. duration-300 makes it fast (0.3s).
    animationClasses =
      "translate-x-0 opacity-100 transition-all duration-300 ease-out";
  } else if (position === "hidden-right") {
    // translate-x-[100vw] shoots it completely off the right side of the screen.
    // ease-in makes it accelerate like a car driving away.
    animationClasses =
      "translate-x-[100vw] opacity-0 transition-all duration-300 ease-in";
  }

  return (
    // We use 'relative' and 'overflow-hidden' on the parent container
    // to ensure the sliding text doesn't cause horizontal scrollbars on the page.
    <div className="h-16 md:h-10 w-full relative flex items-center justify-center overflow-hidden">
      <p
        className={`absolute font-oswald text-lg md:text-2xl antialiased italic font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase text-center w-full px-4 ${animationClasses}`}
      >
        {quotes[index]}
      </p>
    </div>
  );
}
