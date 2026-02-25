import React from "react";
import { X } from "lucide-react";

const CATEGORIES = [
  "hackathon", "grant", "fellowship", "internship",
  "competition", "scholarship", "program",
];

const DOMAINS = [
  "AI", "climate", "fintech", "healthcare", "web3",
  "robotics", "education", "social-impact",
];

interface Filters {
  category: string;
  domain: string;
  search: string;
  sort: string;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  open: boolean;
  onClose: () => void;
}

export default function FilterSidebar({ filters, onChange, open, onClose }: Props) {
  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 p-5 overflow-y-auto transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button className="lg:hidden" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Keyword..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-2">Category</label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={filters.category === ""}
                onChange={() => set("category", "")}
                className="accent-brand-600"
              />
              All
            </label>
            {CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                <input
                  type="radio"
                  name="category"
                  checked={filters.category === cat}
                  onChange={() => set("category", cat)}
                  className="accent-brand-600"
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        {/* Domain */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-2">Domain</label>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <button
                key={d}
                onClick={() => set("domain", filters.domain === d ? "" : d)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.domain === d
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
          >
            <option value="newest">Newest first</option>
            <option value="deadline">Deadline (soonest)</option>
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => onChange({ category: "", domain: "", search: "", sort: "newest" })}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Reset all filters
        </button>
      </aside>
    </>
  );
}
