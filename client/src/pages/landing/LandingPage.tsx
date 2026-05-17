import React from "react";
import AuthCard from "@/components/auth/AuthCard";
import { motion } from "framer-motion";

const Illustration = () => (
  <svg
    viewBox="0 0 600 400"
    className="w-full h-auto drop-shadow-2xl"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient id="g1" x1="0" x2="1">
        <stop offset="0" stopColor="#6EE7B7" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <rect x="20" y="60" width="520" height="280" rx="18" fill="#0f172a" />
    <g transform="translate(40,80)">
      <rect width="480" height="240" rx="14" fill="#06203a" opacity="0.9" />
      <g transform="translate(24,24)">
        <rect width="360" height="28" rx="6" fill="url(#g1)" />
        <rect y="46" width="420" height="120" rx="8" fill="#071a2a" />
        <circle cx="48" cy="106" r="28" fill="#0ea5a9" />
      </g>
    </g>
  </svg>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center text-white font-bold">PP</div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">Pocket Planner</span>
        </div>
        <nav className="flex items-center gap-3">
          <button className="text-sm px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">Overview</button>
          <button className="text-sm px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">Pricing</button>
          <button className="ml-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white px-4 py-2 rounded-md shadow-md hover:scale-[1.03] transition">Get Started</button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-12 grid grid-cols-12 gap-8 items-center">
        <section className="col-span-12 lg:col-span-6 flex flex-col items-center lg:items-start bg-[#071a37] rounded-2xl p-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl text-center lg:text-left"
          >
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-white">
              Build, Deploy, and Scale Faster
            </h1>
            <p className="mt-4 text-lg text-slate-200">
              Your all-in-one PaaS platform — simple, secure, and blazing fast. Ship production
              workloads with zero hassle.
            </p>
          </motion.div>

          <div className="mt-8 w-full max-w-md">
            <AuthCard />
          </div>

          <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">Trusted by startups and enterprises</div>
        </section>

        <section className="hidden lg:flex col-span-6 items-center justify-center lg:mt-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            whileHover={{ scale: 1.02 }}
            className="w-full max-w-lg"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="rounded-tl-3xl rounded-bl-3xl rounded-br-3xl rounded-tr-none overflow-hidden border-4 border-r-0 border-black shadow-lg">
                <Illustration />
              </div>
            </motion.div>
          </motion.div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
