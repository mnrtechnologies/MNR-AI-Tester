import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Download, FileWarning, XCircle } from 'lucide-react';
import CoverageCaveatBanner from './CoverageCaveatBanner';
import CreatedCredentialsPanel from './CreatedCredentialsPanel';
import { fmtMs } from '../api';

const PHASE_COLS = ['phase', 'total_requests', 'total_failures', 'error_rate_pct', 'p50_ms', 'p95_ms', 'p99_ms', 'rps_avg'];
const PHASE_LABELS = {
  phase: 'Phase', total_requests: 'Requests', total_failures: 'Failures', error_rate_pct: 'Error %',
  p50_ms: 'p50', p95_ms: 'p95', p99_ms: 'p99', rps_avg: 'RPS',
};

export default function ResultsPanel({ run }) {
  if (!run) return null;
  const breaches = run.sla_breaches || [];
  const phaseResults = run.phase_results || {};
  const phaseRows = Object.entries(phaseResults).filter(([, m]) => m && typeof m === 'object');
  const webVitals = run.web_vitals || [];

  return (
    <div className="space-y-4">
      <CoverageCaveatBanner caveat={run.coverage_caveat} />

      {/* A run that failed before any phase produced results (e.g. the smoke-test
          safety gate aborted it) has nothing SLA-related to report — showing the
          usual green "All SLA thresholds met" banner in that case would be
          actively misleading, since no threshold was ever actually checked. */}
      {run.status === 'failed' && run.error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
          <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Run failed</p>
            <p className="text-sm text-rose-700 leading-relaxed">{run.error}</p>
          </div>
        </div>
      )}

      {/* SLA verdict — only meaningful once at least one phase actually ran AND
          the run didn't fail; sla_breaches is computed by llm_analysis, which a
          failed run never reaches, so an empty breach list there doesn't mean
          "thresholds were met," just that they were never checked. */}
      {phaseRows.length > 0 && run.status !== 'failed' && (
        <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 border ${
          breaches.length ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          {breaches.length
            ? <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            : <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${breaches.length ? 'text-rose-800' : 'text-emerald-800'}`}>
              {breaches.length ? `${breaches.length} SLA breach${breaches.length === 1 ? '' : 'es'}` : 'All SLA thresholds met'}
            </p>
            {breaches.length > 0 && (
              <ul className="text-sm text-rose-700 space-y-0.5">
                {breaches.map((b, i) => <li key={i}>• {b}</li>)}
              </ul>
            )}
            {run.breaking_point_vus != null && (
              <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                <TrendingUp size={13} /> Breaking point: <b>{run.breaking_point_vus} VUs</b>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Auto-create-test-accounts feature: this run's whole purpose was
          creating accounts (no smoke/load phases ever ran), so surface the
          result even for a run found later via Recent Runs, not just the
          one just-started in RunForm's own mini widget. */}
      {run.created_credentials_count > 0 && (
        <CreatedCredentialsPanel runId={run.run_id} count={run.created_credentials_count} />
      )}

      {/* Phase results table */}
      {phaseRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {PHASE_COLS.map((c) => (
                  <th key={c} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{PHASE_LABELS[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phaseRows.map(([phase, m]) => (
                <tr key={phase} className="border-b border-slate-50 last:border-0">
                  {PHASE_COLS.map((c) => (
                    <td key={c} className="px-4 py-2.5 text-slate-700">
                      {c === 'phase' ? <span className="font-bold capitalize">{phase}</span> :
                       c.endsWith('_ms') ? fmtMs(m[c]) :
                       c === 'error_rate_pct' ? `${(m[c] ?? 0).toFixed(1)}%` :
                       c === 'rps_avg' ? (m[c] ?? 0).toFixed(1) :
                       m[c] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Web Vitals */}
      {webVitals.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Core Web Vitals</p>
          <div className="space-y-2">
            {webVitals.map((v, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                <span className="text-slate-500 truncate max-w-[280px]">{v.page_url}</span>
                {v.error ? (
                  <span className="text-rose-500 text-xs">error: {v.error}</span>
                ) : (
                  <>
                    <span>LCP: <b>{v.lcp_ms != null ? fmtMs(v.lcp_ms) : '—'}</b></span>
                    <span>CLS: <b>{v.cls ?? '—'}</b></span>
                    <span>TTFB: <b>{fmtMs(v.ttfb_ms)}</b></span>
                    <span className="text-slate-400 text-xs">INP {fmtMs(v.inp_ms)} (synthetic sample)</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis */}
      {run.analysis_summary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Analysis</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{run.analysis_summary}</p>
          {(run.recommendations || []).length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {run.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-orange-500">•</span>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Report download */}
      <div className="flex items-center gap-3">
        {run.s3_report_url ? (
          <a href={run.s3_report_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">
            <Download size={14} /> Download Report
          </a>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-400 text-sm font-bold cursor-not-allowed"
            title="Report was generated but not uploaded — S3 isn't configured on this deployment.">
            <FileWarning size={14} /> Report not available
          </div>
        )}
      </div>
    </div>
  );
}
