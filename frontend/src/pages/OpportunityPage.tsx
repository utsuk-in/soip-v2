import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Tag, Award, Users, MessageSquare } from "lucide-react";
import { getOpportunity, type Opportunity } from "../lib/api";
import { CATEGORY_COLORS } from "../lib/constants";

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

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOpportunity(id)
      .then(setOpp)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-300 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> back
      </button>

      <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-stone-800/60 shadow-xl overflow-hidden">
        {/* Category accent bar */}
        <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`} />

        <div className="p-6 lg:p-10">
          <div className="flex items-start gap-3 mb-4 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${colorClass}`}>
              {opp.category}
            </span>
            {!opp.is_active && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-stone-100 text-stone-500">
                inactive
              </span>
            )}
          </div>

          <h1 className="text-4xl font-bold text-stone-900 dark:text-stone-100 mb-3 font-display">{opp.title}</h1>
          <div className="text-stone-700 dark:text-stone-300 leading-relaxed mb-8 space-y-4">
            {renderDescription(opp.description)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {opp.deadline && (
              <InfoBox icon={Calendar} label="Deadline" value={new Date(opp.deadline).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })} />
            )}
            {opp.eligibility && (
              <InfoBox icon={Users} label="Eligibility" value={opp.eligibility} />
            )}
            {opp.benefits && (
              <InfoBox icon={Award} label="Benefits" value={opp.benefits} />
            )}
            {opp.domain_tags.length > 0 && (
              <div className="bg-white/60 dark:bg-stone-900/60 backdrop-blur border border-stone-200/50 dark:border-stone-800/60 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-2">
                  <Tag size={14} /> Domains
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opp.domain_tags.map((t) => (
                    <span key={t} className="px-2.5 py-0.5 bg-brand-50 dark:bg-stone-800 text-brand-700 dark:text-brand-200 rounded-full text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all"
            >
              View application <ExternalLink size={14} />
            </a>
            <button
              onClick={() => navigate(`/chat?q=Tell me about "${opp.title}"`)}
              className="flex items-center gap-2 px-6 py-3 bg-white/60 dark:bg-stone-900/60 backdrop-blur border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-semibold text-sm hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-all"
            >
              <MessageSquare size={14} /> Ask SOIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-white/60 dark:bg-stone-900/60 backdrop-blur border border-stone-200/50 dark:border-stone-800/60 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1">
        <Icon size={14} /> {label}
      </div>
      <p className="text-sm text-stone-700 dark:text-stone-300">{value}</p>
    </div>
  );
}

function renderDescription(text: string) {
  const cleaned = sanitizeDescription(text);
  const headingRegex = /\*\*([^*]+)\*\*/g;
  const headings: { title: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(cleaned)) !== null) {
    headings.push({ title: match[1], index: match.index });
  }

  if (headings.length === 0) {
    return <p>{renderInline(cleaned)}</p>;
  }

  const sections: { title: string; body: string }[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i].title.length + 4;
    const end = i + 1 < headings.length ? headings[i + 1].index : cleaned.length;
    const body = cleaned.slice(start, end).trim();
    sections.push({ title: headings[i].title, body });
  }

  return sections.map((section, idx) => {
    const bullets = section.body.split(/\s\*\s+/).map((s) => s.trim()).filter(Boolean);
    return (
      <div key={`${section.title}-${idx}`} className="bg-white/60 backdrop-blur border border-stone-200/50 rounded-2xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
          {section.title}
        </h3>
        {bullets.length > 1 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm text-stone-700">
            {bullets.map((b, i) => (
              <li key={i}>{renderInline(b)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-700">{renderInline(section.body)}</p>
        )}
      </div>
    );
  });
}

function renderInline(text: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(linkRegex).filter((p) => p !== "");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 1) {
      const label = parts[i];
      const href = parts[i + 1];
      nodes.push(
        <a key={`${href}-${i}`} href={href} target="_blank" rel="noreferrer" className="text-brand-600 underline hover:text-brand-700">
          {label}
        </a>
      );
      i += 1;
      continue;
    }

    const chunk = parts[i];
    const boldSplit = chunk.split(/(\*\*[^*]+\*\*)/g);
    boldSplit.forEach((seg, idx) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        nodes.push(<strong key={`${seg}-${idx}`}>{seg.slice(2, -2)}</strong>);
      } else {
        const urlParts = seg.split(urlRegex);
        urlParts.forEach((u, ui) => {
          if (u.match(urlRegex) && isCompleteUrl(u)) {
            nodes.push(
              <a key={`${u}-${ui}`} href={u} target="_blank" rel="noreferrer" className="text-brand-600 underline hover:text-brand-700">
                {u}
              </a>
            );
          } else {
            nodes.push(<span key={`${u}-${ui}`}>{u}</span>);
          }
        });
      }
    });
  }

  return <>{nodes}</>;
}

function sanitizeDescription(raw: string) {
  const cleaned = raw.replace(/\r\n/g, "\n").replace(/\s{2,}/g, " ").trim();
  const noTruncatedUrls = cleaned.replace(/https?:\/\/[^\s]*\.\.\./g, "").replace(/https?:\/\/\.\.\./g, "");
  return noTruncatedUrls.replace(/\.\.\.$/g, "").replace(/\s+\.\.\.$/g, "").trim();
}

function isCompleteUrl(url: string) {
  if (url.includes("...") || url.includes("\u2026")) return false;
  if (url.endsWith("...") || url.endsWith("\u2026")) return false;
  return url.length > 12;
}
