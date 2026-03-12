import React from "react";
import { Calendar, ExternalLink } from "lucide-react";
import type { Opportunity } from "../lib/api";
import { CATEGORY_COLORS } from "../lib/constants";

function deadlineLabel(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "expired", urgent: true };
  if (days === 0) return { text: "today!", urgent: true };
  if (days === 1) return { text: "tomorrow", urgent: true };
  if (days <= 7) return { text: `${days}d left`, urgent: true };
  if (days <= 30) return { text: `${days}d left`, urgent: false };
  return { text: new Date(deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" }), urgent: false };
}

interface Props {
  opportunity: Opportunity;
  onClick?: () => void;
  compact?: boolean;
}

export default function OpportunityCard({ opportunity: opp, onClick, compact }: Props) {
  const dl = deadlineLabel(opp.deadline);
  const colorClass = CATEGORY_COLORS[opp.category] || CATEGORY_COLORS.other;

  return (
    <div
      onClick={onClick}
      className={`bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-white/30 dark:border-stone-800/60 rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10 transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${compact ? "p-3" : "p-5"} animate-fade-in`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${colorClass}`}>
          {opp.category}
        </span>
        {dl && (
          <span className={`flex items-center gap-1 text-xs font-medium ${dl.urgent ? "text-hot bg-hot/10 px-2 py-0.5 rounded-full" : "text-stone-500"}`}>
            <Calendar size={12} />
            {dl.text}
          </span>
        )}
      </div>

      <h3 className={`font-semibold text-stone-900 dark:text-stone-100 ${compact ? "text-sm" : "text-base"} line-clamp-2 mb-1`}>
        {opp.title}
      </h3>

      {!compact && (
        <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-3">{opp.description}</p>
      )}

      {opp.relevance_explanation && (
        <p
          className={`text-xs italic text-brand-700/80 dark:text-brand-200/80 bg-brand-50/70 dark:bg-brand-900/30 px-2 py-1.5 rounded-lg ${
            compact ? "mb-2" : "mb-3"
          } line-clamp-3`}
        >
          {opp.relevance_explanation}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {(opp.domain_tags || []).slice(0, 4).map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-[11px] font-medium">
            {tag}
          </span>
        ))}
      </div>

      {!compact && (
        <a
          href={opp.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 font-semibold"
        >
          View application <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
