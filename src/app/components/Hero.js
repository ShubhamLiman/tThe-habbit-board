import Link from "next/link";
import RotatingQuotes from "./Rotating_quotes";
function Hero() {
  return (
    <div className="min-h-screen bg-white dark:bg-black p-5 flex flex-col justify-center items-center gap-16 py-20">
      <div className="flex flex-col justify-center items-center gap-4 text-center">
        <h1 className="font-oswald text-5xl md:text-7xl antialiased italic font-bold tracking-tight">
          <span className="text-blue-500 dark:text-cyan-500">BUILD HABITS</span>
          <span className="text-gray-900 dark:text-white"> THE RIGHT WAY</span>
        </h1>
        <RotatingQuotes />
      </div>

      <div className="flex flex-col justify-center items-center gap-8 text-center mt-4">
        <h2 className="font-oswald text-7xl md:text-9xl antialiased italic font-bold drop-shadow-lg">
          <span className="text-blue-500 dark:text-cyan-500">21 DAYS </span>
          <span className="text-gray-900 dark:text-white">IS ALL YOU NEED</span>
        </h2>

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {[...Array(21)].map((_, i) => (
              <div
                key={i}
                className={`w-6 h-6 md:w-8 md:h-8 rounded-sm border-2 transition-all duration-300 ${
                  i < 5
                    ? "bg-blue-500 border-blue-500 dark:bg-cyan-500 dark:border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    : "bg-transparent border-gray-300 dark:border-gray-800"
                }`}
              ></div>
            ))}
          </div>
          <p className="font-oswald text-sm md:text-base text-gray-500 dark:text-gray-400 italic uppercase tracking-widest mt-2">
            A year from now, you will wish you had started today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
        <div className="flex flex-col items-center text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:border-blue-500 dark:hover:border-cyan-500 transition-colors">
          <span className="font-oswald text-4xl font-bold text-gray-200 dark:text-gray-800 mb-2">
            01
          </span>
          <h3 className="font-oswald text-xl italic font-bold text-gray-900 dark:text-white mb-2 uppercase">
            Start Small
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Pick one single keystone habit. Do not overwhelm the system.
          </p>
        </div>

        <div className="flex flex-col items-center text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:border-blue-500 dark:hover:border-cyan-500 transition-colors">
          <span className="font-oswald text-4xl font-bold text-gray-200 dark:text-gray-800 mb-2">
            02
          </span>
          <h3 className="font-oswald text-xl italic font-bold text-gray-900 dark:text-white mb-2 uppercase">
            Track Daily
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Log your progress ruthlessly. What gets measured, gets managed.
          </p>
        </div>

        <div className="flex flex-col items-center text-center p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:border-blue-500 dark:hover:border-cyan-500 transition-colors">
          <span className="font-oswald text-4xl font-bold text-gray-200 dark:text-gray-800 mb-2">
            03
          </span>
          <h3 className="font-oswald text-xl italic font-bold text-gray-900 dark:text-white mb-2 uppercase">
            Wire the Brain
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Hit the 21-day mark. Shift from conscious effort to automatic
            routine.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-6 mt-16 pt-12 border-t border-gray-200 dark:border-gray-800 w-full max-w-4xl text-center">
        <h2 className="font-oswald text-4xl md:text-5xl antialiased italic font-bold text-gray-900 dark:text-white uppercase tracking-tight">
          Ready to start your{" "}
          <span className="text-blue-500 dark:text-cyan-500">Journey?</span>
        </h2>

        <p className="font-oswald text-lg md:text-xl text-gray-500 dark:text-gray-400 italic">
          Take the first step towards building unbreakable discipline today.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 mt-4 w-full sm:w-auto font-oswald text-lg antialiased italic font-bold">
          <Link
            href="/auth?mode=login"
            className="px-10 py-3 bg-blue-500 dark:bg-cyan-500 text-white dark:text-black rounded-sm hover:bg-blue-600 dark:hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-105 w-full sm:w-auto"
          >
            Register
          </Link>

          <Link
            href="/auth?mode=register"
            className="px-10 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-md w-full sm:w-auto"
          >
            Login
          </Link>
        </div>
      </div>

      <section
        id="philosophy"
        className="py-24 px-6 lg:px-12 bg-gray-50 dark:bg-gray-950 min-h-[70vh] flex flex-col justify-center items-center border-t border-gray-200 dark:border-gray-900"
      >
        <div className="max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center">
          <div className="w-full md:w-1/2 text-center md:text-left">
            <h2 className="font-oswald text-6xl md:text-8xl antialiased italic font-bold text-gray-200 dark:text-gray-800/50 uppercase tracking-tighter leading-none mb-[-20px] md:mb-[-30px] relative z-0">
              Mindset
            </h2>
            <h3 className="font-oswald text-4xl md:text-5xl antialiased italic font-bold text-gray-900 dark:text-white uppercase relative z-10">
              Motivation is a <br />
              <span className="text-blue-500 dark:text-cyan-500">
                Volatile Variable.
              </span>
            </h3>
          </div>

          <div className="w-full md:w-1/2 flex flex-col gap-6 text-lg text-gray-700 dark:text-gray-300 font-oswald">
            <p>
              Motivation relies on how you feel. It requires inspiration, high
              energy, and perfect conditions. But feelings are fleeting, and
              conditions are rarely perfect.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white font-oswald text-xl tracking-wide">
                Discipline is a constant.
              </strong>
            </p>
            <p>
              It is the act of executing the task regardless of the internal
              state.{" "}
              <span className="font-bold text-blue-400 dark:text-cyan-400">
                The_Habit_board
              </span>{" "}
              is engineered for those ready to stop waiting for inspiration and
              start building a deterministic system for their life.
            </p>
          </div>
        </div>
      </section>

      <section
        id="method"
        className="py-24 px-6 lg:px-12 bg-white dark:bg-black min-h-screen flex flex-col items-center font-oswald"
      >
        <div className="text-center mb-20">
          <h2 className="font-oswald text-5xl md:text-6xl antialiased italic font-bold text-gray-900 dark:text-white uppercase tracking-tight">
            The <span className="text-blue-500 dark:text-cyan-500">Method</span>
          </h2>
          <p className="font-oswald text-xl text-gray-500 dark:text-gray-400 italic mt-4 uppercase tracking-widest">
            Execute the algorithm.
          </p>
        </div>

        <div className="max-w-3xl w-full relative">
          <div className="hidden md:block absolute left-8 top-0 bottom-0 w-1 bg-gray-200 dark:bg-gray-800 z-0"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-12 mb-16 group">
            <div className="shrink-0 w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center font-oswald text-2xl font-bold text-gray-900 dark:text-white group-hover:border-blue-500 dark:group-hover:border-cyan-500 group-hover:text-blue-500 dark:group-hover:text-cyan-500 transition-colors shadow-lg">
              01
            </div>
            <div className="flex flex-col pt-2">
              <h3 className="font-oswald text-2xl md:text-3xl italic font-bold text-gray-900 dark:text-white uppercase mb-3">
                The Keystone Input{" "}
                <span className="text-blue-500 dark:text-cyan-500 text-lg md:text-xl ml-2">
                  (Start Small)
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                Do not overwhelm the system with massive changes. Define a
                single, atomic habit. Whether it is 10 pushups or reading 5
                pages, set the baseline so low that failure is mathematically
                impossible.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-12 mb-16 group">
            <div className="shrink-0 w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center font-oswald text-2xl font-bold text-gray-900 dark:text-white group-hover:border-blue-500 dark:group-hover:border-cyan-500 group-hover:text-blue-500 dark:group-hover:text-cyan-500 transition-colors shadow-lg">
              02
            </div>
            <div className="flex flex-col pt-2">
              <h3 className="font-oswald text-2xl md:text-3xl italic font-bold text-gray-900 dark:text-white uppercase mb-3">
                Continuous Feedback{" "}
                <span className="text-blue-500 dark:text-cyan-500 text-lg md:text-xl ml-2">
                  (Track Daily)
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                What gets measured, gets managed. Log your outputs ruthlessly.
                The visual feedback of a growing streak triggers a psychological
                resistance to breaking the chain.
              </p>
            </div>
          </div>

          {/* Step 03 */}
          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-12 group">
            <div className="shrink-0 w-16 h-16 rounded-full bg-blue-500 dark:bg-cyan-500 border-2 border-blue-500 dark:border-cyan-500 flex items-center justify-center font-oswald text-2xl font-bold text-white dark:text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              03
            </div>
            <div className="flex flex-col pt-2">
              <h3 className="font-oswald text-2xl md:text-3xl italic font-bold text-gray-900 dark:text-white uppercase mb-3">
                The Neural Rewrite{" "}
                <span className="text-blue-500 dark:text-cyan-500 text-lg md:text-xl ml-2">
                  (Wire the Brain)
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                Hit 21 consecutive iterations. By forcing the repetition, you
                shift the behavior from conscious, high-friction effort to
                automatic, low-friction execution. The habit becomes hardcoded.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Hero;
