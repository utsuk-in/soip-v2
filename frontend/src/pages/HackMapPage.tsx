import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Map, Filter } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, getOpportunityStatsByState, type Opportunity } from "../lib/api";
import { getCached, setCache } from "../lib/cache";
import { normalizeStateName } from "../lib/india-states-geo";
import ModeToggle from "../components/hackmap/ModeToggle";
import IndiaMapView from "../components/hackmap/IndiaMapView";
import OnlineListView from "../components/hackmap/OnlineListView";
import StateDetailView from "../components/hackmap/StateDetailView";

const CACHE_TTL = 5 * 60 * 1000;
const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "hackathon", label: "Hackathons" },
  { value: "competition", label: "Competitions" },
  { value: "internship", label: "Internships" },
  { value: "fellowship", label: "Fellowships" },
  { value: "grant", label: "Grants" },
  { value: "scholarship", label: "Scholarships" },
];

type View = "map" | "state" | "online";

export default function HackMapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = (searchParams.get("mode") as "offline" | "online") || "offline";
  const initialState = searchParams.get("state") || null;
  const initialCategory = searchParams.get("category") || "";

  const [mode, setMode] = useState<"offline" | "online">(initialMode);
  const [category, setCategory] = useState(initialCategory);

  const [stateCounts, setStateCounts] = useState<Record<string, number>>(
    () => getCached<Record<string, number>>(`hackmap:stateCounts:${initialCategory}`) || {}
  );
  const [countsLoading, setCountsLoading] = useState(false);

  const [selectedStateName, setSelectedStateName] = useState<string | null>(initialState);
  const [stateOpps, setStateOpps] = useState<Opportunity[]>([]);
  const [stateTotal, setStateTotal] = useState(0);
  const [statePage, setStatePage] = useState(1);
  const [stateLoading, setStateLoading] = useState(false);

  const [onlineOpps, setOnlineOpps] = useState<Opportunity[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlinePage, setOnlinePage] = useState(1);
  const [onlineLoading, setOnlineLoading] = useState(false);

  const currentView: View = mode === "online" ? "online" : selectedStateName ? "state" : "map";

  // Fetch lightweight state counts for the map (re-fetch when category changes)
  useEffect(() => {
    if (mode !== "offline") return;
    const cacheKey = `hackmap:stateCounts:${category}`;
    const cached = getCached<Record<string, number>>(cacheKey, CACHE_TTL);
    if (cached) {
      setStateCounts(cached);
      return;
    }
    setCountsLoading(true);
    getOpportunityStatsByState("offline", category || undefined)
      .then((data) => {
        setStateCounts(data);
        setCache(cacheKey, data);
      })
      .catch(() => {})
      .finally(() => setCountsLoading(false));
  }, [mode, category]);

  const fetchStateOpps = useCallback(async (stateName: string, page: number, cat: string) => {
    setStateLoading(true);
    try {
      const params: Record<string, any> = {
        mode: "offline",
        state: stateName,
        active_only: true,
        sort: "newest",
        page,
        page_size: PAGE_SIZE,
      };
      if (cat) params.category = cat;
      const res = await browseOpportunities(params);
      setStateOpps(res.items);
      setStateTotal(res.total);
      setStatePage(page);
    } catch {
      setStateOpps([]);
      setStateTotal(0);
    } finally {
      setStateLoading(false);
    }
  }, []);

  const fetchOnlineOpps = useCallback(async (page: number, cat: string) => {
    setOnlineLoading(true);
    try {
      const params: Record<string, any> = {
        mode: "online",
        active_only: true,
        sort: "newest",
        page,
        page_size: PAGE_SIZE,
      };
      if (cat) params.category = cat;
      const res = await browseOpportunities(params);
      setOnlineOpps(res.items);
      setOnlineTotal(res.total);
      setOnlinePage(page);
    } catch {
      setOnlineOpps([]);
      setOnlineTotal(0);
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "online") {
      fetchOnlineOpps(1, category);
    }
  }, [mode, category, fetchOnlineOpps]);

  useEffect(() => {
    if (selectedStateName) {
      fetchStateOpps(selectedStateName, 1, category);
    }
  }, [selectedStateName, category, fetchStateOpps]);

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (mode !== "offline") params.mode = mode;
    if (selectedStateName) params.state = selectedStateName;
    if (category) params.category = category;
    setSearchParams(params, { replace: true });
  }, [mode, selectedStateName, category, setSearchParams]);

  function handleModeChange(next: "offline" | "online") {
    setMode(next);
    setSelectedStateName(null);
    setStateOpps([]);
  }

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSelectedStateName(null);
    setStateOpps([]);
  }

  function handleStateSelect(stateName: string) {
    setSelectedStateName(stateName);
  }

  function handleBackToMap() {
    setSelectedStateName(null);
    setStateOpps([]);
  }

  const userState = user?.state && user.state !== "Pan India" ? user.state : null;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label || "All";
  const subtitle =
    currentView === "state"
      ? `${selectedStateName} — ${stateTotal} event${stateTotal !== 1 ? "s" : ""}`
      : mode === "offline"
        ? "Discover events near you"
        : "Browse online opportunities";

  return (
    <div className="flex flex-col h-full">
      {currentView !== "state" && (
        <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-stone-200/60 dark:border-stone-800/60 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Map size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-stone-900 dark:text-stone-100">
                HackMap
              </h1>
              <p className="text-xs text-stone-400 dark:text-stone-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="pl-8 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-full text-sm bg-white/80 dark:bg-stone-800/80 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-300 appearance-none cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {currentView === "map" && (
          <IndiaMapView
            stateCounts={stateCounts}
            userState={userState}
            loading={countsLoading}
            onStateSelect={handleStateSelect}
          />
        )}
        {currentView === "state" && selectedStateName && (
          <StateDetailView
            stateName={selectedStateName}
            opportunities={stateOpps}
            total={stateTotal}
            page={statePage}
            pageSize={PAGE_SIZE}
            loading={stateLoading}
            onPageChange={(p) => fetchStateOpps(selectedStateName, p, category)}
            onBack={handleBackToMap}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        )}
        {currentView === "online" && (
          <OnlineListView
            opportunities={onlineOpps}
            total={onlineTotal}
            page={onlinePage}
            pageSize={PAGE_SIZE}
            loading={onlineLoading}
            onPageChange={(p) => fetchOnlineOpps(p, category)}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
