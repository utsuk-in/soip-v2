import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Tag, Award, Users, MessageSquare, MapPin, Globe, Building2, IndianRupee, Clock } from "lucide-react";
import { getOpportunity, type Opportunity } from "../lib/api";
import { CATEGORY_COLORS } from "../lib/constants";
import FeedbackButtons from "../components/FeedbackButtons";
import { useFeedback } from "../hooks/useFeedback";

const CATEGORY_GRADIENTS: Record<string, string> = {
  hackathon: "from-violet-500 to-violet-400",
  grant: "from-emerald-500 to-emerald-400",
  fellowship: "from-sky-500 to-sky-400",
  internship: "from-amber-500 to-amber-400",
  competition: "from-rose-500 to-rose-400",
  scholarship: "from-teal-500 to-teal-400",
  program: "from-indigo-500 to-indigo-400",
  other: "from-stone-400 to-stone-300",
};

const MODE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  online: { label: "Online", icon: Globe },
  offline: { label: "Offline", icon: MapPin },
  hybrid: { label: "Hybrid", icon: Globe },
};

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { feedbackMap, loadFeedback, submit: submitFeedback, hasSubmitted } = useFeedback();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOpportunity(id)
      .then((data) => {
        setOpp(data);
        loadFeedback([data.id]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, loadFeedback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="p-8 text-center">
        <p className="text-hot mb-4">{error || "Opportunity not found"}</p>
        <button onClick={() => navigate(-1)} className="text-brand-600 font-semibold hover:text-brand-700">Go Back</button>
      </div>
    );
  }

  const colorClass = CATEGORY_COLORS[opp.category] || CATEGORY_COLORS.other;
  const gradientClass = CATEGORY_GRADIENTS[opp.category] || CATEGORY_GRADIENTS.other;
  const modeInfo = opp.mode ? MODE_LABELS[opp.mode] : null;
  const locationText = [opp.location, opp.state].filter(Boolean).join(", ") || null;
  const deadlineFormatted = opp.deadline
    ? new Date(opp.deadline).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const startDateFormatted = opp.start_date
    ? new Date(opp.start_date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const daysLeft = opp.deadline
    ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-300 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-stone-800/60 shadow-xl overflow-hidden">
        {/* Category accent bar */}
        <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`} />

        <div className="p-6 lg:p-10">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${colorClass}`}>
              {opp.category}
            </span>
            {modeInfo && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <modeInfo.icon size={12} /> {modeInfo.label}
              </span>
            )}
            {opp.fee_type && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                opp.fee_type === "free"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}>
                {opp.fee_type === "free" ? "Free" : "Paid"}
              </span>
            )}
            {opp.status === "open" && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Open
              </span>
            )}
            {opp.status === "coming_soon" && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Coming Soon
              </span>
            )}
            {!opp.is_active && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-500">
                Inactive
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold text-stone-900 dark:text-stone-100 mb-6 font-display leading-tight">
            {opp.title}
          </h1>

          {/* Description */}
          <div className="text-base text-stone-700 dark:text-stone-300 leading-relaxed mb-8">
            <RichText text={opp.description} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {deadlineFormatted && (
              <InfoBox icon={Calendar} label="Deadline">
                <p className="text-sm text-stone-700 dark:text-stone-300">{deadlineFormatted}</p>
                {daysLeft !== null && daysLeft >= 0 && (
                  <p className={`text-xs font-semibold mt-1 ${daysLeft <= 3 ? "text-hot" : daysLeft <= 7 ? "text-amber-600 dark:text-amber-400" : "text-stone-400"}`}>
                    {daysLeft === 0 ? "Closes today!" : daysLeft === 1 ? "Closes tomorrow" : `${daysLeft} days left`}
                  </p>
                )}
              </InfoBox>
            )}
            {startDateFormatted && (
              <InfoBox icon={Clock} label="Start Date">
                <p className="text-sm text-stone-700 dark:text-stone-300">{startDateFormatted}</p>
              </InfoBox>
            )}
            {locationText && (
              <InfoBox icon={MapPin} label="Location">
                <p className="text-sm text-stone-700 dark:text-stone-300">{locationText}</p>
              </InfoBox>
            )}
            {opp.organizer && (
              <InfoBox icon={Building2} label="Organizer">
                <p className="text-sm text-stone-700 dark:text-stone-300">{opp.organizer}</p>
              </InfoBox>
            )}
            {opp.eligibility && opp.eligibility.length > 2 && (
              <InfoBox icon={Users} label="Eligibility">
                <p className="text-sm text-stone-700 dark:text-stone-300">{opp.eligibility}</p>
              </InfoBox>
            )}
            {opp.benefits && opp.benefits.length > 2 && (
              <InfoBox icon={Award} label="Benefits">
                <p className="text-sm text-stone-700 dark:text-stone-300">{opp.benefits}</p>
              </InfoBox>
            )}
            {opp.domain_tags.length > 0 && !(opp.domain_tags.length === 1 && opp.domain_tags[0] === "general") && (
              <InfoBox icon={Tag} label="Domains">
                <div className="flex flex-wrap gap-1.5">
                  {opp.domain_tags.map((t) => (
                    <span key={t} className="px-2.5 py-0.5 bg-brand-50 dark:bg-stone-800 text-brand-700 dark:text-brand-200 rounded-full text-xs font-medium">{t}</span>
                  ))}
                </div>
              </InfoBox>
            )}
          </div>

          {/* Source link */}
          {opp.source_url && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-6">
              Source: <a href={opp.source_url} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-600 underline">{opp.source_url}</a>
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={opp.application_link || opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all"
            >
              View application <ExternalLink size={14} />
            </a>
            <button
              onClick={() => navigate(`/chat?q=Tell me about "${opp.title}"&opp_id=${opp.id}`)}
              className="flex items-center gap-2 px-6 py-3 bg-white/60 dark:bg-stone-900/60 backdrop-blur border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-semibold text-sm hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-all"
            >
              <MessageSquare size={14} /> Ask Steppd
            </button>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-stone-900/60 backdrop-blur border border-stone-200 dark:border-stone-800 rounded-xl">
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500">Relevant?</span>
              <FeedbackButtons
                opportunityId={opp.id}
                source="feed"
                currentValue={feedbackMap[opp.id] ?? null}
                disabled={hasSubmitted(opp.id)}
                onFeedback={(value) => submitFeedback(opp.id, value, "feed")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, highlight, children }: { icon: React.ElementType; label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div className={`backdrop-blur border rounded-2xl p-4 ${
      highlight
        ? "bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/40"
        : "bg-white/60 dark:bg-stone-900/60 border-stone-200/50 dark:border-stone-800/60"
    }`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
        <Icon size={14} /> {label}
      </div>
      {children}
    </div>
  );
}

function RichText({ text }: { text: string }) {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/https?:\/\/[^\s]*\.\.\./g, "")
    .trim();

  const paragraphs = cleaned.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim();
        if (!trimmed) return null;
        return <p key={pi} className={pi > 0 ? "mt-3" : ""}>{renderInline(trimmed)}</p>;
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Match markdown link [label](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // Match bold **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    const linkIdx = linkMatch?.index ?? Infinity;
    const boldIdx = boldMatch?.index ?? Infinity;

    if (linkIdx === Infinity && boldIdx === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (linkIdx <= boldIdx && linkMatch) {
      if (linkIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, linkIdx)}</span>);
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-brand-600 underline hover:text-brand-700">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkIdx + linkMatch[0].length);
    } else if (boldMatch) {
      if (boldIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>);
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    }
  }

  return <>{parts}</>;
}
