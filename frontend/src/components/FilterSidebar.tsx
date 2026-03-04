import React from "react";
import { X, RotateCcw } from "lucide-react";
import { CATEGORY_COLORS } from "../lib/constants";

const CATEGORIES = [
  "hackathon", "grant", "fellowship", "internship",
  "competition", "scholarship", "program",
];

const DOMAINS = [
  "AI", "ML", "Data", "Robotics", "Web", "Mobile", "Cloud",
  "Security", "Blockchain", "Fintech", "Health", "Climate",
  "Education", "Social Impact", "Design", "Product", "Startup",
  "Research", "Hardware", "IoT",
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
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white/80 backdrop-blur-xl border-r border-stone-200/60 p-5 overflow-y-auto transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-stone-800 font-display">filters</h2>
          <button className="lg:hidden text-stone-400 hover:text-stone-600" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="keyword..."
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
          />
        </div>

        {/* Category pills */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">category</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => set("category", "")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.category === ""
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              all
            </button>
            {CATEGORIES.map((cat) => {
              const colorClass = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
              return (
                <button
                  key={cat}
                  onClick={() => set("category", filters.category === cat ? "" : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                    filters.category === cat
                      ? colorClass
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain pills */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">domain</label>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <button
                key={d}
                onClick={() => set("domain", filters.domain === d ? "" : d)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  filters.domain === d
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-stone-100 text-stone-500 hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50"
          >
            <option value="newest">newest first</option>
            <option value="deadline">deadline (soonest)</option>
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => onChange({ category: "", domain: "", search: "", sort: "newest" })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-stone-500 hover:text-brand-600 hover:bg-brand-50 transition-all"
        >
          <RotateCcw size={14} /> reset all
        </button>
      </aside>
    </>
  );
}
