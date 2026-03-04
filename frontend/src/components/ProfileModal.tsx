import React, { useEffect } from "react";
import { useAuth } from "../lib/auth";
import useProfileForm from "../hooks/useProfileForm";
import { YEAR_OF_STUDY_OPTIONS, INDIAN_STATES, ASPIRATION_OPTIONS, INTEREST_SUGGESTIONS } from "../lib/constants";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth();
  const form = useProfileForm(user);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submitProfile();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">profile</p>
              <h2 className="text-xl font-bold text-stone-800 font-display">tune your vibe</h2>
            </div>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 px-2 py-1 transition-colors"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">first name</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => form.setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                  placeholder="what should we call you?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">academic background</label>
                <input
                  type="text"
                  required
                  value={form.academicBackground}
                  onChange={(e) => form.setAcademicBackground(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                  placeholder="e.g. B.Tech Computer Science, MBA"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">year of study</label>
                <select
                  required
                  value={form.yearOfStudy}
                  onChange={(e) => form.setYearOfStudy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                >
                  <option value="">select year...</option>
                  {YEAR_OF_STUDY_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">state / location</label>
                <select
                  required
                  value={form.userState}
                  onChange={(e) => form.setUserState(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                >
                  <option value="">select state...</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={form.skillInput}
                    onChange={(e) => form.setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); form.addSkill(); } }}
                    className="flex-1 px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                    placeholder="type a skill + enter"
                  />
                  <button type="button" onClick={form.addSkill} className="px-4 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors">
                    add
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
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_SUGGESTIONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => form.toggleInterest(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.hasInterest(i)
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-stone-100 text-stone-500 hover:bg-brand-50 hover:text-brand-600"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">looking for</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPIRATION_OPTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer capitalize text-stone-600">
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

              {form.error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{form.error}</p>}
              {form.success && <p className="text-sm text-pop bg-emerald-50 rounded-xl px-3 py-2">{form.success}</p>}
            </div>

            <div className="lg:col-span-2 flex items-center justify-between border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-400">changes sharpen your recs instantly</p>
              <button
                type="submit"
                disabled={form.loading}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50"
              >
                {form.loading ? "saving..." : "lock it in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
