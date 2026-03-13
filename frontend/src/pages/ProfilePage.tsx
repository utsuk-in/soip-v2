import React from "react";
import { useAuth } from "../lib/auth";
import useProfileForm from "../hooks/useProfileForm";
import { YEAR_OF_STUDY_OPTIONS, INDIAN_STATES, ASPIRATION_OPTIONS, INTEREST_SUGGESTIONS } from "../lib/constants";

export default function ProfilePage() {
  const { user } = useAuth();
  const form = useProfileForm(user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submitProfile();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 py-10 px-4 relative overflow-hidden">
      <div className="absolute top-20 -left-32 w-96 h-96 bg-brand-400 rounded-full opacity-20 blur-3xl dark:opacity-10" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-400 rounded-full opacity-15 blur-3xl dark:opacity-10" />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-display">Update Your Profile</h1>
          <p className="text-stone-400 dark:text-stone-500">A stronger profile enables better recommendations.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/30 dark:border-stone-800/60 p-8 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">First Name</label>
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Academic Background</label>
            <input
              type="text"
              required
              value={form.academicBackground}
              onChange={(e) => form.setAcademicBackground(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
              placeholder="e.g., B.Tech Computer Science, MBA"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Year of Study</label>
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">State / Location</label>
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Skills</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.skillInput}
                onChange={(e) => form.setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); form.addSkill(); } }}
                className="flex-1 px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
                placeholder="Type a skill and press Enter"
              />
              <button type="button" onClick={form.addSkill}
                className="px-4 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors">Add</button>
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_SUGGESTIONS.map((i) => (
                <button key={i} type="button" onClick={() => form.toggleInterest(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    form.hasInterest(i)
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-stone-100 text-stone-500 hover:bg-brand-50 hover:text-brand-600"
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">What are you looking for?</label>
            <div className="grid grid-cols-2 gap-2">
              {ASPIRATION_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer capitalize text-stone-600 dark:text-stone-300">
                  <input type="checkbox" checked={form.aspirations.includes(a)} onChange={() => form.toggleAspiration(a)}
                    className="accent-brand-600 w-4 h-4 rounded" />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {form.error && <p className="text-sm text-hot bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{form.error}</p>}
          {form.success && <p className="text-sm text-pop bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2">{form.success}</p>}

          <button type="submit" disabled={form.loading}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50">
            {form.loading ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
