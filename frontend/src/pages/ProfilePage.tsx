import React, { useEffect, useState } from "react";
import { updateProfile } from "../lib/api";
import { useAuth } from "../lib/auth";

const DEGREE_OPTIONS = ["B.Tech", "B.Sc", "M.Tech", "M.Sc", "MBA", "PhD", "Other"];

const ASPIRATION_OPTIONS = [
  "hackathons", "internships", "grants", "fellowships",
  "competitions", "scholarships", "research", "startups",
];

const INTEREST_SUGGESTIONS = [
  "AI", "Machine Learning", "Web Development", "Mobile", "Cloud",
  "Cybersecurity", "Data Science", "Blockchain", "IoT", "Robotics",
  "Climate", "Healthcare", "Fintech", "Education", "Social Impact",
];

export default function ProfilePage() {
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
    if (!user) return;
    setFirstName(user.first_name || "");
    setDegreeType(user.degree_type || "");
    setSkills(user.skills || []);
    setInterests(user.interests || []);
    setAspirations(user.aspirations || []);
  }, [user]);

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
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your profile</h1>
          <p className="text-gray-500">Update your details to improve recommendations.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="Your name"
            />
          </div>

          {/* Degree */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
            <select
              required
              value={degreeType}
              onChange={(e) => setDegreeType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            >
              <option value="">Select degree...</option>
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                placeholder="Type a skill and press Enter"
              />
              <button type="button" onClick={addSkill} className="px-4 py-2.5 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium flex items-center gap-1">
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-red-600">&times;</button>
                </span>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_SUGGESTIONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInterest(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    hasInterest(i)
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Aspirations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What are you looking for?</label>
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

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
