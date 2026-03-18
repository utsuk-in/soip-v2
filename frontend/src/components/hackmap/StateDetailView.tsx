import React, { useState, useMemo } from "react";
import { ArrowLeft, MapPin, Search, ChevronLeft, ChevronRight } from "lucide-react";
import OpportunityCard from "../OpportunityCard";
import type { Opportunity } from "../../lib/api";

interface Props {
  stateName: string;
  opportunities: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onBack: () => void;
  onOpportunityClick: (id: string) => void;
}

export default function StateDetailView({
  stateName, opportunities, total, page, pageSize,
  loading, onPageChange, onBack, onOpportunityClick,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  const filtered = useMemo(() => {
    let list = opportunities;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
      );
    }
    if (selectedDomain) {
      list = list.filter((o) =>
        (o.domain_tags || []).some((t) => t.toLowerCase() === selectedDomain.toLowerCase())
      );
    }
    return list;
  }, [opportunities, search, selectedDomain]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((o) => (o.domain_tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [opportunities]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-6 lg:px-8 py-4 border-b border-stone-200/60 dark:border-stone-800/60 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 font-medium transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Back to India Map
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            <MapPin size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-stone-900 dark:text-stone-100">
              {stateName}
            </h2>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {total} event{total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pt-4 pb-2">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search events in ${stateName}...`}
              className="w-full pl-9 pr-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm bg-white/50 dark:bg-stone-900/60 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          {domains.length > 1 && (
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm bg-white/50 dark:bg-stone-900/60 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">All domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-3">
          Showing {filtered.length} of {total} event{total !== 1 ? "s" : ""}
          {totalPages > 1 && ` — page ${page} of ${totalPages}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
            {filtered.map((opp, i) => (
              <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                <OpportunityCard opportunity={opp} onClick={() => onOpportunityClick(opp.id)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-stone-400 dark:text-stone-500 text-lg font-display">
              {total === 0 ? `No events in ${stateName} yet` : "No matching events"}
            </p>
            <p className="text-sm text-stone-400 mt-1">
              {total === 0
                ? "Check back soon or explore online events."
                : "Try different search terms or clear the filter."}
            </p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 rounded-xl text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
            >
              Back to Map
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
