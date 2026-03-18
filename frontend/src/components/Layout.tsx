import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Map, Search, MessageSquare, Bell, Menu, X, Sparkles, Moon, Sun } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getAlerts, type Alert } from "../lib/api";
import ProfileModal from "./ProfileModal";
import BrandLogo from "./BrandLogo";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/hackmap", icon: Map, label: "HackMap" },
  { to: "/browse", icon: Search, label: "Browse" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("soip_theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = (stored as "light" | "dark" | null) || (prefersDark ? "dark" : "light");
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("soip_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  useEffect(() => {
    getAlerts().then(setAlerts).catch(() => {});
  }, []);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="h-screen flex bg-stone-50 dark:bg-stone-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-r border-stone-200/60 dark:border-stone-800/60 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-20 flex items-center px-5 border-b border-stone-100 dark:border-stone-800">
          <BrandLogo className="h-14 w-auto" showTagline />
          <button className="ml-auto lg:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-200" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500 shadow-sm dark:bg-stone-800/60 dark:text-brand-200"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-stone-100"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-brand-200" />
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">Signal</p>
            </div>
            <p className="text-sm font-medium mb-3 leading-snug">Sharper profiles lead to better matches.</p>
            <button
              onClick={() => setProfileOpen(true)}
              className="w-full text-xs font-semibold uppercase tracking-wide bg-white/20 hover:bg-white/30 text-white rounded-xl py-2 transition-colors"
            >
              Update Profile
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 relative z-30 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border-b border-stone-200/60 dark:border-stone-800/60 flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden text-stone-500 dark:text-stone-300" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            className="p-2 text-stone-400 hover:text-stone-600 dark:text-stone-300 dark:hover:text-stone-100 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => navigate("/alerts")}
            className="relative p-2 text-stone-400 hover:text-stone-600 dark:text-stone-300 dark:hover:text-stone-100 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-hot text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                {(user?.first_name?.[0] || user?.email?.[0] || "?").toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 leading-tight">{user?.first_name || "Student"}</p>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-tight">{user?.academic_background || "Profile"}</p>
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800">
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{user?.email}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{user?.academic_background || "Complete your profile"}</p>
                </div>
                <button
                  onClick={() => { setProfileOpen(true); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-600 dark:text-stone-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors"
                >
                  Update Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-hot hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
