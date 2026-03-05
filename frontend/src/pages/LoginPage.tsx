import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { YEAR_OF_STUDY_OPTIONS, INDIAN_STATES, ASPIRATION_OPTIONS, INTEREST_SUGGESTIONS, DEGREE_OPTIONS } from "../lib/constants";
import { ArrowLeft } from "lucide-react";

const STEPS = ["Account", "About You", "Interests"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && (
            <div className={`h-0.5 w-8 rounded-full transition-colors duration-300 ${i <= current ? "bg-brand-500" : "bg-stone-200"}`} />
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current ? "bg-brand-600 text-white" :
              i === current ? "bg-brand-600 text-white shadow-glow" :
              "bg-stone-200 text-stone-400"
            }`}>
              {i < current ? "\u2713" : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block transition-colors ${i <= current ? "text-brand-600" : "text-stone-400"}`}>
              {label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1: credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: profile basics
  const [firstName, setFirstName] = useState("");
  const [academicBackground, setAcademicBackground] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [userState, setUserState] = useState("");

  // Step 3: interests
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [aspirations, setAspirations] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addSkill = () => {
    const tag = skillInput.trim();
    if (tag && !skills.includes(tag)) setSkills([...skills, tag]);
    setSkillInput("");
  };

  const hasInterest = (interest: string) =>
    interests.some((i) => i.toLowerCase() === interest.toLowerCase());

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      const exists = prev.some((i) => i.toLowerCase() === interest.toLowerCase());
      if (exists) return prev.filter((i) => i.toLowerCase() !== interest.toLowerCase());
      return [...prev, interest];
    });
  };

  const toggleAspiration = (asp: string) => {
    setAspirations((prev) =>
      prev.includes(asp) ? prev.filter((a) => a !== asp) : [...prev, asp]
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const nextEmail = String(formData.get("email") || email);
      const nextPassword = String(formData.get("password") || password);
      if (nextEmail !== email) setEmail(nextEmail);
      if (nextPassword !== password) setPassword(nextPassword);
      await login(nextEmail, nextPassword);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (step === 0) {
        const form = e.currentTarget as HTMLFormElement;
        const formData = new FormData(form);
        const nextEmail = String(formData.get("email") || email);
        const nextPassword = String(formData.get("password") || password);
        if (nextEmail !== email) setEmail(nextEmail);
        if (nextPassword !== password) setPassword(nextPassword);
        if (!nextEmail || !nextPassword) {
          setError("Email and password are required");
          return;
        }
        setStep(1);
      } else if (step === 1) {
        setStep(2);
      } else if (step === 2) {
        if (!password) {
          setError("Password is required");
          return;
        }
        await register({
          email,
          password,
          first_name: firstName,
          academic_background: academicBackground,
          year_of_study: yearOfStudy,
          state: userState,
          skills,
          interests,
          aspirations,
        });
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setStep(0);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 px-4 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-brand-400 rounded-full opacity-20 blur-3xl" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-400 rounded-full opacity-15 blur-3xl" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display gradient-text mb-1">SOIP</h1>
          <p className="text-stone-400 text-sm font-medium">Opportunity Radar</p>
        </div>

        {/* Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/30 p-8">
          {isRegister && <StepIndicator current={step} />}

          <h2 className="text-xl font-bold text-stone-900 mb-1 font-display">
            {isRegister
              ? step === 0 ? "Create Your Account" : step === 1 ? "Tell Us About You" : "Your Interests"
              : "Welcome Back"}
          </h2>
          <p className="text-stone-400 text-sm mb-6">
            {isRegister
              ? step === 0 ? "Create your account to get started." : step === 1 ? "This helps us personalize opportunities for you." : "Almost there—choose what interests you most."
              : "Sign in to your account."}
          </p>

          {/* Back button for steps 2-3 */}
          {isRegister && step > 0 && (
            <button
              onClick={() => { setStep(step - 1); setError(""); }}
              className="flex items-center gap-1 text-sm text-stone-400 hover:text-brand-600 mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {/* LOGIN FORM */}
          {!isRegister && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Email</label>
                <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50"
                  placeholder="you@university.edu" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Password</label>
                <input name="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50"
                  placeholder="min 8 characters" />
              </div>
              {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50">
                {loading ? "Please wait..." : "Sign In"}
              </button>
            </form>
          )}

          {/* REGISTER STEP 0: Credentials */}
          {isRegister && step === 0 && (
            <form onSubmit={handleRegisterStep} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Email</label>
                <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50"
                  placeholder="you@university.edu" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Password</label>
                <input name="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 bg-white/50"
                  placeholder="min 8 characters" />
              </div>
              {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50">
                {loading ? "Creating account..." : "Next"}
              </button>
            </form>
          )}

          {/* REGISTER STEP 1: Profile basics */}
          {isRegister && step === 1 && (
            <form onSubmit={handleRegisterStep} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">First Name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                  placeholder="What should we call you?" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Academic Background</label>
                <select required value={academicBackground} onChange={(e) => setAcademicBackground(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50">
                  <option value="">Select degree...</option>
                  {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Year of Study</label>
                <select required value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50">
                  <option value="">Select year...</option>
                  {YEAR_OF_STUDY_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">State / Location</label>
                <select required value={userState} onChange={(e) => setUserState(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50">
                  <option value="">Select state...</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50">
                Next
              </button>
            </form>
          )}

          {/* REGISTER STEP 2: Interests */}
          {isRegister && step === 2 && (
            <form onSubmit={handleRegisterStep} className="space-y-5">
              {/* Skills */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    className="flex-1 px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
                    placeholder="Type a skill and press Enter" />
                  <button type="button" onClick={addSkill}
                    className="px-4 py-2.5 bg-brand-50 text-brand-600 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-medium flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-hot">&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_SUGGESTIONS.map((i) => (
                    <button key={i} type="button" onClick={() => toggleInterest(i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        hasInterest(i)
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-stone-100 text-stone-600 hover:bg-brand-50 hover:text-brand-600"
                      }`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspirations */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">What are you looking for?</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPIRATION_OPTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                      <input type="checkbox" checked={aspirations.includes(a)} onChange={() => toggleAspiration(a)}
                        className="accent-brand-600 w-4 h-4 rounded" />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-hot bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50">
                {loading ? "Setting up..." : "Finish Registration"}
              </button>
            </form>
          )}

          {/* Toggle login/register */}
          <p className="mt-6 text-center text-sm text-stone-400">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <button onClick={switchMode} className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
              {isRegister ? "Sign In" : "Create an Account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
