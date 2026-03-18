import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import useProfileForm from "../hooks/useProfileForm";
import { ArrowLeft } from "lucide-react";
import { YEAR_OF_STUDY_OPTIONS, INDIAN_STATES, ASPIRATION_OPTIONS, INTEREST_SUGGESTIONS, DEGREE_OPTIONS } from "../lib/constants";

const STEPS = ["Account", "About You", "Interests"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && (
            <div className={`h-0.5 w-8 rounded-full transition-colors duration-300 ${i <= current ? "bg-brand-500" : "bg-stone-200 dark:bg-stone-700"}`} />
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current ? "bg-brand-600 text-white" :
              i === current ? "bg-brand-600 text-white shadow-glow" :
              "bg-stone-200 dark:bg-stone-700 text-stone-400"
            }`}>
              {i < current ? "\u2713" : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block transition-colors ${i <= current ? "text-brand-600 dark:text-brand-300" : "text-stone-400 dark:text-stone-500"}`}>
              {label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const form = useProfileForm(user, async () => {
    await refreshUser();
    navigate("/dashboard", { state: { welcome: true } });
  });

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.skills.length === 0) { setValidationError("Add at least one skill to continue."); return; }
    if (form.interests.length === 0) { setValidationError("Select at least one interest to continue."); return; }
    if (form.aspirations.length === 0) { setValidationError("Select at least one aspiration to continue."); return; }
    if (!password) { setValidationError("Set a password so you can log back in."); return; }
    if (password.length < 8) { setValidationError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setValidationError("Passwords don't match."); return; }
    setValidationError("");
    await form.submitProfile(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 px-4 py-10 relative overflow-hidden">
      <div className="absolute top-20 -left-32 w-96 h-96 bg-brand-400 rounded-full opacity-20 blur-3xl dark:opacity-10" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-400 rounded-full opacity-15 blur-3xl dark:opacity-10" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display gradient-text mb-1">Steppd</h1>
          <p className="text-stone-400 dark:text-stone-500 text-sm font-medium">Explore, Grow, Launch</p>
        </div>

        <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/30 dark:border-stone-800/60 p-8">
          <StepIndicator current={step} />

          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-1 font-display">
            {step === 0 ? "Create Your Account" : step === 1 ? "Tell Us About You" : "Your Interests"}
          </h2>
          <p className="text-stone-400 dark:text-stone-500 text-sm mb-6">
            {step === 0
              ? "Set up your name and password to continue."
              : step === 1
                ? "This helps us personalize opportunities for you."
                : "Almost there - choose what interests you most."}
          </p>

          {step > 0 && (
            <button
              onClick={() => { setStep(step - 1); setValidationError(""); }}
              className="flex items-center gap-1 text-sm text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-300 mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {step === 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.firstName.trim()) {
                  setValidationError("Please enter your first name.");
                  return;
                }
                if (!password) {
                  setValidationError("Set a password so you can log back in.");
                  return;
                }
                if (password.length < 8) {
                  setValidationError("Password must be at least 8 characters.");
                  return;
                }
                if (password !== confirmPassword) {
                  setValidationError("Passwords don't match.");
                  return;
                }
                setValidationError("");
                setStep(1);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => form.setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                  placeholder="What should we call you?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Set a Password</label>
                <p className="text-xs text-stone-400 mb-2">You'll use this to log back in next time.</p>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                  placeholder="Min 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                  placeholder="Repeat password"
                />
              </div>

              {validationError && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{validationError}</p>}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all"
              >
                Next
              </button>
            </form>
          )}

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.academicBackground || !form.yearOfStudy || !form.userState) {
                  setValidationError("Please complete all academic details to continue.");
                  return;
                }
                setValidationError("");
                setStep(2);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Academic Background</label>
                <select
                  required
                  value={form.academicBackground}
                  onChange={(e) => form.setAcademicBackground(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                >
                  <option value="">Select degree...</option>
                  {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Year of Study</label>
                <select
                  required
                  value={form.yearOfStudy}
                  onChange={(e) => form.setYearOfStudy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                >
                  <option value="">Select year...</option>
                  {YEAR_OF_STUDY_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">State / Location</label>
                <select
                  required
                  value={form.userState}
                  onChange={(e) => form.setUserState(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                >
                  <option value="">Select state...</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {validationError && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{validationError}</p>}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all"
              >
                Next
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={form.skillInput}
                    onChange={(e) => form.setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); form.addSkill(); } }}
                    className="flex-1 px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                    placeholder="Type a skill and press Enter"
                  />
                  <button
                    type="button"
                    onClick={form.addSkill}
                    className="px-4 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-medium flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => form.setSkills(form.skills.filter((x) => x !== s))} className="hover:text-hot">&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_SUGGESTIONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => form.toggleInterest(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.hasInterest(i)
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-brand-50 hover:text-brand-600"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">What are you looking for?</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPIRATION_OPTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer capitalize text-stone-700 dark:text-stone-300">
                      <input
                        type="checkbox"
                        checked={form.aspirations.includes(a)}
                        onChange={() => form.toggleAspiration(a)}
                        className="accent-brand-600 w-4 h-4 rounded"
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              {(validationError || form.error) && (
                <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{validationError || form.error}</p>
              )}

              <button
                type="submit"
                disabled={form.loading}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50"
              >
                {form.loading ? "Setting up..." : "Save and Continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
