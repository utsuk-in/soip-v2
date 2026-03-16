import React from "react";
import { Sparkles, ExternalLink, Calendar } from "lucide-react";
import type { Opportunity } from "../../lib/api";
import { CATEGORY_GRADIENTS } from "../../lib/constants";

interface Props {
  opportunity: Opportunity;
  onClick: () => void;
}

export default function FeaturedCard({ opportunity: opp, onClick }: Props) {
  const gradient = CATEGORY_GRADIENTS[opp.category] || CATEGORY_GRADIENTS.other;

  const daysLeft = opp.deadline
    ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl border border-white/30 dark:border-stone-800/60 bg-white/70 dark:bg-stone-900/70 backdrop-blur cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-500/15 transition-all group"
    >
      {/* Gradient top bar */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 px-3 py-1 rounded-full">
            <Sparkles size={12} />
            Top Pick for You
          </span>
          {daysLeft !== null && daysLeft >= 0 && (
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${daysLeft <= 7 ? "text-hot bg-hot/10" : "text-stone-500 bg-stone-100 dark:bg-stone-800"}`}>
              <Calendar size={12} />
              {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d left`}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-display mb-2 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
          {opp.title}
        </h3>

        <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-3 mb-4">
          {opp.description}
        </p>

        {opp.relevance_explanation && (
          <p className="text-xs italic text-brand-700/80 dark:text-brand-200/80 bg-brand-50/70 dark:bg-brand-900/30 px-3 py-2 rounded-lg mb-4 line-clamp-2">
            {opp.relevance_explanation}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {(opp.domain_tags || []).slice(0, 5).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-[11px] font-medium">
              {tag}
            </span>
          ))}
        </div>

        <a
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 font-semibold"
        >
          View application <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
