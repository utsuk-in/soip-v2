import React, { useState } from "react";
import { Calendar, MapPin, User2, IndianRupee, Info, Gift } from "lucide-react";
import type { Opportunity } from "../lib/api";
import { CATEGORY_COLORS } from "../lib/constants";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/[_~`>]/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function briefDescription(text: string): string {
  let clean = stripMarkdown(text);

  // Strip common filler prefixes like "Event Overview:" or "About the program:"
  clean = clean.replace(/^(event\s+overview|about(\s+the)?(\s+\w+)?|overview|description|summary)\s*[:–—-]\s*/i, "");

  // Collect up to 2 sentences that fit within ~200 chars
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    let result = "";
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed || trimmed.length < 8) continue;
      if ((result + " " + trimmed).trim().length > 200) break;
      result = (result + " " + trimmed).trim();
    }
    if (result.length >= 30) return result;
  }

  // Fallback: take up to 200 chars, break at last word boundary
  if (clean.length <= 200) return clean;
  const cut = clean.slice(0, 200);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut) + "…";
}

function deadlineLabel(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "Expired", urgent: true };
  if (days === 0) return { text: "Today!", urgent: true };
  if (days === 1) return { text: "Tomorrow", urgent: true };
  if (days <= 7) return { text: `${days}d left`, urgent: true };
  if (days <= 30) return { text: `${days}d left`, urgent: false };
  return { text: new Date(deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" }), urgent: false };
}

const MONEY_KEYWORDS = /stipend|prize|cash|₹|rs\.?\s?\d|inr|reward|award|funding|scholarship|grant|bounty|\$\d/i;

function hasMonetaryBenefit(opp: Opportunity): string | null {
  const benefits = opp.benefits ? stripMarkdown(opp.benefits) : "";
  if (MONEY_KEYWORDS.test(benefits)) return benefits;
  const desc = opp.description || "";
  if (MONEY_KEYWORDS.test(desc)) return null;
  return null;
}

interface Props {
  opportunity: Opportunity;
  onClick?: () => void;
  compact?: boolean;
}

export default function OpportunityCard({ opportunity: opp, onClick, compact }: Props) {
  const dl = deadlineLabel(opp.deadline);
  const colorClass = CATEGORY_COLORS[opp.category] || CATEGORY_COLORS.other;
  const brief = briefDescription(opp.description);
  const locationLabel = opp.state || opp.location || null;
  const hasEligibility = opp.eligibility && opp.eligibility.length > 5;
  const monetaryBenefit = hasMonetaryBenefit(opp);
  const hasBenefits = opp.benefits && opp.benefits.length > 5;
  const metaLine = hasEligibility ? stripMarkdown(opp.eligibility!) : (!monetaryBenefit && hasBenefits) ? stripMarkdown(opp.benefits!) : null;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-white/30 dark:border-stone-800/60 rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10 transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${compact ? "p-3" : "p-5"} animate-fade-in flex flex-col`}
    >
      {/* Row 1: Category + Fee badge + Deadline */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${colorClass}`}>
            {opp.category}
          </span>
          {opp.fee_type && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              opp.fee_type === "free"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {opp.fee_type === "free" ? "Free" : "Paid"}
            </span>
          )}
        </div>
        {dl && (
          <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${dl.urgent ? "text-hot bg-hot/10 px-2 py-0.5 rounded-full" : "text-stone-500 dark:text-stone-400"}`}>
            <Calendar size={12} />
            {dl.text}
          </span>
        )}
      </div>

      {/* Row 2: Title + Info icon */}
      <div className="flex items-start gap-2 mb-1.5">
        <h3 className={`font-semibold text-stone-900 dark:text-stone-100 leading-snug flex-1 ${compact ? "text-sm line-clamp-2" : "text-base line-clamp-2"}`}>
          {opp.title}
        </h3>
        {!compact && opp.relevance_explanation && (
          <div className="relative shrink-0 mt-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowTooltip((v) => !v); }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="p-1 rounded-full text-brand-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
              aria-label="Why this is recommended"
            >
              <Info size={16} />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl text-xs text-stone-600 dark:text-stone-300 leading-relaxed animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-semibold text-brand-600 dark:text-brand-300 mb-1">Why this matches you</p>
                <p>{opp.relevance_explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 3: Clean one-line description */}
      {!compact && (
        <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mb-2.5">{brief}</p>
      )}

      {/* Row 4: Monetary benefit highlight */}
      {!compact && monetaryBenefit && (
        <div className="flex items-start gap-1.5 mb-2.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg">
          <Gift size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium line-clamp-1">{monetaryBenefit}</p>
        </div>
      )}

      {/* Row 5: Metadata — location, organizer */}
      {!compact && (locationLabel || opp.organizer) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-xs text-stone-500 dark:text-stone-400">
          {locationLabel && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate max-w-[140px]">{locationLabel}</span>
            </span>
          )}
          {opp.organizer && (
            <span className="flex items-center gap-1">
              <User2 size={12} className="shrink-0" />
              <span className="truncate max-w-[140px]">{opp.organizer}</span>
            </span>
          )}
        </div>
      )}

      {/* Row 6: Eligibility or Benefits (non-monetary) — one line */}
      {!compact && metaLine && (
        <p className="text-xs text-stone-400 dark:text-stone-500 line-clamp-1 mb-2.5 italic">
          {hasEligibility ? "Eligibility: " : "Benefits: "}{metaLine}
        </p>
      )}

      {/* Row 7: Domain tags */}
      <div className={`flex flex-wrap gap-1.5 ${compact ? "mb-0" : "mt-auto"}`}>
        {(opp.domain_tags || []).slice(0, compact ? 3 : 5).map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-[11px] font-medium">
            {tag}
          </span>
        ))}
        {(opp.domain_tags || []).length > (compact ? 3 : 5) && (
          <span className="px-2 py-0.5 text-stone-400 dark:text-stone-500 text-[11px] font-medium">
            +{(opp.domain_tags || []).length - (compact ? 3 : 5)}
          </span>
        )}
      </div>
    </div>
  );
}
