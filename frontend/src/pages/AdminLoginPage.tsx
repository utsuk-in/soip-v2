import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { adminRegister, login as apiLogin, getMe, getUniversities, type University } from "../lib/api";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") navigate("/admin/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    getUniversities().then(setUniversities).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        // Cookie is set by the backend response (Set-Cookie header)
        await adminRegister({ email, password, first_name: firstName, invite_code: inviteCode, university_id: universityId });
      } else {
        // Cookie is set by the backend response for admin users
        await apiLogin(email, password);
      }
      const me = await getMe();
      if (me.role !== "admin") {
        setError("This account does not have admin access");
        return;
      }
      await refreshUser();
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display gradient-text">Steppd Admin</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">University administration panel</p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-stone-200 dark:border-stone-700 p-6">
          <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === m ? "bg-white dark:bg-stone-700 shadow text-brand-700 dark:text-brand-400" : "text-stone-500 dark:text-stone-400"}`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <input
                  type="text" placeholder="Full Name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
                />
                <input
                  type="text" placeholder="Invite Code" value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
                />
                <select
                  value={universityId} onChange={(e) => setUniversityId(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
                >
                  <option value="">Select University</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </>
            )}
            <input
              type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
            />

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
