import React from "react";
import { X, RotateCcw } from "lucide-react";
import { CATEGORY_COLORS, INDIAN_STATES } from "../lib/constants";

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
  category: string[];
  domain: string[];
  location: string;
  mode: string;
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

  const toggleMulti = (key: "category" | "domain", value: string) => {
    const current = new Set((filters[key] || []).map((v) => v.toLowerCase()));
    const next = [...(filters[key] || [])];
    const normalized = value.toLowerCase();
    const existsIndex = next.findIndex((v) => v.toLowerCase() === normalized);
    if (existsIndex >= 0) {
      next.splice(existsIndex, 1);
    } else {
      next.push(value);
    }
    onChange({ ...filters, [key]: next });
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-r border-stone-200/60 dark:border-stone-800/60 p-5 overflow-y-auto transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-stone-800 font-display">Filters</h2>
          <button className="lg:hidden text-stone-400 hover:text-stone-600 dark:hover:text-stone-200" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Keyword..."
            className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
          />
        </div>

        {/* Category pills */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Category</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onChange({ ...filters, category: [] })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.category.length === 0
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const colorClass = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
              const isActive = filters.category.some((c) => c.toLowerCase() === cat.toLowerCase());
              return (
                <button
                  key={cat}
                  onClick={() => toggleMulti("category", cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                    isActive
                    ? colorClass
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
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
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Domain</label>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <button
                key={d}
                onClick={() => toggleMulti("domain", d)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  filters.domain.some((val) => val.toLowerCase() === d.toLowerCase())
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-stone-100 text-stone-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-stone-100"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Location / State */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Location / State</label>
          <select
            value={filters.location}
            onChange={(e) => set("location", e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Mode */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Mode</label>
          <select
            value={filters.mode}
            onChange={(e) => set("mode", e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Sort By</label>
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white/50 dark:bg-stone-900/60 dark:text-stone-100"
          >
            <option value="newest">Newest First</option>
            <option value="deadline">Deadline (Soonest)</option>
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => onChange({ category: [], domain: [], location: "", mode: "", search: "", sort: "newest" })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-stone-500 hover:text-brand-600 hover:bg-brand-50 dark:text-stone-300 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-all"
        >
          <RotateCcw size={14} /> Reset All
        </button>
      </aside>
    </>
  );
}
