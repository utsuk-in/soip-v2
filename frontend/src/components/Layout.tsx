import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Search, MessageSquare, Bell, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getAlerts, type Alert } from "../lib/api";
import ProfileModal from "./ProfileModal";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
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
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    <div className="h-screen flex bg-[#f6f4ef]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 backdrop-blur border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <span className="text-xl font-semibold text-slate-900 font-display">SOIP</span>
          <span className="ml-2 text-xs text-slate-400 font-medium tracking-widest">STUDIO</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-100/70 text-brand-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Signal</p>
            <p className="text-sm font-medium text-slate-900 mt-1">Sharper matches unlock faster.</p>
            <button
              onClick={() => setProfileOpen(true)}
              className="mt-3 w-full text-xs font-semibold uppercase tracking-wide bg-brand-600 text-white rounded-lg py-2 hover:bg-brand-700"
            >
              Edit profile
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center px-4 lg:px-8 gap-4">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <div className="hidden md:block">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Discover</p>
              <p className="text-sm text-slate-600">New opportunities curated for your ambitions.</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/alerts")}
            className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-sm font-semibold">
                {(user?.first_name?.[0] || user?.email?.[0] || "?").toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-900 leading-tight">{user?.first_name || "Student"}</p>
                <p className="text-xs text-slate-400 leading-tight">{user?.degree_type || "Profile"}</p>
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.degree_type || "Complete your profile"}</p>
                </div>
                <button
                  onClick={() => { setProfileOpen(true); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Edit profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
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
