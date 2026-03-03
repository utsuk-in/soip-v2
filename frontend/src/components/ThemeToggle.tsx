import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeChoice } from "../lib/theme";

const OPTIONS: { value: ThemeChoice; icon: React.ElementType; label: string }[] = [
  { value: "light",  icon: Sun,     label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark",   icon: Moon,    label: "Dark" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-surface-muted rounded-lg p-1 gap-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            theme === value
              ? "bg-surface text-content shadow-sm"
              : "text-content-muted hover:text-content-secondary"
          }`}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
