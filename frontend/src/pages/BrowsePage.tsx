import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter } from "lucide-react";
import { browseOpportunities, type Opportunity } from "../lib/api";
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
      setOpportunities(data);
    } catch {
      setOpportunities([]);
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
            <h1 className="text-xl font-bold text-gray-900">Browse opportunities</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Loading..." : `${opportunities.length} results`}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
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
            <p className="text-gray-400 text-lg mb-2">No opportunities found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters.</p>
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
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={opportunities.length < 20}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
