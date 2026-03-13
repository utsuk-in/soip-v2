import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter } from "lucide-react";
import { browseOpportunities, type Opportunity, type OpportunityListResponse } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";
import FilterSidebar from "../components/FilterSidebar";

interface Filters {
  category: string;
  domain: string;
  search: string;
  sort: string;
}

const INITIAL_FILTERS: Filters = { category: "", domain: "", search: "", sort: "newest" };

export default function BrowsePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [meta, setMeta] = useState<OpportunityListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await browseOpportunities({
        category: filters.category || undefined,
        domain: filters.domain || undefined,
        search: filters.search || undefined,
        sort: filters.sort,
        page,
        page_size: 20,
      });
      setOpportunities(data.items || []);
      setMeta(data);
    } catch {
      setOpportunities([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <div className="flex h-full">
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-display">Explore Opportunities</h1>
            <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
              {loading ? "Loading..." : meta ? `Showing ${Math.min((page - 1) * meta.page_size + 1, meta.total)}–${Math.min(page * meta.page_size, meta.total)} of ${meta.total}` : `${opportunities.length} results`}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
          >
            <Filter size={16} /> Filters
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 dark:text-stone-500 text-lg mb-2 font-display">No opportunities found</p>
            <p className="text-sm text-stone-400 dark:text-stone-500">Try adjusting the filters to see more results.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {opportunities.map((opp, i) => (
                <div key={opp.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <OpportunityCard
                    opportunity={opp}
                    onClick={() => navigate(`/browse/${opp.id}`)}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8">
              <div className="text-sm text-stone-400 dark:text-stone-500">
                {meta ? `Page ${meta.page} of ${meta.total_pages}` : `Page ${page}`}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-5 py-2.5 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-300 disabled:opacity-40 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={meta ? !meta.has_next : opportunities.length < 20}
                  className="px-5 py-2.5 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-300 disabled:opacity-40 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
