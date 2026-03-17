import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Map } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, type Opportunity } from "../lib/api";
import { getCached, setCache } from "../lib/cache";
import { matchStateToGeo } from "../lib/india-states-geo";
import ModeToggle from "../components/hackmap/ModeToggle";
import IndiaMapView from "../components/hackmap/IndiaMapView";
import OnlineListView from "../components/hackmap/OnlineListView";
import StateDetailView from "../components/hackmap/StateDetailView";

const CACHE_TTL = 5 * 60 * 1000;

type View = "map" | "state" | "online";

export default function HackMapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = (searchParams.get("mode") as "offline" | "online") || "offline";
  const initialState = searchParams.get("state") || null;

  const [mode, setMode] = useState<"offline" | "online">(initialMode);
  const [offlineOpps, setOfflineOpps] = useState<Opportunity[]>(() => getCached<Opportunity[]>("hackmap:offline") || []);
  const [onlineOpps, setOnlineOpps] = useState<Opportunity[]>(() => getCached<Opportunity[]>("hackmap:online") || []);
  const [loading, setLoading] = useState(false);

  const [selectedStateName, setSelectedStateName] = useState<string | null>(initialState);
  const [selectedStateOpps, setSelectedStateOpps] = useState<Opportunity[]>([]);

  const currentView: View = mode === "online" ? "online" : selectedStateName ? "state" : "map";

  // Reconstruct state opps from cached offline data when restoring from URL
  useEffect(() => {
    if (initialState && selectedStateOpps.length === 0 && offlineOpps.length > 0) {
      const opps = offlineOpps.filter((opp) => {
        const loc = opp.state || opp.location || "";
        return matchStateToGeo(loc) === initialState;
      });
      if (opps.length > 0) setSelectedStateOpps(opps);
    }
  }, [initialState, offlineOpps, selectedStateOpps.length]);

  const fetchOpportunities = useCallback(async (fetchMode: "offline" | "online") => {
    const cacheKey = `hackmap:${fetchMode}`;
    const cached = getCached<Opportunity[]>(cacheKey, CACHE_TTL);
    if (cached) {
      if (fetchMode === "offline") setOfflineOpps(cached);
      else setOnlineOpps(cached);
      return;
    }

    setLoading(true);
    try {
      const params =
        fetchMode === "offline"
          ? { mode: fetchMode, active_only: true, sort: "newest", page: 1, page_size: 100 }
          : { mode: fetchMode, page_size: 100 };

      const res = await browseOpportunities(params);
      setCache(cacheKey, res.items);
      if (fetchMode === "offline") setOfflineOpps(res.items);
      else setOnlineOpps(res.items);
    } catch {
      if (fetchMode === "offline") setOfflineOpps([]);
      else setOnlineOpps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities(mode);
  }, [mode, fetchOpportunities]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (mode !== "offline") params.mode = mode;
    if (selectedStateName) params.state = selectedStateName;
    setSearchParams(params, { replace: true });
  }, [mode, selectedStateName, setSearchParams]);

  function handleModeChange(next: "offline" | "online") {
    setMode(next);
    setSelectedStateName(null);
    setSelectedStateOpps([]);
  }

  function handleStateSelect(stateName: string, opps: Opportunity[]) {
    setSelectedStateName(stateName);
    setSelectedStateOpps(opps);
  }

  function handleBackToMap() {
    setSelectedStateName(null);
    setSelectedStateOpps([]);
  }

  const userState = user?.state && user.state !== "Pan India" ? user.state : null;
  const subtitle =
    currentView === "state"
      ? `${selectedStateName} — ${selectedStateOpps.length} event${selectedStateOpps.length !== 1 ? "s" : ""}`
      : mode === "offline"
        ? "Discover events near you"
        : "Browse online opportunities";

  return (
    <div className="flex flex-col h-full">
      {/* Header — only show on map and online views */}
      {currentView !== "state" && (
        <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-stone-200/60 dark:border-stone-800/60 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
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
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === "map" && (
          <IndiaMapView
            opportunities={offlineOpps}
            userState={userState}
            loading={loading}
            onStateSelect={handleStateSelect}
          />
        )}
        {currentView === "state" && selectedStateName && (
          <StateDetailView
            stateName={selectedStateName}
            opportunities={selectedStateOpps}
            onBack={handleBackToMap}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        )}
        {currentView === "online" && (
          <OnlineListView
            opportunities={onlineOpps}
            loading={loading}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
