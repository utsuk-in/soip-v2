import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, Map, Sparkles, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, getRecommended, getOpportunityStats, type Opportunity } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";
import CategoryTile from "../components/dashboard/CategoryTile";
import FeaturedCard from "../components/dashboard/FeaturedCard";
import UrgencyCard from "../components/dashboard/UrgencyCard";
import { CATEGORY_SHOWCASE } from "../lib/constants";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recommended, setRecommended] = useState<Opportunity[]>([]);
  const [recent, setRecent] = useState<Opportunity[]>([]);
  const [expiring, setExpiring] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rec, categoryStats] = await Promise.all([
          getRecommended(20).catch(() => []),
          getOpportunityStats().catch(() => ({})),
        ]);

        setStats(categoryStats);

        const featured = rec.slice(0, 1);
        const rest = rec.slice(1, 7);
        setRecommended(featured.concat(rest));

        const soon = rec
          .filter((o) => o.deadline)
          .filter((o) => {
            const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
            return days >= 0 && days <= 14;
          })
          .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
          .slice(0, 6);

        const newOpps = [...rec]
          .filter((o) => o.created_at)
          .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
          .slice(0, 6);

        if (soon.length < 4 || newOpps.length < 6) {
          const all = await browseOpportunities({ sort: "newest", page_size: 60 }).catch(() => ({
            items: [] as Opportunity[],
            total: 0, page: 1, page_size: 60, total_pages: 1, has_next: false, has_prev: false,
          }));
          const pool = (all.items || []).filter((o) => isRelevantForUser(user, o));
          if (soon.length < 4) {
            const fill = pool
              .filter((o) => o.deadline)
              .filter((o) => {
                const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
                return days >= 0 && days <= 14;
              })
              .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
              .slice(0, 6 - soon.length);
            soon.push(...fill);
          }
          if (newOpps.length < 6) {
            const fill = pool
              .filter((o) => o.created_at)
              .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
              .slice(0, 6 - newOpps.length);
            newOpps.push(...fill);
          }
        }

        setExpiring(soon);
        setRecent(newOpps);
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

  const featuredOpp = recommended[0] || null;
  const gridRecommended = recommended.slice(1, 7);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      {/* Zone 1: Gradient Hero Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 p-8 sm:p-10 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative">
          <h1 className="text-3xl sm:text-4xl font-bold font-display">
            {getGreeting()}, {user?.first_name || "there"}
          </h1>
          <p className="text-brand-100 mt-2 text-sm sm:text-base max-w-lg">
            Your personalized opportunity radar is active. Here's what's curated for you today.
          </p>
        </div>
      </div>

      {/* Zone 2: Category Showcase */}
      <div className="overflow-x-auto -mx-6 px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-3 pb-2">
          {CATEGORY_SHOWCASE.map((cat, i) => (
            <div key={cat.category} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <CategoryTile
                label={cat.label}
                icon={cat.icon}
                gradient={cat.gradient}
                count={stats[cat.category] || 0}
                onClick={() => navigate(`/browse?category=${cat.category}`)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zone 3: Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate("/chat")}
          className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all text-left"
        >
          <MessageSquare size={22} />
          <div>
            <p className="font-bold text-sm">Ask SOIP Anything</p>
            <p className="text-xs text-brand-100">AI-powered recommendations</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/hackmap")}
          className="flex items-center gap-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white p-5 rounded-2xl hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all text-left"
        >
          <Map size={22} />
          <div>
            <p className="font-bold text-sm">Explore HackMap</p>
            <p className="text-xs text-violet-200">Events on the map</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/browse")}
          className="flex items-center gap-4 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-white/30 dark:border-stone-800/60 text-stone-900 dark:text-stone-100 p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all text-left"
        >
          <Search size={22} className="text-brand-600" />
          <div>
            <p className="font-bold text-sm">Browse All</p>
            <p className="text-xs text-stone-400 dark:text-stone-500">Filter & explore</p>
          </div>
        </button>
      </div>

      {/* Zone 4: Featured Recommendation */}
      {featuredOpp && (
        <section>
          <FeaturedCard
            opportunity={featuredOpp}
            onClick={() => navigate(`/browse/${featuredOpp.id}`)}
          />
        </section>
      )}

      {/* Zone 5: Recommended Grid */}
      {gridRecommended.length > 0 && (
        <Section icon={Sparkles} title="Recommended for You" color="text-brand-600" accent="dark:bg-brand-500/20 dark:text-brand-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gridRecommended.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Zone 6: Closing Soon */}
      {expiring.length > 0 && (
        <Section icon={AlertTriangle} title="Closing Soon" color="text-hot" accent="dark:bg-accent-500/20 dark:text-accent-200">
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {expiring.map((opp, i) => (
                <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <UrgencyCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Zone 7: New Opportunities */}
      {recent.length > 0 && (
        <Section icon={Clock} title="New Opportunities" color="text-pop" accent="dark:bg-emerald-500/20 dark:text-emerald-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => navigate(`/browse/${opp.id}`)} />
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <button
              onClick={() => navigate("/browse?sort=newest")}
              className="text-sm text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 font-semibold transition-colors"
            >
              View all opportunities &rarr;
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, color, accent, children }: {
  icon: React.ElementType; title: string; color: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200/60 dark:border-stone-800/60 bg-white/40 dark:bg-stone-900/40 p-4 sm:p-5">
      <h2 className={`inline-flex items-center gap-2 text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 font-display px-3 py-1.5 rounded-full ${accent || ""}`}>
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
    hackathons: "hackathon", internships: "internship", grants: "grant",
    fellowships: "fellowship", competitions: "competition", scholarships: "scholarship",
  };
  return map[v] || v;
}
