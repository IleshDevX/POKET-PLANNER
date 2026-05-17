import React, { useState } from "react";
import { motion } from "framer-motion";

const IconEmail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5L12 13L21 8.5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="#94A3B8" strokeWidth="1.2" />
  </svg>
);

const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="10" rx="2" stroke="#94A3B8" strokeWidth="1.2" />
    <path d="M7 11V8a5 5 0 0110 0v3" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const AuthCard: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    // Hook into real auth flow
    alert(`${mode === "login" ? "Logged in" : "Signed up"}: ${form.email}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{mode === "login" ? "Login to your account" : "Create your account"}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{mode === "login" ? "Enter your credentials to continue" : "Start your free trial — no credit card required"}</p>
        </div>
        <div className="text-sm">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sky-600 dark:text-sky-400 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Email</div>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><IconEmail /></div>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-slate-800 transition"
              placeholder="you@company.com"
            />
          </div>
        </label>

        <label className="block">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Password</div>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><IconLock /></div>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-slate-800 transition"
              placeholder="Enter a strong password"
            />
          </div>
          <div className="text-right mt-2">
            <a className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Forgot password?</a>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.03] transition-transform disabled:opacity-60"
          >
            {loading ? <Spinner /> : null}
            <span>{loading ? "Please wait" : mode === "login" ? "Login" : "Create account"}</span>
          </button>
          <button
            type="button"
            onClick={() => { setForm({ email: "demo@pocketplanner.local", password: "Demo@123" }); setTimeout(() => {}, 0); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >Demo</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
          <div className="text-xs text-slate-400">or continue with</div>
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg border py-2 hover:bg-slate-50">
            <img src="https://www.svgrepo.com/show/355037/google-color.svg" alt="google" className="w-4 h-4" />
            <span className="text-sm">Google</span>
          </button>
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg border py-2 hover:bg-slate-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 22v-3a4 4 0 00-4-4H8" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-sm">GitHub</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AuthCard;
