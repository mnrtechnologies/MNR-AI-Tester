import React from 'react';
import { CheckCircle2, XCircle, ListChecks, Brain } from 'lucide-react';
import ScoreRing from './ScoreRing';

export default function TestReportPanel({ report, activeTab, setActiveTab }) {
  if (!report) return null;

  const passRate = report.total_tests > 0
    ? Math.round((report.passed_tests / report.total_tests) * 100)
    : 0;

  const tabs = [
    { id: 'test_results',   label: `Tests (${report.results?.length ?? 0})`, icon: ListChecks },
    ...(report.improvements ? [{ id: 'ai_improvements', label: 'AI Analysis', icon: Brain }] : []),
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-5 flex-wrap">
        <ScoreRing score={passRate} />
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Test Report</p>
          <div className="flex gap-5">
            {[
              { v: report.total_tests,  label: 'Total',  color: 'text-slate-800'   },
              { v: report.passed_tests, label: 'Passed', color: 'text-emerald-600' },
              { v: report.failed_tests, label: 'Failed', color: 'text-rose-600'    },
            ].map(({ v, label, color }) => (
              <div key={label} className="text-center">
                <div className={`text-2xl font-black tabular-nums ${color}`}>{v}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto hide-scroll bg-slate-50 border-b border-slate-200 px-3 py-2 gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5 max-h-96 overflow-y-auto hide-scroll">

        {activeTab === 'test_results' && (
          <div className="space-y-2.5">
            {!(report.results?.length) && <p className="text-sm text-slate-400 text-center py-6">No test results.</p>}
            {(report.results || []).map((r, i) => (
              <div key={i} className={`rounded-xl border p-4 flex items-start gap-3 ${
                r.status === 'passed' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
              }`}>
                <div className="mt-0.5 shrink-0">
                  {r.status === 'passed'
                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                    : <XCircle      size={16} className="text-rose-500"    />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      r.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>{r.status}</span>
                    <span className="text-[10px] text-slate-400">{r.duration}ms</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{r.name}</p>
                  {r.error && (
                    <p className="text-xs text-rose-600 mt-1 font-mono bg-rose-50 rounded-lg px-2 py-1 break-all">{r.error}</p>
                  )}
                  {r.output && <p className="text-xs text-slate-500 mt-1">{r.output}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ai_improvements' && report.improvements && (
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">
            {report.improvements}
          </pre>
        )}

      </div>
    </div>
  );
}
