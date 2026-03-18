import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Search, Sparkles, Clock, AlertTriangle, PartyPopper } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, getRecommended, getExplanations, type Opportunity } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";
import { useFeedback } from "../hooks/useFeedback";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(() => !!(location.state as any)?.welcome);

  const [recommended, setRecommended] = useState<Opportunity[]>([]);
  const [recent, setRecent] = useState<Opportunity[]>([]);
  const [expiring, setExpiring] = useState<Opportunity[]>([]);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { feedbackMap, loadFeedback, submit: submitFeedback, hasSubmitted } = useFeedback();

  useEffect(() => {
    async function load() {
      try {
        // Fire both calls in parallel — don't wait for recommended before starting browse
        const [rec, browseResult] = await Promise.all([
          getRecommended(20).catch(() => []),
          browseOpportunities({ sort: "newest", page_size: 60 }).catch(() => ({
            items: [] as Opportunity[],
            total: 0,
            page: 1,
            page_size: 60,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          })),
        ]);

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

        const recentOpps = [...rec]
          .filter((o) => o.created_at)
          .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
          .slice(0, 6);

        // Fill gaps from the already-fetched browse results
        if (soon.length < 4 || recentOpps.length < 6) {
          const pool = (browseResult.items || []).filter((o) => isRelevantForUser(user, o));
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
          if (recentOpps.length < 6) {
            const fillRecent = pool
              .filter((o) => o.created_at)
              .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
              .slice(0, 6 - recentOpps.length);
            recentOpps.push(...fillRecent);
          }
        }

        setExpiring(soon);
        setRecent(recentOpps);

        // Load feedback for all visible opportunities (parallel, non-blocking for cards)
        const allIds = [...new Set([...recommendedTop, ...soon, ...recentOpps].map((o) => o.id))];
        loadFeedback(allIds);

        // Fetch explanations in background — cards render immediately without them
        getExplanations(allIds)
          .then((expl) => setExplanations(expl))
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Enrich opportunities with async explanations as they arrive
  const withExplanation = useMemo(() => {
    return (opp: Opportunity): Opportunity =>
      explanations[opp.id]
        ? { ...opp, relevance_explanation: explanations[opp.id] }
        : opp;
  }, [explanations]);

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
                Your account is all set. SOIP will now surface the best opportunities tailored to your profile — explore, discover, and start applying.
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
                <OpportunityCard
                  opportunity={withExplanation(opp)}
                  onClick={() => navigate(`/browse/${opp.id}`)}
                  feedbackValue={feedbackMap[opp.id] ?? null}
                  feedbackDisabled={hasSubmitted(opp.id)}
                  feedbackSource="feed"
                  onFeedback={(value) => submitFeedback(opp.id, value, "feed")}
                />
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
                <OpportunityCard
                  opportunity={withExplanation(opp)}
                  onClick={() => navigate(`/browse/${opp.id}`)}
                  feedbackValue={feedbackMap[opp.id] ?? null}
                  feedbackDisabled={hasSubmitted(opp.id)}
                  feedbackSource="feed"
                  onFeedback={(value) => submitFeedback(opp.id, value, "feed")}
                />
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
                <OpportunityCard
                  opportunity={withExplanation(opp)}
                  onClick={() => navigate(`/browse/${opp.id}`)}
                  feedbackValue={feedbackMap[opp.id] ?? null}
                  feedbackDisabled={hasSubmitted(opp.id)}
                  feedbackSource="feed"
                  onFeedback={(value) => submitFeedback(opp.id, value, "feed")}
                />
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
