import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Tag, Award, Users, MessageSquare } from "lucide-react";
import { getOpportunity, type Opportunity } from "../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  hackathon: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  grant: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  fellowship: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  internship: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  competition: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  scholarship: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  program: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  other: "bg-surface-muted text-content-secondary",
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
        <p className="text-red-600 mb-4">{error || "Opportunity not found"}</p>
        <button onClick={() => navigate(-1)} className="text-brand-600 font-medium">Go back</button>
      </div>
    );
  }

  const colorClass = CATEGORY_COLORS[opp.category] || CATEGORY_COLORS.other;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-content-tertiary hover:text-content-secondary mb-6"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-surface/90 backdrop-blur rounded-3xl border border-line shadow-xl p-6 lg:p-10">
        <div className="flex items-start gap-3 mb-4 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
            {opp.category}
          </span>
          {!opp.is_active && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-surface-muted text-content-tertiary">
              Inactive
            </span>
          )}
        </div>

        <h1 className="text-3xl font-semibold text-content mb-3 font-display">{opp.title}</h1>
        <div className="text-content-secondary leading-relaxed mb-8 space-y-4">
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
            <div className="bg-surface-alt rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-content-muted mb-2">
                <Tag size={14} /> Domains
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opp.domain_tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-surface border border-line rounded text-xs font-medium text-content-secondary">{t}</span>
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
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
          >
            Apply / Visit <ExternalLink size={14} />
          </a>
          <button
            onClick={() => navigate(`/chat?q=Tell me about "${opp.title}"`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-line text-content-secondary rounded-xl font-medium text-sm hover:bg-hover transition-colors"
          >
            <MessageSquare size={14} /> Ask SOIP about this
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-surface-alt rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-content-muted mb-1">
        <Icon size={14} /> {label}
      </div>
      <p className="text-sm text-content-secondary">{value}</p>
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
      <div key={`${section.title}-${idx}`} className="bg-surface/60 border border-line rounded-2xl p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-content-muted mb-2">
          {section.title}
        </h3>
        {bullets.length > 1 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm text-content-secondary">
            {bullets.map((b, i) => (
              <li key={i}>{renderInline(b)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-content-secondary">{renderInline(section.body)}</p>
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
        <a key={`${href}-${i}`} href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline">
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
              <a key={`${u}-${ui}`} href={u} target="_blank" rel="noreferrer" className="text-brand-700 underline">
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
  // Drop obvious truncated URLs like https...
  const noTruncatedUrls = cleaned.replace(/https?:\/\/[^\s]*\.\.\./g, "").replace(/https?:\/\/\.\.\./g, "");
  // Remove trailing ellipsis-only fragments
  return noTruncatedUrls.replace(/\.\.\.$/g, "").replace(/\s+\.\.\.$/g, "").trim();
}

function isCompleteUrl(url: string) {
  if (url.includes("...") || url.includes("…")) return false;
  if (url.endsWith("...") || url.endsWith("…")) return false;
  return url.length > 12;
}
