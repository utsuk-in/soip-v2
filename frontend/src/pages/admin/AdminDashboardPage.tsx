import React, { useEffect, useRef, useState } from "react";
import {
  Users, UserCheck, Eye, MousePointer, RefreshCw, Search,
  ChevronLeft, ChevronRight, Trash2, RotateCw, Activity,
  Copy, ExternalLink, Check, X, AlertTriangle, Filter,
} from "lucide-react";
import {
  getDashboardMetrics, getStudentList, getStudentActivity,
  resendInvite, removeStudent, bulkResendInvite, bulkRemoveStudents,
  getFilterOptions,
  type DashboardMetrics, type StudentListItem, type StudentListResponse,
  type StudentActivityData, type MagicLinkResult, type BulkResendSummary,
} from "../../lib/api";

// --- Filter config (extensible: add one entry per new filterable column) ---

type FilterType = "text" | "select";

interface ColumnFilterConfig {
  key: string;
  label: string;
  type: FilterType;
  placeholder?: string;
  staticOptions?: { value: string; label: string }[];
  dynamicField?: string; // backend field name for /filter-options
}

const COLUMN_FILTERS: ColumnFilterConfig[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Filter by name…" },
  { key: "email", label: "Email", type: "text", placeholder: "Filter by email…" },
  { key: "department", label: "Dept", type: "select", dynamicField: "department" },
  { key: "year_of_study", label: "Year", type: "select", dynamicField: "year_of_study" },
  {
    key: "status", label: "Status", type: "select",
    staticOptions: [
      { value: "active", label: "Active" },
      { value: "invited", label: "Invited" },
    ],
  },
];

// Non-filterable columns rendered after the filterable ones
const EXTRA_COLUMNS = [
  { label: "Last Login", key: "last_login" },
  { label: "Actions", key: "actions", align: "right" as const },
];

// --- Sub-components ---

function InviteStatusBadge({ student }: { student: StudentListItem }) {
  if (student.is_onboarded) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
  }
  if (student.invite_token_status === "expired") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Link Expired</span>;
  }
  if (student.invite_token_status === "used") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Pending Setup</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Invited</span>;
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MagicLinkResultRow({ result }: { result: MagicLinkResult }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(result.magic_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <tr className="border-t border-stone-100 dark:border-stone-800">
      <td className="px-3 py-2 text-xs text-stone-700 dark:text-stone-300 truncate max-w-[160px]">{result.email}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 max-w-[180px]">
          <code className="text-xs text-stone-600 dark:text-stone-300 font-mono truncate flex-1">{result.magic_token}</code>
          <button type="button" onClick={handleCopy} title="Copy token" className="shrink-0 p-0.5 text-stone-400 hover:text-brand-600">
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <a href={result.magic_link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800">
          <ExternalLink size={12} /> Open
        </a>
      </td>
    </tr>
  );
}

// --- Column filter popover ---

function ColumnFilterPopover({
  config,
  value,
  onChange,
  onClose,
  options,
}: {
  config: ColumnFilterConfig;
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  options: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg p-2 min-w-[180px]">
      {config.type === "text" ? (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder || `Filter…`}
          className="w-full px-2.5 py-1.5 text-xs border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
      ) : (
        <select
          autoFocus
          value={value}
          title={`Filter by ${config.label}`}
          aria-label={`Filter by ${config.label}`}
          onChange={(e) => { onChange(e.target.value); onClose(); }}
          className="w-full px-2.5 py-1.5 text-xs border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800 dark:text-stone-100"
        >
          <option value="">All</option>
          {config.staticOptions
            ? config.staticOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))
            : options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))
          }
        </select>
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); onClose(); }}
          className="mt-1.5 w-full text-xs text-stone-500 dark:text-stone-400 hover:text-red-600 text-center py-1"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

// --- Filterable column header ---

function FilterableHeader({
  config,
  value,
  onChange,
  dynamicOptions,
}: {
  config: ColumnFilterConfig;
  value: string;
  onChange: (val: string) => void;
  dynamicOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  const isActive = !!value;

  return (
    <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400 relative">
      <div className="flex items-center gap-1">
        <span>{config.label}</span>
        <button
          type="button"
          title={`Filter by ${config.label}`}
          onClick={() => setOpen(!open)}
          className={`p-0.5 rounded transition-colors ${isActive ? "text-brand-600" : "text-stone-400 hover:text-stone-600"}`}
        >
          <Filter size={12} />
        </button>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        )}
      </div>
      {open && (
        <ColumnFilterPopover
          config={config}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          options={dynamicOptions}
        />
      )}
    </th>
  );
}

// --- Cell renderer ---

function StudentCell({ student, columnKey }: { student: StudentListItem; columnKey: string }) {
  switch (columnKey) {
    case "name":
      return <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-100">{student.first_name || "—"}</td>;
    case "email":
      return <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{student.email}</td>;
    case "department":
      return <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{student.department || "—"}</td>;
    case "year_of_study":
      return <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{student.year_of_study || "—"}</td>;
    case "status":
      return <td className="px-4 py-3"><InviteStatusBadge student={student} /></td>;
    default:
      return <td className="px-4 py-3 text-stone-500 dark:text-stone-400">—</td>;
  }
}

// --- Main page ---

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [studentData, setStudentData] = useState<StudentListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Global search (kept for quick name+email lookup)
  const [search, setSearch] = useState("");

  // Per-column filters (keyed by ColumnFilterConfig.key)
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Dynamic options cache (keyed by dynamicField)
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});

  // Single-row modals
  const [activityModal, setActivityModal] = useState<{ student: StudentListItem; data: StudentActivityData } | null>(null);
  const [magicLinkModal, setMagicLinkModal] = useState<MagicLinkResult | null>(null);
  const [singleCopied, setSingleCopied] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResendWarning, setBulkResendWarning] = useState(false);
  const [bulkResendSummary, setBulkResendSummary] = useState<BulkResendSummary | null>(null);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearch("");
    setPage(1);
  };

  // Load dynamic filter options once on mount
  useEffect(() => {
    const dynamicFields = COLUMN_FILTERS
      .filter((c) => c.dynamicField)
      .map((c) => c.dynamicField!);

    Promise.all(
      dynamicFields.map((field) =>
        getFilterOptions(field).then((opts) => ({ field, opts }))
      )
    ).then((results) => {
      const optMap: Record<string, string[]> = {};
      for (const { field, opts } of results) {
        optMap[field] = opts;
      }
      setDynamicOptions(optMap);
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        getDashboardMetrics(),
        getStudentList({
          page,
          search: search || undefined,
          status: filters.status || undefined,
          name: filters.name || undefined,
          email: filters.email || undefined,
          department: filters.department || undefined,
          year_of_study: filters.year_of_study || undefined,
        }),
      ]);
      setMetrics(m);
      setStudentData(s);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, search, filters]);

  // Clear selection whenever the visible page changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, search, filters]);

  // Sync indeterminate state on the select-all checkbox
  const pageIds = studentData?.items.map((s) => s.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- Single-row actions ---

  const handleResend = async (id: string) => {
    const result = await resendInvite(id);
    setSingleCopied(false);
    setMagicLinkModal(result);
    loadData();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this student? This will deactivate their account.")) return;
    await removeStudent(id);
    loadData();
  };

  const handleViewActivity = async (student: StudentListItem) => {
    const data = await getStudentActivity(student.id);
    setActivityModal({ student, data });
  };

  const handleSingleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setSingleCopied(true);
    setTimeout(() => setSingleCopied(false), 2000);
  };

  // --- Bulk actions ---

  const selectedStudents = studentData?.items.filter((s) => selectedIds.has(s.id)) ?? [];
  const onboardedInSelection = selectedStudents.filter((s) => s.is_onboarded);

  const handleBulkResendClick = () => {
    if (onboardedInSelection.length > 0) {
      setBulkResendWarning(true);
    } else {
      executeBulkResend([...selectedIds]);
    }
  };

  const executeBulkResend = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const summary = await bulkResendInvite(ids);
      setSelectedIds(new Set());
      setBulkResendSummary(summary);
      loadData();
    } catch {
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkResendConfirm = () => {
    const nonOnboardedIds = selectedStudents
      .filter((s) => !s.is_onboarded)
      .map((s) => s.id);
    setSelectedIds(new Set(nonOnboardedIds));
    setBulkResendWarning(false);
    executeBulkResend(nonOnboardedIds);
  };

  const handleBulkRemove = async () => {
    if (!confirm(`Remove ${selectedIds.size} student(s)? This will deactivate their accounts.`)) return;
    setBulkLoading(true);
    try {
      await bulkRemoveStudents([...selectedIds]);
      setSelectedIds(new Set());
      loadData();
    } catch {
    } finally {
      setBulkLoading(false);
    }
  };

  const totalCols = 1 /* checkbox */ + COLUMN_FILTERS.length + EXTRA_COLUMNS.length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Admin Dashboard</h1>
        <button type="button" title="Refresh" onClick={loadData} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <MetricCard icon={Users} label="Invited" value={metrics.total_invited} color="bg-blue-500" />
          <MetricCard icon={UserCheck} label="Activated" value={metrics.total_activated} color="bg-green-500" />
          <MetricCard icon={RefreshCw} label="Activation Rate" value={`${metrics.activation_rate}%`} color="bg-purple-500" />
          <MetricCard icon={Eye} label="Opps Viewed" value={metrics.total_views} color="bg-amber-500" />
          <MetricCard icon={MousePointer} label="Applications" value={metrics.total_applications} color="bg-rose-500" />
        </div>
      )}

      {/* Search bar + clear filters */}
      <div className="flex gap-3 mb-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text" placeholder="Search by name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500"
          />
        </div>
        {(hasActiveFilters || search) && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-red-600 border border-stone-200 dark:border-stone-700 rounded-xl transition-colors"
          >
            <X size={13} /> Clear all filters
          </button>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-stone-800 text-white rounded-xl shadow-lg">
          <span className="text-sm font-medium mr-1">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            type="button" disabled={bulkLoading}
            onClick={handleBulkResendClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RotateCw size={13} /> Resend Invite
          </button>
          <button
            type="button" disabled={bulkLoading}
            onClick={handleBulkRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> Remove
          </button>
          <button
            type="button" title="Clear selection"
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-stone-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Student List */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-stone-800">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all on page"
                    className="rounded border-stone-300 cursor-pointer"
                  />
                </th>
                {COLUMN_FILTERS.map((col) => (
                  <FilterableHeader
                    key={col.key}
                    config={col}
                    value={filters[col.key] || ""}
                    onChange={(val) => setFilter(col.key, val)}
                    dynamicOptions={col.dynamicField ? (dynamicOptions[col.dynamicField] ?? []) : []}
                  />
                ))}
                {EXTRA_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.align === "right" ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-stone-400 dark:text-stone-500">Loading...</td></tr>
              )}
              {!loading && studentData?.items.map((s) => (
                <tr
                  key={s.id}
                  className={`border-t border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${selectedIds.has(s.id) ? "bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-50 dark:hover:bg-brand-900/20" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      aria-label={`Select ${s.first_name || s.email}`}
                      className="rounded border-stone-300 cursor-pointer"
                    />
                  </td>
                  {COLUMN_FILTERS.map((col) => (
                    <StudentCell key={col.key} student={s} columnKey={col.key} />
                  ))}
                  <td className="px-4 py-3 text-stone-500 dark:text-stone-400 text-xs">
                    {s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!s.is_onboarded && (
                        <button type="button" onClick={() => handleResend(s.id)} title="Resend invite" className="p-1.5 text-stone-400 hover:text-brand-600 dark:hover:text-brand-400"><RotateCw size={14} /></button>
                      )}
                      <button type="button" onClick={() => handleViewActivity(s)} title="View activity" className="p-1.5 text-stone-400 hover:text-brand-600 dark:hover:text-brand-400"><Activity size={14} /></button>
                      <button type="button" onClick={() => handleRemove(s.id)} title="Remove" className="p-1.5 text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && studentData?.items.length === 0 && (
                <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-stone-400 dark:text-stone-500">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {studentData && studentData.total > studentData.page_size && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 dark:border-stone-800">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Showing {(page - 1) * studentData.page_size + 1}–{Math.min(page * studentData.page_size, studentData.total)} of {studentData.total}
            </p>
            <div className="flex gap-1">
              <button type="button" title="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button type="button" title="Next page" disabled={page * studentData.page_size >= studentData.total} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk resend — warning modal */}
      {bulkResendWarning && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-800 dark:text-stone-100">Some students are already active</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {onboardedInSelection.length} of {selectedIds.size} selected student{selectedIds.size !== 1 ? "s are" : " is"} already active and won't receive a new invite. Deselect them and continue with the remaining {selectedIds.size - onboardedInSelection.length}?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBulkResendWarning(false)}
                className="flex-1 py-2 text-sm font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkResendConfirm}
                disabled={selectedIds.size - onboardedInSelection.length === 0}
                className="flex-1 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Deselect & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk resend — results modal */}
      {bulkResendSummary && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBulkResendSummary(null)}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-100 dark:border-stone-800">
              <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Invites Sent</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {bulkResendSummary.results.length} new magic link{bulkResendSummary.results.length !== 1 ? "s" : ""} generated
                {bulkResendSummary.skipped_onboarded > 0 && ` · ${bulkResendSummary.skipped_onboarded} already active (skipped)`}
                {bulkResendSummary.failed > 0 && ` · ${bulkResendSummary.failed} failed`}
              </p>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {bulkResendSummary.results.length > 0 ? (
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 dark:bg-stone-800">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Token</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResendSummary.results.map((r) => (
                        <MagicLinkResultRow key={r.student_id} result={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">No invites were sent.</p>
              )}
            </div>
            <div className="p-5 border-t border-stone-100 dark:border-stone-800">
              <button type="button" onClick={() => setBulkResendSummary(null)} className="w-full py-2 text-sm font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single resend — magic link modal */}
      {magicLinkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMagicLinkModal(null)}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-100 dark:border-stone-800">
              <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Magic Link Sent</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{magicLinkModal.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5">Raw Token</p>
                <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2">
                  <code className="flex-1 text-xs text-stone-700 dark:text-stone-300 font-mono truncate">{magicLinkModal.magic_token}</code>
                  <button
                    type="button" onClick={() => handleSingleCopy(magicLinkModal.magic_token)}
                    title="Copy token" className="shrink-0 p-1 text-stone-400 hover:text-brand-600 transition-colors"
                  >
                    {singleCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1.5">Onboarding Link</p>
                <a
                  href={magicLinkModal.magic_link_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  <ExternalLink size={13} className="shrink-0" />
                  <span className="truncate">{magicLinkModal.magic_link_url}</span>
                </a>
              </div>
            </div>
            <div className="p-5 border-t border-stone-100 dark:border-stone-800">
              <button type="button" onClick={() => setMagicLinkModal(null)} className="w-full py-2 text-sm font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity modal */}
      {activityModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActivityModal(null)}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-100 dark:border-stone-800">
              <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">{activityModal.student.first_name || activityModal.student.email}</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">{activityModal.student.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800 dark:text-stone-100">{activityModal.data.total_views}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Views</p>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800 dark:text-stone-100">{activityModal.data.total_logins}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Logins</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Recent Activity</h3>
                {activityModal.data.recent_activity.length === 0 ? (
                  <p className="text-xs text-stone-400 dark:text-stone-500">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {activityModal.data.recent_activity.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${a.action === "view" ? "bg-blue-400" : a.action === "login" ? "bg-green-400" : "bg-stone-300"}`} />
                        <span className="text-stone-600 dark:text-stone-300 font-medium">{a.action}</span>
                        {a.opportunity_title && <span className="text-stone-400 dark:text-stone-500 truncate">— {a.opportunity_title}</span>}
                        <span className="ml-auto text-stone-400 dark:text-stone-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-stone-100 dark:border-stone-800">
              <button type="button" onClick={() => setActivityModal(null)} className="w-full py-2 text-sm font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
