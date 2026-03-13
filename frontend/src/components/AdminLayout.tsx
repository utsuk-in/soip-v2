import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, BarChart3, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/student_registration", icon: Upload, label: "Student Registration" },
  { to: "/admin/engagement", icon: BarChart3, label: "Engagement" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="h-screen flex bg-stone-50 dark:bg-stone-950">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-r border-stone-200/60 dark:border-stone-700/60 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center px-5 border-b border-stone-100 dark:border-stone-800">
          <div>
            <h1 className="text-xl font-bold font-display gradient-text leading-tight">SOIP</h1>
            <p className="text-[10px] font-medium text-stone-400 tracking-widest uppercase">Admin Panel</p>
          </div>
          <button type="button" title="Close menu" className="ml-auto lg:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-300" onClick={() => setSidebarOpen(false)}>
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
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border-l-2 border-brand-500 shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold">
              {(user?.first_name?.[0] || "A").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{user?.first_name || "Admin"}</p>
              <p className="text-[11px] text-stone-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-500 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border-b border-stone-200/60 dark:border-stone-700/60 flex items-center px-4 lg:px-6 gap-3">
          <button type="button" title="Open menu" className="lg:hidden text-stone-500 dark:text-stone-400" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
