import React from 'react';
import { AlertTriangle, CheckCircle2, Timer, Database } from 'lucide-react';
import { sevCfg } from '../constants';
import { fmtDate } from '../api';
import ScoreRing from './ScoreRing';

export default function AnalysisReportPanel({ report, activeTab, setActiveTab, label = 'Analysis Report' }) {
  if (!report) return null;

  const tabs = [
    { id: 'findings',        label: `Findings (${report.findings?.length ?? 0})`,         icon: AlertTriangle },
    { id: 'recommendations', label: `Fixes (${report.recommendations?.length ?? 0})`,     icon: CheckCircle2  },
    { id: 'slow_queries',    label: `Slow Queries (${report.slow_queries?.length ?? 0})`, icon: Timer         },
    { id: 'table_stats',     label: `Tables (${report.table_stats?.length ?? 0})`,        icon: Database      },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-4 flex-wrap">
        <ScoreRing score={report.score} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{report.db_type}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
          {report.generated_at && (
            <p className="text-[10px] text-slate-400 mt-1">{fmtDate(report.generated_at)}</p>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto hide-scroll bg-slate-50 border-b border-slate-200 px-3 py-2 gap-1">
        {tabs.map(({ id, label: l, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}>
            <Icon size={12} />{l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5 max-h-96 overflow-y-auto hide-scroll">

        {activeTab === 'findings' && (
          <div className="space-y-3">
            {!(report.findings?.length) && <p className="text-sm text-slate-400 text-center py-6">No findings.</p>}
            {(report.findings || []).map((f, i) => {
              const c = sevCfg[f.severity] || sevCfg.info;
              return (
                <div key={i} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${c.badge}`}>{f.severity}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">{f.category}</span>
                  </div>
                  <p className={`text-sm font-bold mb-1 ${c.text}`}>{f.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.detail}</p>
                  {f.impact && <p className="text-xs text-slate-500 mt-1.5 italic">Impact: {f.impact}</p>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-3">
            {!(report.recommendations?.length) && <p className="text-sm text-slate-400 text-center py-6">No recommendations.</p>}
            {[...(report.recommendations || [])].sort((a, b) => a.priority - b.priority).map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">{r.priority}</span>
                  <p className="text-sm font-bold text-slate-800">{r.title}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{r.action}</p>
                {r.sql && (
                  <pre className="bg-[#0f172a] text-emerald-300 text-[11px] font-mono p-3 rounded-xl overflow-x-auto hide-scroll whitespace-pre-wrap leading-relaxed">
                    {r.sql}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'slow_queries' && (
          <div className="space-y-3">
            {!(report.slow_queries?.length) && <p className="text-sm text-slate-400 text-center py-6">No slow queries detected.</p>}
            {(report.slow_queries || []).map((q, i) => (
              <div key={i} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs font-black text-amber-700">{Number(q.avg_ms).toFixed(0)} ms avg</span>
                  <span className="text-xs text-slate-500">{q.calls} calls</span>
                  <span className="text-xs text-slate-500">{q.rows} rows avg</span>
                  <span className="text-xs text-slate-400">{(q.total_ms / 1000).toFixed(1)}s total</span>
                </div>
                <pre className="text-xs font-mono text-slate-700 bg-white rounded-lg p-3 border border-amber-100 overflow-x-auto hide-scroll whitespace-pre-wrap leading-relaxed">
                  {q.query}
                </pre>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'table_stats' && (
          <div className="overflow-x-auto hide-scroll">
            {!(report.table_stats?.length) && <p className="text-sm text-slate-400 text-center py-6">No table stats.</p>}
            {!!(report.table_stats?.length) && (
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    {['Table','Size','Live Rows','Dead Rows','Seq Scans','Idx Scans','Missing Index'].map(h => (
                      <th key={h} className="pb-2 pr-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.table_stats.map((t, i) => (
                    <tr key={i} className={t.missing_index ? 'bg-rose-50/40' : ''}>
                      <td className="py-2 pr-4 font-bold text-slate-800 whitespace-nowrap">
                        {t.schema_name ? `${t.schema_name}.${t.table_name}` : t.table_name}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">{t.size_pretty}</td>
                      <td className="py-2 pr-4 text-slate-600 tabular-nums">{t.live_rows?.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-600 tabular-nums">{t.dead_rows?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-600 tabular-nums">{t.seq_scans?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-600 tabular-nums">{t.idx_scans?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4">
                        {t.missing_index
                          ? <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">Yes</span>
                          : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
