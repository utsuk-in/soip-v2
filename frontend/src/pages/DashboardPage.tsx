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
        const rec = await getRecommended(20).catch(() => []);
        const recommendedTop = rec.slice(0, 6);
        setRecommended(recommendedTop);

        const soon = rec
          .filter((o) => o.deadline)
          .filter((o) => {
            const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
            return days >= 0 && days <= 7;
          })
          .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
          .slice(0, 4);

        const recent = [...rec]
          .filter((o) => o.created_at)
          .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
          .slice(0, 6);

        // If recommended pool is sparse, fill with personalized matches from browse.
        if (soon.length < 4 || recent.length < 6) {
          const all = await browseOpportunities({ sort: "newest", page_size: 60 }).catch(() => ({
            items: [],
            total: 0,
            page: 1,
            page_size: 60,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          }));
          const pool = (all.items || []).filter((o) => isRelevantForUser(user, o));
          if (soon.length < 4) {
            const fillSoon = pool
              .filter((o) => o.deadline)
              .filter((o) => {
                const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
                return days >= 0 && days <= 7;
              })
              .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
              .slice(0, 4 - soon.length);
            soon.push(...fillSoon);
          }
          if (recent.length < 6) {
            const fillRecent = pool
              .filter((o) => o.created_at)
              .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
              .slice(0, 6 - recent.length);
            recent.push(...fillRecent);
          }
        }

        setExpiring(soon);
        setRecent(recent);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 bg-white/60 dark:bg-stone-900/40 rounded-3xl border border-white/60 dark:border-stone-800/60">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 font-display">
          Hello <span className="gradient-text">{user?.first_name || "there"}</span>, what would you like to do?
        </h1>
        <p className="text-stone-400 dark:text-stone-500 mt-1">Here are your top opportunities right now.</p>
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
          className="flex items-center gap-4 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-white/30 dark:border-stone-800/60 text-stone-900 dark:text-stone-100 p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all text-left"
        >
          <Search size={24} className="text-brand-600" />
          <div>
            <p className="font-bold">Explore Opportunities</p>
            <p className="text-sm text-stone-400 dark:text-stone-500">Filter by category, domain, or deadline.</p>
          </div>
        </button>
      </div>

      {/* Recommended */}
      {recommended.length > 0 && (
        <Section
          icon={Sparkles}
          title="Recommended for You"
          color="text-brand-600"
          surface="bg-transparent border-stone-200/60 dark:bg-brand-500/10 dark:border-brand-400/30"
          headerAccent="dark:bg-brand-500/20 dark:text-brand-200"
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
          surface="bg-transparent border-stone-200/60 dark:bg-accent-500/10 dark:border-accent-400/30"
          headerAccent="dark:bg-accent-500/20 dark:text-accent-200"
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
          surface="bg-transparent border-stone-200/60 dark:bg-emerald-500/10 dark:border-emerald-400/30"
          headerAccent="dark:bg-emerald-500/20 dark:text-emerald-200"
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

function Section({ icon: Icon, title, color, surface, headerAccent, children }: {
  icon: React.ElementType; title: string; color: string; surface: string; headerAccent?: string; children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border ${surface} p-4 sm:p-5`}>
      <h2 className={`inline-flex items-center gap-2 text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 font-display px-3 py-1.5 rounded-full ${headerAccent || ""}`}>
        <Icon size={20} className={color} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function isRelevantForUser(user: { interests?: string[]; skills?: string[]; aspirations?: string[] } | null, opp: Opportunity) {
  if (!user) return true;
  const userDomains = new Set(
    [...(user.interests || []), ...(user.skills || [])].map((d) => d.toLowerCase())
  );
  const userCategories = new Set(
    (user.aspirations || []).map((a) => normalizeCategory(a))
  );

  const oppDomains = new Set((opp.domain_tags || []).map((d) => d.toLowerCase()));
  const hasDomainMatch = [...userDomains].some((d) => oppDomains.has(d));

  const oppCategory = (opp.category || "").toLowerCase();
  const hasCategoryMatch = userCategories.has(oppCategory);

  return hasDomainMatch || hasCategoryMatch;
}

function normalizeCategory(value: string) {
  const v = (value || "").toLowerCase().trim();
  const map: Record<string, string> = {
    hackathons: "hackathon",
    internships: "internship",
    grants: "grant",
    fellowships: "fellowship",
    competitions: "competition",
    scholarships: "scholarship",
  };
  return map[v] || v;
}
