import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Tag, Award, Users, MessageSquare } from "lucide-react";
import { getOpportunity, type Opportunity } from "../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  hackathon: "bg-purple-100 text-purple-700",
  grant: "bg-green-100 text-green-700",
  fellowship: "bg-blue-100 text-blue-700",
  internship: "bg-orange-100 text-orange-700",
  competition: "bg-red-100 text-red-700",
  scholarship: "bg-teal-100 text-teal-700",
  program: "bg-indigo-100 text-indigo-700",
  other: "bg-gray-100 text-gray-700",
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
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
        <div className="flex items-start gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
            {opp.category}
          </span>
          {!opp.is_active && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
              Inactive
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{opp.title}</h1>
        <p className="text-gray-600 leading-relaxed mb-6">{opp.description}</p>

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
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                <Tag size={14} /> Domains
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opp.domain_tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600">{t}</span>
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
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors"
          >
            Apply / Visit <ExternalLink size={14} />
          </a>
          <button
            onClick={() => navigate(`/chat?q=Tell me about "${opp.title}"`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
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
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-1">
        <Icon size={14} /> {label}
      </div>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}
