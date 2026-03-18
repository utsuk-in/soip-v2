import React from "react";
import { MapPin, Globe } from "lucide-react";

interface ModeToggleProps {
  mode: "offline" | "online";
  onChange: (mode: "offline" | "online") => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-stone-100 dark:bg-stone-800 rounded-full p-1">
      <button
        onClick={() => onChange("offline")}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          mode === "offline"
            ? "bg-white dark:bg-stone-700 text-brand-600 dark:text-brand-300 shadow-sm"
            : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
        }`}
      >
        <MapPin size={14} /> Offline
      </button>
      <button
        onClick={() => onChange("online")}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          mode === "online"
            ? "bg-white dark:bg-stone-700 text-brand-600 dark:text-brand-300 shadow-sm"
            : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
        }`}
      >
        <Globe size={14} /> Online
      </button>
    </div>
  );
}
