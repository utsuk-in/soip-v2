import React, { useEffect, useState } from "react";
import { Users, UserCheck, Eye, MousePointer, RefreshCw, Search, ChevronLeft, ChevronRight, Trash2, RotateCw, Activity } from "lucide-react";
import {
  getDashboardMetrics, getStudentList, getStudentActivity, resendInvite, removeStudent,
  type DashboardMetrics, type StudentListItem, type StudentListResponse, type StudentActivityData,
} from "../../lib/api";

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-stone-800">{value}</p>
          <p className="text-xs text-stone-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [studentData, setStudentData] = useState<StudentListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activityModal, setActivityModal] = useState<{ student: StudentListItem; data: StudentActivityData } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        getDashboardMetrics(),
        getStudentList({ page, search, status: statusFilter }),
      ]);
      setMetrics(m);
      setStudentData(s);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, search, statusFilter]);

  const handleResend = async (id: string) => {
    await resendInvite(id);
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Admin Dashboard</h1>
        <button onClick={loadData} className="p-2 text-stone-400 hover:text-stone-600"><RefreshCw size={18} /></button>
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

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text" placeholder="Search students..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
        </select>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Dept</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Year</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Last Login</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentData?.items.map((s) => (
                <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{s.first_name || "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{s.email}</td>
                  <td className="px-4 py-3 text-stone-500">{s.department || "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{s.year_of_study || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.is_onboarded ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {s.is_onboarded ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!s.is_onboarded && (
                        <button onClick={() => handleResend(s.id)} title="Resend invite" className="p-1.5 text-stone-400 hover:text-brand-600"><RotateCw size={14} /></button>
                      )}
                      <button onClick={() => handleViewActivity(s)} title="View activity" className="p-1.5 text-stone-400 hover:text-brand-600"><Activity size={14} /></button>
                      <button onClick={() => handleRemove(s.id)} title="Remove" className="p-1.5 text-stone-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {studentData?.items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {studentData && studentData.total > studentData.page_size && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <p className="text-xs text-stone-500">
              Showing {(page - 1) * studentData.page_size + 1}–{Math.min(page * studentData.page_size, studentData.total)} of {studentData.total}
            </p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button disabled={page * studentData.page_size >= studentData.total} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Activity Modal */}
      {activityModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActivityModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-800">{activityModal.student.first_name || activityModal.student.email}</h2>
              <p className="text-xs text-stone-500">{activityModal.student.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{activityModal.data.total_views}</p>
                  <p className="text-xs text-stone-500">Views</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{activityModal.data.total_logins}</p>
                  <p className="text-xs text-stone-500">Logins</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-700 mb-2">Recent Activity</h3>
                {activityModal.data.recent_activity.length === 0 ? (
                  <p className="text-xs text-stone-400">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {activityModal.data.recent_activity.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${a.action === "view" ? "bg-blue-400" : a.action === "login" ? "bg-green-400" : "bg-stone-300"}`} />
                        <span className="text-stone-600 font-medium">{a.action}</span>
                        {a.opportunity_title && <span className="text-stone-400 truncate">— {a.opportunity_title}</span>}
                        <span className="ml-auto text-stone-400">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-stone-100">
              <button onClick={() => setActivityModal(null)} className="w-full py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
