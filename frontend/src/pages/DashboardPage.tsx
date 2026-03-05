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
      <div>
        <h1 className="text-3xl font-bold text-stone-900 font-display">
          Hello <span className="gradient-text">{user?.first_name || "there"}</span>, what would you like to do?
        </h1>
        <p className="text-stone-400 mt-1">Here are your top opportunities right now.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/chat")}
          className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all text-left"
        >
          <MessageSquare size={24} />
          <div>
            <p className="font-bold">Ask SOIP Anything</p>
            <p className="text-sm text-brand-100">Get personalized recommendations, powered by AI.</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/browse")}
          className="flex items-center gap-4 bg-white/70 backdrop-blur border border-white/30 text-stone-900 p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all text-left"
        >
          <Search size={24} className="text-brand-600" />
          <div>
            <p className="font-bold">Explore Opportunities</p>
            <p className="text-sm text-stone-400">Filter by category, domain, or deadline.</p>
          </div>
        </button>
      </div>

      {/* Recommended */}
      {recommended.length > 0 && (
        <Section
          icon={Sparkles}
          title="Recommended for You"
          color="text-brand-600"
          surface="bg-brand-100/70 border-brand-200/80"
          art={`url("data:image/svg+xml;utf8,${encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='140' viewBox='0 0 240 140'><g fill='none' stroke='%2306b6d4' stroke-width='1.2' opacity='0.22'><path d='M10 32c32-18 72-18 104 0s72 18 104 0'/><circle cx='186' cy='30' r='6'/><circle cx='40' cy='98' r='5'/></g></svg>"
          )}"), radial-gradient(120% 140% at 0% 0%, rgba(6,182,212,0.18) 0%, rgba(255,255,255,0) 55%), radial-gradient(120% 140% at 100% 0%, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0) 60%)`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Expiring Soon */}
      {expiring.length > 0 && (
        <Section
          icon={AlertTriangle}
          title="Closing Soon"
          color="text-hot"
          surface="bg-accent-100/70 border-accent-200/80"
          art={`url("data:image/svg+xml;utf8,${encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='140' viewBox='0 0 240 140'><g fill='none' stroke='%23f43f5e' stroke-width='1.2' opacity='0.22'><path d='M20 110l40-60 40 60 40-60 40 60'/><circle cx='30' cy='26' r='5'/><circle cx='210' cy='112' r='6'/></g></svg>"
          )}"), radial-gradient(140% 120% at 0% 0%, rgba(244,63,94,0.22) 0%, rgba(255,255,255,0) 55%), radial-gradient(140% 120% at 100% 100%, rgba(245,158,11,0.14) 0%, rgba(255,255,255,0) 60%)`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {expiring.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* New This Week */}
      {recent.length > 0 && (
        <Section
          icon={Clock}
          title="New Opportunities"
          color="text-pop"
          surface="bg-brand-50/80 border-brand-200/70"
          art={`url("data:image/svg+xml;utf8,${encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='140' viewBox='0 0 240 140'><g fill='none' stroke='%2322c55e' stroke-width='1.2' opacity='0.22'><path d='M14 24h70m-60 22h90m-80 22h120'/><circle cx='200' cy='26' r='6'/><circle cx='160' cy='92' r='5'/></g></svg>"
          )}"), radial-gradient(120% 120% at 0% 100%, rgba(6,182,212,0.16) 0%, rgba(255,255,255,0) 55%), radial-gradient(140% 120% at 100% 0%, rgba(34,197,94,0.14) 0%, rgba(255,255,255,0) 60%)`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, color, surface, art, children }: {
  icon: React.ElementType; title: string; color: string; surface: string; art: string; children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border ${surface} p-4 sm:p-5`}
      style={{ backgroundImage: art }}
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-stone-800 mb-4 font-display">
        <Icon size={20} className={color} />
        {title}
      </h2>
      {children}
    </section>
  );
}
