import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, login as apiLogin, register as apiRegister, type User, type RegisterData } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = sessionStorage.getItem("soip_admin_token") || localStorage.getItem("soip_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      sessionStorage.removeItem("soip_admin_token");
      localStorage.removeItem("soip_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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

  const logout = () => {
    sessionStorage.removeItem("soip_admin_token");
    localStorage.removeItem("soip_token");
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
