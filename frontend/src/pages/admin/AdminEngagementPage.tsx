import React, { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, Link, ThumbsUp } from "lucide-react";
import { getEngagementReport, type EngagementReport } from "../../lib/api";

export default function AdminEngagementPage() {
  const [report, setReport] = useState<EngagementReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEngagementReport(8)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return <div className="p-6 text-center text-stone-400">Failed to load engagement data</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Engagement Report</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Trend */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Weekly Activity Trend</h2>
          </div>
          {report.weekly_trends.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-8">No activity data yet</p>
          ) : (
            <div className="space-y-2">
              {report.weekly_trends.map((w) => {
                const max = Math.max(...report.weekly_trends.map((t) => t.interactions), 1);
                const pct = (w.interactions / max) * 100;
                return (
                  <div key={w.week} className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 dark:text-stone-400 w-20 flex-shrink-0">{w.week}</span>
                    <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-full h-5">
                      <div className="bg-brand-500 h-5 rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                        <span className="text-[10px] font-bold text-white">{w.interactions}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Top Categories Engaged</h2>
          </div>
          {report.category_breakdown.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-8">No category data yet</p>
          ) : (
            <div className="space-y-2">
              {report.category_breakdown.map((c) => {
                const max = Math.max(...report.category_breakdown.map((x) => x.count), 1);
                const pct = (c.count / max) * 100;
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-xs text-stone-600 dark:text-stone-400 w-24 flex-shrink-0 capitalize">{c.category}</span>
                    <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-full h-5">
                      <div className="bg-amber-400 h-5 rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                        <span className="text-[10px] font-bold text-white">{c.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Engagement Distribution */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-purple-500" />
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Student Engagement Distribution</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {report.engagement_distribution.map((b) => (
              <div key={b.bucket} className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{b.count}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {b.bucket === "0" ? "No interactions" : b.bucket === "1-5" ? "1–5 interactions" : "5+ interactions"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Magic Link Stats */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link size={18} className="text-green-500" />
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Magic Link Stats</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{report.magic_link_stats.total_sent}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Sent</p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{report.magic_link_stats.total_used}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Used</p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-brand-600">{report.magic_link_stats.open_rate}%</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Open Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Feedback Summary */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ThumbsUp size={18} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Recommendation Feedback</h2>
        </div>
        {report.feedback_summary.thumbs_up + report.feedback_summary.thumbs_down === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">No feedback submitted yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{report.feedback_summary.thumbs_up}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Thumbs Up</p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-hot">{report.feedback_summary.thumbs_down}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Thumbs Down</p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-brand-600">{report.feedback_summary.positive_rate}%</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Positive Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Viewed Opportunities */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-5">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-4">Top Viewed Opportunities</h2>
        {report.top_opportunities.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">No opportunity views yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 dark:bg-stone-800">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">#</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Opportunity</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Views</th>
                </tr>
              </thead>
              <tbody>
                {report.top_opportunities.map((o, i) => (
                  <tr key={o.opportunity_id} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="px-4 py-2 text-stone-400 dark:text-stone-500">{i + 1}</td>
                    <td className="px-4 py-2 text-stone-800 dark:text-stone-100 font-medium">{o.title}</td>
                    <td className="px-4 py-2 text-right text-stone-600 dark:text-stone-300 font-semibold">{o.view_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
