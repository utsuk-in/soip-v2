import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getMe, login as apiLogin, register as apiRegister, adminLogout, type User, type RegisterData } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void | Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refreshUser = useCallback(async () => {
    const onAdmin = window.location.pathname.startsWith("/admin");

    // Student auth: check localStorage token. Admin auth: cookie is sent automatically.
    if (!onAdmin && !localStorage.getItem("soip_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      if (!onAdmin) {
        localStorage.removeItem("soip_token");
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run refreshUser when the route changes (e.g., switching between admin and student contexts)
  useEffect(() => {
    refreshUser();
  }, [location.pathname, refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem("soip_token", res.access_token);
    await refreshUser();
  };

  const register = async (data: RegisterData) => {
    const res = await apiRegister(data);
    localStorage.setItem("soip_token", res.access_token);
    await refreshUser();
  };

  const logout = async () => {
    if (window.location.pathname.startsWith("/admin")) {
      await adminLogout().catch(() => {});
    } else {
      localStorage.removeItem("soip_token");
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
