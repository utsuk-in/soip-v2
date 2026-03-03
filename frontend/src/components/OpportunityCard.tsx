import React from "react";
import { Calendar, ExternalLink } from "lucide-react";
import type { Opportunity } from "../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  hackathon: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300",
  grant: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  fellowship: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  internship: "bg-accent-100 text-accent-800 dark:bg-accent-900/30 dark:text-accent-300",
  competition: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  scholarship: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  program: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  other: "bg-surface-muted text-content-secondary",
};

function deadlineLabel(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "Expired", urgent: true };
  if (days === 0) return { text: "Today!", urgent: true };
  if (days === 1) return { text: "Tomorrow", urgent: true };
  if (days <= 7) return { text: `${days} days left`, urgent: true };
  if (days <= 30) return { text: `${days} days left`, urgent: false };
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
      className={`bg-surface rounded-2xl border border-line hover:border-brand-300 hover:shadow-lg transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${compact ? "p-3" : "p-5"} animate-fade-in`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {opp.category}
        </span>
        {dl && (
          <span className={`flex items-center gap-1 text-xs font-medium ${dl.urgent ? "text-red-600" : "text-content-tertiary"}`}>
            <Calendar size={12} />
            {dl.text}
          </span>
        )}
      </div>

      <h3 className={`font-semibold text-content ${compact ? "text-sm" : "text-base"} line-clamp-2 mb-1`}>
        {opp.title}
      </h3>

      {!compact && (
        <p className="text-sm text-content-tertiary line-clamp-2 mb-3">{opp.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {(opp.domain_tags || []).slice(0, 4).map((tag) => (
          <span key={tag} className="px-1.5 py-0.5 bg-surface-muted text-content-secondary rounded text-[11px] font-medium">
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
          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-medium"
        >
          Visit <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
