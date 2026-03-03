import React, { useEffect, useState } from "react";
import { updateProfile } from "../lib/api";
import { useAuth } from "../lib/auth";

const DEGREE_OPTIONS = ["B.Tech", "B.Sc", "M.Tech", "M.Sc", "MBA", "PhD", "Other"];

const ASPIRATION_OPTIONS = [
  "hackathons", "internships", "grants", "fellowships",
  "competitions", "scholarships", "research", "startups",
];

const INTEREST_SUGGESTIONS = [
  "AI", "ML", "Data", "Robotics", "Web", "Mobile", "Cloud",
  "Security", "Blockchain", "Fintech", "Health", "Climate",
  "Education", "Social Impact", "Design", "Product", "Startup",
  "Research", "Hardware", "IoT",
];

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [degreeType, setDegreeType] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [aspirations, setAspirations] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setFirstName(user.first_name || "");
    setDegreeType(user.degree_type || "");
    setSkills(user.skills || []);
    setInterests(user.interests || []);
    setAspirations(user.aspirations || []);
    setError("");
    setSuccess("");
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addSkill = () => {
    const tag = skillInput.trim();
    if (tag && !skills.includes(tag)) {
      setSkills([...skills, tag]);
    }
    setSkillInput("");
  };

  const hasInterest = (interest: string) =>
    interests.some((i) => i.toLowerCase() === interest.toLowerCase());

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      const exists = prev.some((i) => i.toLowerCase() === interest.toLowerCase());
      if (exists) {
        return prev.filter((i) => i.toLowerCase() !== interest.toLowerCase());
      }
      return [...prev, interest];
    });
  };

  const toggleAspiration = (asp: string) => {
    setAspirations((prev) =>
      prev.includes(asp) ? prev.filter((a) => a !== asp) : [...prev, asp]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile({
        first_name: firstName,
        degree_type: degreeType,
        skills,
        interests,
        aspirations,
      });
      await refreshUser();
      setSuccess("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-line-light flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-content-muted">Profile</p>
              <h2 className="text-xl font-semibold text-content font-display">Tune your signal</h2>
            </div>
            <button
              onClick={onClose}
              className="text-content-tertiary hover:text-content-secondary px-2 py-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-content-tertiary mb-1">First name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm bg-surface text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-content-tertiary mb-1">Degree</label>
                <select
                  required
                  value={degreeType}
                  onChange={(e) => setDegreeType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="">Select degree...</option>
                  {DEGREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-content-tertiary mb-1">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    className="flex-1 px-4 py-2.5 border border-line rounded-xl text-sm bg-surface text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-300"
                    placeholder="Type a skill and press Enter"
                  />
                  <button type="button" onClick={addSkill} className="px-4 py-2.5 bg-surface-muted rounded-xl text-sm font-medium hover:bg-hover">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 rounded-full text-xs font-medium flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-red-600">&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-content-tertiary mb-2">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_SUGGESTIONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleInterest(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        hasInterest(i)
                          ? "bg-brand-600 text-white"
                          : "bg-surface-muted text-content-secondary hover:bg-hover"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-content-tertiary mb-2">Looking for</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPIRATION_OPTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                      <input
                        type="checkbox"
                        checked={aspirations.includes(a)}
                        onChange={() => toggleAspiration(a)}
                        className="accent-brand-600 w-4 h-4"
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">{error}</p>}
              {success && <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 rounded-lg px-3 py-2">{success}</p>}
            </div>

            <div className="lg:col-span-2 flex items-center justify-between border-t border-line-light pt-4">
              <p className="text-xs text-content-tertiary">Your changes sharpen recommendations instantly.</p>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
