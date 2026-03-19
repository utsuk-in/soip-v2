import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { forgotPassword } from "../lib/api";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get("from") === "admin";
  const backTo = isAdmin ? "/admin/login" : "/login";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("too many")) {
        setError("Too many reset requests. Please try again later.");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 px-4 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-brand-400 rounded-full opacity-20 blur-3xl dark:opacity-10" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-400 rounded-full opacity-15 blur-3xl dark:opacity-10" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display gradient-text mb-1">Steppd</h1>
          <p className="text-stone-400 dark:text-stone-500 text-sm font-medium">Explore, Grow, Launch</p>
        </div>

        {/* Card */}
        <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/30 dark:border-stone-800/60 p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-pop/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-display">Check Your Email</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
                If an account exists with <strong className="text-stone-700 dark:text-stone-300">{email}</strong>, we've sent a password reset link. It expires in 30 minutes.
              </p>
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-300 font-semibold hover:text-brand-700 dark:hover:text-brand-200 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <Link
                to={backTo}
                className="flex items-center gap-1 text-sm text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-300 mb-4 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>

              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-1 font-display">Forgot Password?</h2>
              <p className="text-stone-400 dark:text-stone-500 text-sm mb-6">
                Enter your email and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                    placeholder="you@university.edu"
                  />
                </div>
                {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
