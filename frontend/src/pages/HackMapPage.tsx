import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Map } from "lucide-react";
import { useAuth } from "../lib/auth";
import { browseOpportunities, type Opportunity } from "../lib/api";
import ModeToggle from "../components/hackmap/ModeToggle";
import IndiaMapView from "../components/hackmap/IndiaMapView";
import OnlineListView from "../components/hackmap/OnlineListView";

export default function HackMapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"offline" | "online">("offline");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params =
      mode === "offline"
        ? { mode, active_only: true, sort: "newest", page: 1, page_size: 100 }
        : { mode, page_size: 200 };

    browseOpportunities(params)
      .then((res) => {
        if (!cancelled) setOpportunities(res.items);
      })
      .catch(() => {
        if (!cancelled) setOpportunities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mode]);

  const userState = user?.state && user.state !== "Pan India" ? user.state : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-stone-200/60 dark:border-stone-800/60 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Map size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-stone-900 dark:text-stone-100">
              HackMap
            </h1>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {mode === "offline" ? "Discover events near you" : "Browse online opportunities"}
            </p>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "offline" ? (
          <IndiaMapView
            opportunities={opportunities}
            userState={userState}
            loading={loading}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        ) : (
          <OnlineListView
            opportunities={opportunities}
            loading={loading}
            onOpportunityClick={(id) => navigate(`/browse/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
