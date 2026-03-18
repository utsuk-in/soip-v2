import React, { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import OpportunityCard from "../OpportunityCard";
import type { Opportunity } from "../../lib/api";

interface Props {
  opportunities: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onOpportunityClick: (id: string) => void;
}

export default function OnlineListView({
  opportunities, total, page, pageSize,
  loading, onPageChange, onOpportunityClick,
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

  if (loading && opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 overflow-y-auto h-full">
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search online events..."
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm bg-white/50 dark:bg-stone-900/60 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm bg-white/50 dark:bg-stone-900/60 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">
        {filtered.length} online event{filtered.length !== 1 ? "s" : ""}
        {totalPages > 1 && ` — page ${page} of ${totalPages}`}
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((opp, i) => (
            <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <OpportunityCard opportunity={opp} onClick={() => onOpportunityClick(opp.id)} />
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-stone-400 dark:text-stone-500 text-lg font-display">No online events found</p>
          <p className="text-sm text-stone-400 mt-1">Try different search terms or switch to Offline mode.</p>
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
  );
}
