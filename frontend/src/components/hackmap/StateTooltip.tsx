import React from "react";

interface StateTooltipProps {
  stateName: string;
  count: number;
  x: number;
  y: number;
}

export default function StateTooltip({ stateName, count, x, y }: StateTooltipProps) {
  return (
    <div
      className="fixed z-50 pointer-events-none bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 shadow-lg animate-fade-in"
      style={{ left: x + 12, top: y - 8 }}
    >
      <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{stateName}</p>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {count > 0 ? `${count} event${count > 1 ? "s" : ""}` : "No events yet"}
      </p>
    </div>
  );
}
