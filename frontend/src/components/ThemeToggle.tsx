import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl p-1">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-lg transition-all ${
            theme === value
              ? "bg-white dark:bg-stone-700 shadow text-stone-700 dark:text-stone-100"
              : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
