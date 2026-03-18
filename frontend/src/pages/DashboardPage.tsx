import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Search, Sparkles, AlertTriangle, PartyPopper, Code2, Briefcase, Banknote, GraduationCap, Trophy, BookOpen, Layers } from "lucide-react";
import { useAuth } from "../lib/auth";
import { getRecommended, getOpportunityStats, type Opportunity } from "../lib/api";
import { getCached, setCache } from "../lib/cache";
import { CATEGORY_TILES } from "../lib/constants";
import OpportunityCard from "../components/OpportunityCard";

const ICON_MAP: Record<string, React.ElementType> = {
  Code2, Briefcase, Banknote, GraduationCap, Trophy, BookOpen, Layers,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(() => !!(location.state as any)?.welcome);

  const CACHE_TTL = 5 * 60 * 1000;

  const [stats, setStats] = useState<Record<string, number>>(() => getCached<Record<string, number>>("dash:stats") || {});
  const [recommended, setRecommended] = useState<Opportunity[]>(() => getCached<Opportunity[]>("dash:recommended") || []);
  const [expiring, setExpiring] = useState<Opportunity[]>(() => getCached<Opportunity[]>("dash:expiring") || []);
  const [loading, setLoading] = useState(() => {
    return !getCached<Opportunity[]>("dash:recommended", CACHE_TTL);
  });

  useEffect(() => {
    const cached = getCached<{ recommended: Opportunity[]; expiring: Opportunity[] }>("dash:all", CACHE_TTL);
    if (cached) {
      setRecommended(cached.recommended);
      setExpiring(cached.expiring);
      setLoading(false);
      return;
    }

    if (!getCached<Record<string, number>>("dash:stats", CACHE_TTL)) {
      getOpportunityStats()
        .then((s) => { setStats(s); setCache("dash:stats", s); })
        .catch(() => {});
    }

    async function load() {
      try {
        const rec = await getRecommended(12).catch(() => []);
        const recommendedTop = rec.slice(0, 6);

        const soon = rec
          .filter((o) => o.deadline)
          .filter((o) => {
            const days = Math.ceil((new Date(o.deadline!).getTime() - Date.now()) / 86400000);
            return days >= 0 && days <= 7;
          })
          .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
          .slice(0, 4);

        setRecommended(recommendedTop);
        setExpiring(soon);

        setCache("dash:all", { recommended: recommendedTop, expiring: soon });
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
      {/* Welcome modal — shown only on first login after onboarding */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-white/30 dark:border-stone-800/60 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand-600 to-brand-400" />
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4">
                <PartyPopper size={28} className="text-brand-600" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-display mb-2">
                Welcome, {user?.first_name || "there"}!
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-6">
                Your account is all set. Steppd will now surface the best opportunities tailored to your profile — explore, discover, and start applying.
              </p>
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all"
              >
                Let's go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-800 dark:text-stone-100">
          Hello <span className="gradient-text font-bold">{user?.first_name || "there"}</span>, what would you like to do?
        </h1>
        <p className="text-stone-400 dark:text-stone-500 mt-1.5 text-sm sm:text-base">Here are your top opportunities right now.</p>
      </div>

      {/* Category tiles */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {CATEGORY_TILES.filter((t) => (stats[t.key] || 0) > 0).map((tile, i) => {
            const Icon = ICON_MAP[tile.icon];
            const count = stats[tile.key] || 0;
            return (
              <button
                key={tile.key}
                onClick={() => navigate(`/browse?category=${tile.key}`)}
                className={`${tile.bg} ${tile.border} border rounded-2xl p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all animate-slide-up`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {Icon && <Icon size={20} className={`${tile.text} mb-2`} />}
                <p className={`text-2xl font-bold ${tile.text}`}>{count}</p>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-0.5">{tile.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/chat")}
          className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white p-5 rounded-2xl hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all text-left"
        >
          <MessageSquare size={24} />
          <div>
            <p className="font-bold">Ask Steppd Anything</p>
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

