import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, getRecommended, type Opportunity } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recommended, setRecommended] = useState<Opportunity[]>([]);
  const [recent, setRecent] = useState<Opportunity[]>([]);
  const [expiring, setExpiring] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rec, all] = await Promise.all([
          getRecommended(6).catch(() => []),
          browseOpportunities({ sort: "newest", page_size: 50 }).catch(() => ({
            items: [],
            total: 0,
            page: 1,
            page_size: 50,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          })),
        ]);
        setRecommended(rec);
        const allItems = all.items || [];
        setRecent(allItems.slice(0, 6));

        const soon = allItems
          .filter((o) => o.deadline)
          .filter((o) => {
            const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
            return days >= 0 && days <= 7;
          })
          .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
          .slice(0, 4);
        setExpiring(soon);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Greeting */}
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Personal brief</p>
        <h1 className="text-3xl font-semibold text-slate-900 font-display">
          Welcome back, {user?.first_name || "explorer"}
        </h1>
        <p className="text-slate-500">Signal captured. Here’s your best next move.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/chat")}
          className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white p-5 rounded-2xl hover:shadow-lg transition-all text-left"
        >
          <MessageSquare size={24} />
          <div>
            <p className="font-semibold">Chat with SOIP</p>
            <p className="text-sm text-brand-100">Ask about opportunities, get personalized recommendations</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/browse")}
          className="flex items-center gap-4 bg-white border border-slate-200 text-slate-900 p-5 rounded-2xl hover:border-brand-300 hover:shadow-md transition-all text-left"
        >
          <Search size={24} className="text-brand-600" />
          <div>
            <p className="font-semibold">Browse opportunities</p>
            <p className="text-sm text-slate-500">Filter by category, domain, deadline</p>
          </div>
        </button>
      </div>

      {/* Recommended */}
      {recommended.length > 0 && (
        <Section icon={Sparkles} title="Recommended for you" color="text-brand-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
            ))}
          </div>
        </Section>
      )}

      {/* Expiring Soon */}
      {expiring.length > 0 && (
        <Section icon={AlertTriangle} title="Expiring soon" color="text-orange-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {expiring.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
            ))}
          </div>
        </Section>
      )}

      {/* New This Week */}
      {recent.length > 0 && (
        <Section icon={Clock} title="Recently added" color="text-green-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4 font-display">
        <Icon size={20} className={color} />
        {title}
      </h2>
      {children}
    </section>
  );
}
