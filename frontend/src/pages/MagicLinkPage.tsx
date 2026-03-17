import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { redeemMagicLink } from "../lib/api";

const attemptedTokens = new Set<string>();

export default function MagicLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setError("No token provided");
      return;
    }
    if (attemptedTokens.has(token)) return;
    attemptedTokens.add(token);

    redeemMagicLink(token)
      .then(async (res) => {
        localStorage.setItem("soip_token", res.access_token);
        await refreshUser();
        setRedeemed(true);
      })
      .catch((err) => {
        attemptedTokens.delete(token);
        setError(err.message || "Invalid or expired magic link");
      });
  }, [searchParams, refreshUser]);

  if (redeemed && user) {
    const dest = user.is_onboarded ? "/dashboard" : "/onboarding";
    return <Navigate to={dest} replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-800 mb-2">Link Error</h1>
          <p className="text-stone-500">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-stone-400">Verifying your magic link...</p>
      </div>
    </div>
  );
}
