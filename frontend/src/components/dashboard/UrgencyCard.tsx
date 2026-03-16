import React from "react";
import { Calendar } from "lucide-react";
import type { Opportunity } from "../../lib/api";
import { CATEGORY_COLORS } from "../../lib/constants";

interface Props {
  opportunity: Opportunity;
  onClick: () => void;
}

export default function UrgencyCard({ opportunity: opp, onClick }: Props) {
  const colorClass = CATEGORY_COLORS[opp.category] || CATEGORY_COLORS.other;
  const daysLeft = opp.deadline
    ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-72 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-accent-200/50 dark:border-accent-800/40 rounded-2xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-500/10 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${colorClass}`}>
          {opp.category}
        </span>
        {daysLeft !== null && daysLeft >= 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-hot bg-hot/10 px-2 py-0.5 rounded-full">
            <Calendar size={11} />
            {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "1d" : `${daysLeft}d`}
          </span>
        )}
      </div>

      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 line-clamp-2 mb-1.5">
        {opp.title}
      </h4>

      <p className="text-xs text-stone-400 dark:text-stone-500 line-clamp-2">
        {opp.description}
      </p>
    </div>
  );
}
