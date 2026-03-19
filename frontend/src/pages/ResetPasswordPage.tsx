import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../lib/api";
import { ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/30 dark:border-stone-800/60 p-8">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-display">Invalid Link</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">
              This password reset link is invalid or missing a token. Please request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-300 font-semibold hover:text-brand-700 dark:hover:text-brand-200 transition-colors"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-pop/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-display">Password Reset!</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="inline-block w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm text-center hover:shadow-lg hover:shadow-brand-500/25 transition-all"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-1 text-sm text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-300 mb-4 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>

              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-1 font-display">Set New Password</h2>
              <p className="text-stone-400 dark:text-stone-500 text-sm mb-6">
                Choose a new password for your account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                    placeholder="min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                    placeholder="re-enter your password"
                  />
                </div>
                {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
