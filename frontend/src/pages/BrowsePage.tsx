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
      {/* Sidebar */}
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-content font-display">Browse opportunities</h1>
            <p className="text-sm text-content-tertiary mt-0.5">
              {loading ? "Loading..." : meta ? `Showing ${Math.min((page - 1) * meta.page_size + 1, meta.total)}–${Math.min(page * meta.page_size, meta.total)} of ${meta.total}` : `${opportunities.length} results`}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 px-3 py-2 bg-surface border border-line rounded-lg text-sm"
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
            <p className="text-content-muted text-lg mb-2">No opportunities found</p>
            <p className="text-sm text-content-muted">Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onClick={() => navigate(`/browse/${opp.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8">
              <div className="text-sm text-content-tertiary">
                {meta ? `Page ${meta.page} of ${meta.total_pages}` : `Page ${page}`}
              </div>
              <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-surface border border-line rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-hover"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={meta ? !meta.has_next : opportunities.length < 20}
                className="px-4 py-2 bg-surface border border-line rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-hover"
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
